import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const tempRoot = path.resolve(os.tmpdir());
const dataDir = await mkdtemp(path.join(tempRoot, "hpclab-members-test-"));
const token = randomBytes(32).toString("hex");
const port = await new Promise((resolve, reject) => {
  const socket = net.createServer();
  socket.once("error", reject);
  socket.listen(0, "127.0.0.1", () => {
    const address = socket.address();
    socket.close(() => resolve(address.port));
  });
});
const base = `http://127.0.0.1:${port}`;
let service;
let output = "";

async function start() {
  service = spawn(process.execPath, ["--import", "tsx", "member-service.ts"], {
    cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PORT: String(port), MEMBER_DATA_DIR: dataDir, MEMBER_SERVICE_TOKEN: token },
  });
  service.stdout.on("data", chunk => { output += chunk.toString(); });
  service.stderr.on("data", chunk => { output += chunk.toString(); });
  for (let attempt = 0; attempt < 100; attempt++) {
    if (service.exitCode !== null) throw new Error(`Member service stopped: ${output.slice(-1200)}`);
    try { if ((await fetch(`${base}/health`)).ok) return; } catch { /* Starting. */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Member service did not start: ${output.slice(-1200)}`);
}

async function stop() {
  if (!service || service.exitCode !== null) return;
  const exited = new Promise(resolve => service.once("exit", resolve));
  service.kill();
  await exited;
  service = undefined;
}

async function api(route, { method = "GET", body, cookie, expected = 200, contentType = "application/json" } = {}) {
  const response = await fetch(`${base}${route}`, {
    method, headers: {
      Authorization: `Bearer ${token}`,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body ? { "Content-Type": contentType } : {}),
    },
    body: body ? (Buffer.isBuffer(body) ? body : JSON.stringify(body)) : undefined,
  });
  const data = await response.json().catch(() => null);
  assert.equal(response.status, expected, `${method} ${route}: ${JSON.stringify(data)}`);
  return { data, response };
}

const profile = (overrides = {}) => ({
  displayNameZh: "測試成員", displayNameEn: "Test Member", entryYear: "2025",
  graduationYear: "", degree: "", interests: ["高效能運算"], bio: "初次填寫",
  affiliation: "", link: "", background: [
    { kind: "education", organization: "測試高中", detail: "電子科", period: "" },
    { kind: "education", organization: "測試大學", detail: "", period: "" },
  ], publishConsent: true, avatarConsent: false,
  selfAttested: true, ...overrides,
});

try {
  await start();
  const invite = (await api("/admin/invites", {
    method: "POST", expected: 201,
    body: { entries: [{ name: "測試成員", email: "member@example.test", role: "master1" }] },
  })).data.invites[0].invite;
  const activation = await api("/activate", { method: "POST", expected: 201, body: { invite, password: "test-password-2026" } });
  const cookie = activation.response.headers.get("set-cookie").split(";")[0];
  await api("/me", { method: "PUT", cookie, body: profile() });
  let publicList = (await api("/public")).data.members;
  assert.equal(publicList.length, 1, "Consent should publish without admin approval");
  assert.equal(publicList[0].bio, "初次填寫");
  assert.equal(publicList[0].background[0].organization, "測試高中");
  assert.equal(publicList[0].background[1].organization, "測試大學");
  assert.equal(publicList[0].avatarUrl, null);
  assert.ok(!("email" in publicList[0]) && !("publishConsent" in publicList[0]));

  await api("/me", { method: "PUT", cookie, expected: 400, body: profile({ background: [{ kind: "education", organization: "", detail: "", period: "" }] }) });
  await api("/me", { method: "PUT", cookie, expected: 400, body: profile({ background: Array(9).fill({ kind: "education", organization: "測試", detail: "", period: "" }) }) });
  await api("/me", { method: "PUT", cookie, expected: 400, body: profile({ background: [{ kind: "other", organization: "測試", detail: "", period: "" }] }) });
  await api("/me", { method: "PUT", cookie, body: profile({ background: undefined }) });
  assert.deepEqual((await api("/public")).data.members[0].background, [], "Older profiles without background remain valid");

  await api("/me", { method: "PUT", cookie, body: profile({ bio: "本人即時更新", avatarConsent: true }) });
  publicList = (await api("/public")).data.members;
  assert.equal(publicList[0].bio, "本人即時更新");
  const picture = await sharp({ create: { width: 420, height: 420, channels: 3, background: "#123456" } }).png().toBuffer();
  await api("/me/avatar", { method: "POST", cookie, body: picture, contentType: "image/png" });
  publicList = (await api("/public")).data.members;
  assert.match(publicList[0].avatarUrl, /^\/api\/members\/avatar\/1\?v=\d+$/);
  const avatar = await fetch(`${base}${publicList[0].avatarUrl.replace("/api/members", "")}`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(avatar.status, 200);
  assert.equal(avatar.headers.get("cache-control"), "private, no-store");
  const image = await sharp(Buffer.from(await avatar.arrayBuffer())).metadata();
  assert.equal(image.format, "webp");
  assert.equal(image.width, 640);
  assert.equal(image.height, 640);

  await api("/me", { method: "PUT", cookie, body: profile({ publishConsent: false, avatarConsent: true }) });
  assert.equal((await api("/public")).data.members.length, 0, "Consent withdrawal should immediately unpublish");
  await api("/me", { method: "PUT", cookie, body: profile({ avatarConsent: false }) });
  assert.equal((await api("/public")).data.members[0].avatarUrl, null, "Avatar needs separate consent");
  await api("/me", { method: "PUT", cookie, body: profile({ avatarConsent: true }) });
  assert.ok((await api("/public")).data.members[0].avatarUrl);

  await api("/admin/profiles/1/hide", { method: "POST" });
  assert.equal((await api("/public")).data.members.length, 0);
  await api("/me", { method: "PUT", cookie, body: profile({ bio: "撤下期間更新", avatarConsent: true }) });
  assert.equal((await api("/public")).data.members.length, 0, "Admin hide should survive a member edit");
  await api("/admin/profiles/1/restore", { method: "POST" });
  assert.equal((await api("/public")).data.members[0].bio, "撤下期間更新");

  await stop();
  const db = await open({ filename: path.join(dataDir, "members.sqlite"), driver: sqlite3.Database });
  await db.run("UPDATE profiles SET status='pending',published_json=NULL,published_avatar=NULL WHERE account_id=1");
  await db.close();
  await start();
  assert.equal((await api("/public")).data.members[0].bio, "撤下期間更新", "Legacy pending consent should migrate on startup");

  const alumniInvite = (await api("/admin/invites", {
    method: "POST", expected: 201,
    body: { entries: [{ name: "畢業成員", email: "alumni@example.test", role: "alumni" }] },
  })).data.invites[0].invite;
  const alumniActivation = await api("/activate", { method: "POST", expected: 201, body: { invite: alumniInvite, password: "alumni-password-2026" } });
  const alumniCookie = alumniActivation.response.headers.get("set-cookie").split(";")[0];
  const alumniProfile = { entryYear: "", graduationYear: String(new Date().getFullYear()), graduationTerm: "下", degree: "碩士" };
  await api("/me", { method: "PUT", cookie: alumniCookie, expected: 400, body: profile({ ...alumniProfile, graduationYear: "待確認" }) });
  await api("/me", { method: "PUT", cookie: alumniCookie, expected: 400, body: profile({ ...alumniProfile, graduationTerm: "春" }) });
  await api("/me", { method: "PUT", cookie: alumniCookie, expected: 400, body: profile({ ...alumniProfile, graduationTerm: "" }) });
  await api("/me", { method: "PUT", cookie: alumniCookie, body: profile(alumniProfile) });
  const publishedAlumni = (await api("/public")).data.members.find(member => member.role === "alumni");
  assert.equal(publishedAlumni.graduationYear, alumniProfile.graduationYear);
  assert.equal(publishedAlumni.graduationTerm, "下");
  console.log("member publishing: consent, avatar, background, hide/restore, migration, graduation choices passed");
} finally {
  await stop();
  const target = path.resolve(dataDir);
  if (path.dirname(target) !== tempRoot || !path.basename(target).startsWith("hpclab-members-test-")) {
    throw new Error("Unexpected test directory; refusing cleanup");
  }
  await rm(target, { recursive: true, force: true });
}
