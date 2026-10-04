import express, { type Request, type Response, type NextFunction } from "express";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { graduationTerms, graduationYearOptions } from "./src/lib/memberGraduation";

// Invite-only member accounts live in a single-writer service. Public website
// replicas proxy requests here; no member details or images use their hostPath.
const token = process.env.MEMBER_SERVICE_TOKEN;
if (!token || token.length < 32) throw new Error("MEMBER_SERVICE_TOKEN is required");
const dataDir = process.env.MEMBER_DATA_DIR ?? "./data/members";
const avatarDir = path.join(dataDir, "avatars");
await fs.mkdir(avatarDir, { recursive: true });
const db = await open({ filename: path.join(dataDir, "members.sqlite"), driver: sqlite3.Database });
await db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS invites (
  id INTEGER PRIMARY KEY, email TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL,
  token_hash TEXT UNIQUE NOT NULL, expires_at INTEGER NOT NULL, used_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL,
  password_hash TEXT NOT NULL, created_at INTEGER NOT NULL,
  failed_count INTEGER NOT NULL DEFAULT 0, lock_until INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS profiles (
  account_id INTEGER PRIMARY KEY REFERENCES accounts(id), draft_json TEXT,
  published_json TEXT, status TEXT NOT NULL DEFAULT 'draft',
  draft_avatar TEXT, published_avatar TEXT, updated_at INTEGER, reviewed_at INTEGER
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY, account_id INTEGER NOT NULL REFERENCES accounts(id),
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS password_resets (
  token_hash TEXT PRIMARY KEY, account_id INTEGER NOT NULL REFERENCES accounts(id),
  expires_at INTEGER NOT NULL
);`);
// sqlite's single connection does not isolate overlapping async handlers by
// itself. Serialize the few multi-statement writes before BEGIN/COMMIT.
let transactionTail = Promise.resolve();
async function transaction<T>(work: () => Promise<T>): Promise<T> {
  let release!: () => void;
  const done = new Promise<void>(resolve => { release = resolve; });
  const previous = transactionTail;
  transactionTail = previous.then(() => done);
  await previous;
  try {
    await db.exec("BEGIN IMMEDIATE");
    try { const result = await work(); await db.exec("COMMIT"); return result; }
    catch (error) { await db.exec("ROLLBACK"); throw error; }
  } finally { release(); }
}

type Role = "master1" | "master2" | "alumni";
const roles: Role[] = ["master1", "master2", "alumni"];
type Profile = {
  displayNameZh: string; displayNameEn: string; entryYear: string; graduationYear: string; graduationTerm: string;
  degree: string; interests: string[]; bio: string; affiliation: string; link: string;
  publishConsent: boolean; avatarConsent: boolean; selfAttested: boolean;
};
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const textField = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
const safeId = (value: string) => /^\d{1,12}$/.test(value);
const roleLabel: Record<Role, string> = { master1: "碩一", master2: "碩二", alumni: "實驗室畢業學長姊" };
const unix = () => Date.now();
function safeProfile(input: any): Profile | null {
  if (!input || typeof input !== "object" || typeof input.publishConsent !== "boolean" || typeof input.avatarConsent !== "boolean" || input.selfAttested !== true) return null;
  const name = textField(input.displayNameZh, 40);
  if (!name || name.length > 40) return null;
  const link = textField(input.link, 200);
  if (link) { try { const url = new URL(link); if (url.protocol !== "https:" || url.username || url.password) return null; } catch { return null; } }
  const interests = Array.isArray(input.interests) ? input.interests.slice(0, 3).map((item: unknown) => textField(item, 30)).filter(Boolean) : [];
  const graduationTerm = input.graduationTerm ?? "";
  if (typeof graduationTerm !== "string" || (graduationTerm && !graduationTerms.some(term => term === graduationTerm))) return null;
  return {
    displayNameZh: name, displayNameEn: textField(input.displayNameEn, 80),
    entryYear: textField(input.entryYear, 12), graduationYear: textField(input.graduationYear, 12), graduationTerm,
    degree: textField(input.degree, 30), interests, bio: textField(input.bio, 120),
    affiliation: textField(input.affiliation, 80), link,
    publishConsent: input.publishConsent, avatarConsent: input.avatarConsent, selfAttested: true,
  };
}
function publicProfile(profile: Profile, account: { id: number; role: Role }, avatar: string | null, updatedAt: number | null) {
  const { publishConsent: _publishConsent, avatarConsent: _avatarConsent, selfAttested: _selfAttested, ...fields } = profile;
  return { id: account.id, role: account.role, roleLabel: roleLabel[account.role], ...fields,
    avatarUrl: avatar && profile.avatarConsent ? `/api/members/avatar/${account.id}?v=${updatedAt ?? 0}` : null };
}
// Profiles left waiting under the former review workflow become public on
// startup only when the member already consented. Hidden profiles stay hidden.
const pendingProfiles = await db.all("SELECT account_id AS accountId,draft_json AS draftJson,draft_avatar AS draftAvatar,published_avatar AS publishedAvatar FROM profiles WHERE status='pending' AND draft_json IS NOT NULL");
if (pendingProfiles.length) await transaction(async () => {
  for (const row of pendingProfiles) {
    let profile: Profile | null = null;
    try { profile = safeProfile(JSON.parse(row.draftJson)); } catch { /* Leave invalid legacy rows private. */ }
    if (!profile) {
      await db.run("UPDATE profiles SET status='private',published_json=NULL,published_avatar=NULL WHERE account_id=?", row.accountId);
      continue;
    }
    const publish = profile.publishConsent === true;
    await db.run("UPDATE profiles SET published_json=?,published_avatar=?,status=?,reviewed_at=NULL WHERE account_id=?",
      publish ? row.draftJson : null,
      publish && profile.avatarConsent ? row.draftAvatar ?? row.publishedAvatar : null,
      publish ? "approved" : "private", row.accountId);
  }
});
function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  return new Promise((resolve, reject) => scrypt(password, salt, 64, (error, key) => error ? reject(error) : resolve(`scrypt$${salt}$${key.toString("hex")}`)));
}
function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [, salt, key] = stored.split("$");
  if (!salt || !key) return Promise.resolve(false);
  return new Promise((resolve, reject) => scrypt(password, salt, 64, (error, result) => {
    if (error) return reject(error);
    const expected = Buffer.from(key, "hex");
    resolve(expected.length === result.length && timingSafeEqual(expected, result));
  }));
}
type Handler = (req: Request, res: Response) => Promise<unknown>;
const wrap = (handler: Handler) => (req: Request, res: Response, next: NextFunction) => { Promise.resolve(handler(req, res)).catch(next); };
const app = express();
app.disable("x-powered-by");
app.get("/health", (_req, res) => res.json({ ok: true }));
app.use((req, res, next) => {
  const supplied = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!supplied || !token) return res.status(401).json({ error: "Unauthorized" });
  const actual = Buffer.from(supplied), expected = Buffer.from(token);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return res.status(401).json({ error: "Unauthorized" });
  next();
});
app.use(express.json({ limit: "32kb" }));
app.use((req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });

const member = async (req: Request, res: Response, next: NextFunction) => {
  try {
  const raw = req.headers.cookie?.match(/(?:^|;\s*)member_session=([^;]+)/)?.[1];
  if (!raw || raw.length > 100) return res.status(401).json({ error: "請先登入" });
  const account = await db.get("SELECT a.id, a.email, a.name, a.role, p.draft_json AS draftJson, p.status, p.draft_avatar AS draftAvatar, p.published_avatar AS publishedAvatar FROM sessions s JOIN accounts a ON a.id=s.account_id JOIN profiles p ON p.account_id=a.id WHERE s.token_hash=? AND s.expires_at>?", digest(raw), unix());
  if (!account) return res.status(401).json({ error: "登入已失效" });
  (req as Request & { account: typeof account }).account = account;
  next();
  } catch (error) { next(error); }
};
const getAccount = (req: Request) => (req as Request & { account: any }).account;
function setSession(res: Response, value: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `member_session=${value}; Path=/api/members; HttpOnly; SameSite=Lax; Max-Age=604800${secure}`);
}
async function issueSession(res: Response, accountId: number) {
  const value = randomBytes(32).toString("base64url");
  await db.run("INSERT INTO sessions (token_hash, account_id, expires_at) VALUES (?, ?, ?)", digest(value), accountId, unix() + 7 * 86_400_000);
  setSession(res, value);
}

app.post("/admin/invites", wrap(async (req, res) => {
  const entries = Array.isArray(req.body?.entries) ? req.body.entries : [];
  if (!entries.length || entries.length > 100) return res.status(400).json({ error: "一次請匯入 1 至 100 人" });
  const validated = entries.map((entry: any) => ({ name: textField(entry.name, 40), email: textField(entry.email, 254).toLowerCase(), role: entry.role as Role }));
  if (validated.some(({ name, email, role }: { name: string; email: string; role: Role }) => !name || !validEmail(email) || !roles.includes(role))) return res.status(400).json({ error: "名冊格式錯誤" });
  const existing = await db.all("SELECT email FROM accounts WHERE email IN (" + validated.map(() => "?").join(",") + ")", ...validated.map((entry: { email: string }) => entry.email));
  if (existing.length) return res.status(409).json({ error: "名冊含已建立的帳號" });
  const result = await transaction(async () => {
    const issued = [];
    for (const entry of validated) {
      await db.run("DELETE FROM invites WHERE email=? AND used_at IS NULL", entry.email);
      const invite = randomBytes(32).toString("base64url");
      await db.run("INSERT INTO invites (email,name,role,token_hash,expires_at,created_at) VALUES (?,?,?,?,?,?)", entry.email, entry.name, entry.role, digest(invite), unix() + 30 * 86_400_000, unix());
      issued.push({ ...entry, invite, expiresAt: unix() + 30 * 86_400_000 });
    }
    return issued;
  });
  res.status(201).json({ invites: result });
}));
app.get("/invite/:invite", wrap(async (req, res) => {
  const found = await db.get("SELECT email,name,role,expires_at AS expiresAt FROM invites WHERE token_hash=? AND used_at IS NULL AND expires_at>?", digest(req.params.invite), unix());
  if (!found || !roles.includes(found.role)) return res.status(404).json({ error: "邀請已失效" });
  res.json({ ...found, roleLabel: roleLabel[found.role as Role] });
}));
app.post("/activate", wrap(async (req, res) => {
  const invite = textField(req.body?.invite, 100);
  const password = req.body?.password;
  if (!invite || typeof password !== "string" || password.length < 10 || password.length > 128) return res.status(400).json({ error: "請設定至少 10 字元的密碼" });
  const passwordHash = await hashPassword(password);
  let accountId: number | null;
  try {
    accountId = await transaction(async () => {
      const found = await db.get("SELECT * FROM invites WHERE token_hash=? AND used_at IS NULL AND expires_at>?", digest(invite), unix());
      if (!found || !roles.includes(found.role)) return null;
      const result = await db.run("INSERT INTO accounts (email,name,role,password_hash,created_at) VALUES (?,?,?,?,?)", found.email, found.name, found.role, passwordHash, unix());
      await db.run("INSERT INTO profiles (account_id,status) VALUES (?,'draft')", result.lastID);
      await db.run("UPDATE invites SET used_at=? WHERE id=?", unix(), found.id);
      return result.lastID!;
    });
  } catch (error) { if (String(error).includes("UNIQUE")) return res.status(409).json({ error: "帳號已建立，請直接登入" }); throw error; }
  if (!accountId) return res.status(404).json({ error: "邀請已失效" });
  await issueSession(res, accountId);
  res.status(201).json({ ok: true });
}));
app.post("/login", wrap(async (req, res) => {
  const email = textField(req.body?.email, 254).toLowerCase();
  const password = req.body?.password;
  if (!validEmail(email) || typeof password !== "string" || password.length > 128) return res.status(401).json({ error: "信箱或密碼錯誤" });
  const account = await db.get("SELECT id,password_hash AS passwordHash,failed_count AS failedCount,lock_until AS lockUntil FROM accounts WHERE email=?", email);
  if (!account || account.lockUntil > unix()) return res.status(401).json({ error: "信箱或密碼錯誤，請稍後再試" });
  if (!await verifyPassword(password, account.passwordHash)) {
    const failed = account.failedCount + 1;
    await db.run("UPDATE accounts SET failed_count=?,lock_until=? WHERE id=?", failed >= 5 ? 0 : failed, failed >= 5 ? unix() + 15 * 60_000 : 0, account.id);
    return res.status(401).json({ error: "信箱或密碼錯誤" });
  }
  await db.run("UPDATE accounts SET failed_count=0,lock_until=0 WHERE id=?", account.id);
  await issueSession(res, account.id);
  res.json({ ok: true });
}));
app.post("/admin/accounts/:id/reset", wrap(async (req, res) => {
  if (!safeId(req.params.id)) return res.status(404).end();
  const account = await db.get("SELECT id,email,name FROM accounts WHERE id=?", req.params.id);
  if (!account) return res.status(404).json({ error: "找不到帳號" });
  const reset = randomBytes(32).toString("base64url");
  await db.run("DELETE FROM password_resets WHERE account_id=?", account.id);
  await db.run("INSERT INTO password_resets (token_hash,account_id,expires_at) VALUES (?,?,?)", digest(reset), account.id, unix() + 60 * 60_000);
  res.json({ reset, email: account.email, name: account.name, expiresAt: unix() + 60 * 60_000 });
}));
app.patch("/admin/accounts/:id/role", wrap(async (req, res) => {
  if (!safeId(req.params.id)) return res.status(404).end();
  const role = req.body?.role as Role;
  if (!roles.includes(role)) return res.status(400).json({ error: "身分格式錯誤" });
  const changed = await transaction(async () => {
    const changed = await db.run("UPDATE accounts SET role=? WHERE id=?", role, req.params.id);
    if (!changed.changes) return false;
    await db.run("UPDATE profiles SET status='changes',published_json=NULL,published_avatar=NULL WHERE account_id=?", req.params.id);
    return true;
  });
  if (!changed) return res.status(404).json({ error: "找不到帳號" });
  res.json({ ok: true });
}));
app.get("/reset/:reset", wrap(async (req, res) => {
  const found = await db.get("SELECT a.name FROM password_resets r JOIN accounts a ON a.id=r.account_id WHERE r.token_hash=? AND r.expires_at>?", digest(req.params.reset), unix());
  if (!found) return res.status(404).json({ error: "重設連結已失效" });
  res.json({ name: found.name });
}));
app.post("/reset", wrap(async (req, res) => {
  const reset = textField(req.body?.reset, 100);
  const password = req.body?.password;
  if (!reset || typeof password !== "string" || password.length < 10 || password.length > 128) return res.status(400).json({ error: "密碼需為 10 至 128 字元" });
  const passwordHash = await hashPassword(password);
  const accountId = await transaction(async () => {
    const found = await db.get("SELECT account_id AS accountId FROM password_resets WHERE token_hash=? AND expires_at>?", digest(reset), unix());
    if (!found) return null;
    await db.run("UPDATE accounts SET password_hash=?,failed_count=0,lock_until=0 WHERE id=?", passwordHash, found.accountId);
    await db.run("DELETE FROM password_resets WHERE account_id=?", found.accountId);
    await db.run("DELETE FROM sessions WHERE account_id=?", found.accountId);
    return found.accountId as number;
  });
  if (!accountId) return res.status(404).json({ error: "重設連結已失效" });
  await issueSession(res, accountId);
  res.json({ ok: true });
}));
app.post("/logout", member, wrap(async (req, res) => {
  const raw = req.headers.cookie?.match(/(?:^|;\s*)member_session=([^;]+)/)?.[1];
  if (raw) await db.run("DELETE FROM sessions WHERE token_hash=?", digest(raw));
  res.setHeader("Set-Cookie", "member_session=; Path=/api/members; HttpOnly; SameSite=Lax; Max-Age=0");
  res.json({ ok: true });
}));
app.get("/me", member, (req, res) => {
  const account = getAccount(req);
  res.json({ id: account.id, email: account.email, name: account.name, role: account.role, roleLabel: roleLabel[account.role as Role],
    status: account.status, profile: account.draftJson ? JSON.parse(account.draftJson) : null,
    avatarUrl: account.draftAvatar || account.publishedAvatar ? "/api/members/me/avatar" : null });
});
app.put("/me", member, wrap(async (req, res) => {
  const profile = safeProfile(req.body);
  if (!profile) return res.status(400).json({ error: "資料格式不正確，請檢查姓名與連結" });
  const account = getAccount(req);
  if (account.role === "alumni" && (!graduationYearOptions.includes(profile.graduationYear) || !profile.graduationTerm || !profile.degree)) return res.status(400).json({ error: "請選擇畢業年份、上／下學期與學位" });
  if (account.role !== "alumni" && !profile.entryYear) return res.status(400).json({ error: "請填寫入學學年度" });
  const publish = profile.publishConsent && account.status !== "hidden";
  const status = account.status === "hidden" ? "hidden" : publish ? "approved" : "private";
  const saved = JSON.stringify(profile);
  await db.run("UPDATE profiles SET draft_json=?,published_json=?,published_avatar=?,status=?,updated_at=? WHERE account_id=?",
    saved, publish ? saved : null, publish && profile.avatarConsent ? account.draftAvatar ?? account.publishedAvatar : null,
    status, unix(), account.id);
  res.json({ ok: true, status });
}));
app.post("/me/avatar", member, express.raw({ type: ["image/jpeg", "image/png", "image/webp"], limit: "5mb" }), wrap(async (req, res) => {
  const account = getAccount(req);
  if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ error: "請上傳 JPEG、PNG 或 WebP 照片" });
  let image: Buffer;
  try {
    const input = sharp(req.body, { limitInputPixels: 25_000_000 });
    const metadata = await input.metadata();
    if (!metadata.width || !metadata.height || metadata.width < 200 || metadata.height < 200 || !["jpeg", "png", "webp"].includes(metadata.format ?? "")) throw new Error("Invalid image");
    image = await input.rotate().resize(640, 640, { fit: "cover", position: "attention" }).webp({ quality: 82 }).toBuffer();
  } catch { return res.status(400).json({ error: "照片格式或尺寸不符；請使用至少 200×200 的 JPEG、PNG 或 WebP" }); }
  const filename = `${randomBytes(16).toString("hex")}.webp`;
  await fs.writeFile(path.join(avatarDir, filename), image, { mode: 0o600 });
  const draft = account.draftJson ? JSON.parse(account.draftJson) as Profile : null;
  const publishAvatar = account.status !== "hidden" && draft?.publishConsent && draft.avatarConsent;
  try {
    await db.run("UPDATE profiles SET draft_avatar=?,published_avatar=?,updated_at=? WHERE account_id=?",
      filename, publishAvatar ? filename : null, unix(), account.id);
  } catch (error) { await fs.unlink(path.join(avatarDir, filename)).catch(() => {}); throw error; }
  for (const old of new Set([account.draftAvatar, account.publishedAvatar].filter(Boolean))) {
    if (old !== filename) await fs.unlink(path.join(avatarDir, old)).catch(() => {});
  }
  res.json({ ok: true, avatarUrl: "/api/members/me/avatar" });
}));
app.delete("/me/avatar", member, wrap(async (req, res) => {
  const account = getAccount(req);
  await db.run("UPDATE profiles SET draft_avatar=NULL,published_avatar=NULL,updated_at=? WHERE account_id=?", unix(), account.id);
  for (const file of new Set([account.draftAvatar, account.publishedAvatar].filter(Boolean))) await fs.unlink(path.join(avatarDir, file)).catch(() => {});
  res.json({ ok: true });
}));
app.get("/me/avatar", member, wrap(async (req, res) => {
  const account = getAccount(req);
  const file = account.draftAvatar || account.publishedAvatar;
  if (!file) return res.status(404).end();
  res.type("image/webp").send(await fs.readFile(path.join(avatarDir, file)));
}));

app.get("/public", wrap(async (_req, res) => {
  const rows = await db.all("SELECT a.id,a.role,p.published_json AS profile,p.published_avatar AS avatar,p.updated_at AS updatedAt FROM profiles p JOIN accounts a ON a.id=p.account_id WHERE p.published_json IS NOT NULL AND p.status <> 'hidden' ORDER BY a.role,a.name");
  res.json({ members: rows.map(row => publicProfile(JSON.parse(row.profile), row, row.avatar, row.updatedAt)) });
}));
app.get("/avatar/:id", wrap(async (req, res) => {
  if (!safeId(req.params.id)) return res.status(404).end();
  const row = await db.get("SELECT published_avatar AS avatar FROM profiles WHERE account_id=? AND published_json IS NOT NULL AND status <> 'hidden'", req.params.id);
  if (!row?.avatar) return res.status(404).end();
  res.type("image/webp").setHeader("Cache-Control", "private, no-store");
  res.send(await fs.readFile(path.join(avatarDir, row.avatar)));
}));
app.get("/admin/profiles", wrap(async (_req, res) => {
  const rows = await db.all("SELECT a.id,a.email,a.name,a.role,p.draft_json AS draftJson,p.status,p.draft_avatar AS draftAvatar,p.published_json AS publishedJson,p.updated_at AS updatedAt FROM accounts a JOIN profiles p ON p.account_id=a.id ORDER BY CASE p.status WHEN 'pending' THEN 0 ELSE 1 END,p.updated_at DESC");
  res.json({ members: rows.map(row => ({ id: row.id, email: row.email, name: row.name, role: row.role, roleLabel: roleLabel[row.role as Role], status: row.status, profile: row.draftJson ? JSON.parse(row.draftJson) : null, hasAvatar: !!row.draftAvatar, published: !!row.publishedJson, updatedAt: row.updatedAt })) });
}));
app.get("/admin/profiles/:id/avatar", wrap(async (req, res) => {
  if (!safeId(req.params.id)) return res.status(404).end();
  const row = await db.get("SELECT draft_avatar AS avatar FROM profiles WHERE account_id=?", req.params.id);
  if (!row?.avatar) return res.status(404).end();
  res.type("image/webp").send(await fs.readFile(path.join(avatarDir, row.avatar)));
}));
app.post("/admin/profiles/:id/restore", wrap(async (req, res) => {
  if (!safeId(req.params.id)) return res.status(404).end();
  const row = await db.get("SELECT draft_json AS draftJson,draft_avatar AS avatar,status FROM profiles WHERE account_id=?", req.params.id);
  if (!row?.draftJson || row.status !== "hidden") return res.status(409).json({ error: "目前沒有暫停公開的資料" });
  const profile = JSON.parse(row.draftJson) as Profile;
  if (!profile.publishConsent) return res.status(409).json({ error: "本人未同意公開" });
  await db.run("UPDATE profiles SET published_json=?,published_avatar=?,status='approved',reviewed_at=?,updated_at=? WHERE account_id=?",
    row.draftJson, profile.avatarConsent ? row.avatar : null, unix(), unix(), req.params.id);
  res.json({ ok: true });
}));
app.post("/admin/profiles/:id/hide", wrap(async (req, res) => {
  if (!safeId(req.params.id)) return res.status(404).end();
  await db.run("UPDATE profiles SET status='hidden',published_json=NULL,published_avatar=NULL,reviewed_at=? WHERE account_id=?", unix(), req.params.id);
  res.json({ ok: true });
}));
app.use((error: any, _req: Request, res: Response, _next: NextFunction) => {
  if (res.headersSent) return;
  if (error?.type === "entity.too.large") return res.status(413).json({ error: "照片不可超過 5 MB" });
  console.error("Member service error:", error instanceof Error ? error.message : "unknown");
  res.status(500).json({ error: "服務暫時無法處理，請稍後再試" });
});
app.listen(Number(process.env.PORT ?? 3002), "0.0.0.0", () => console.log("Member service ready"));
