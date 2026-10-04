import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";

const directory = await mkdtemp(path.join(os.tmpdir(), "hpclab-member-test-"));
const port = 30000 + Math.floor(Math.random() * 20000);
const secret = "test-" + "x".repeat(40);
const child = spawn(process.execPath, ["--import", "tsx", "member-service.ts"], { cwd: process.cwd(), env: { ...process.env, PORT: String(port), MEMBER_DATA_DIR: directory, MEMBER_SERVICE_TOKEN: secret, NODE_ENV: "test" }, stdio: "ignore" });
const base = `http://127.0.0.1:${port}`;
let cookie = "";
async function call(route, method = "GET", body, auth = true) {
  const headers = { ...(auth ? { Authorization: `Bearer ${secret}` } : {}), ...(cookie ? { Cookie: cookie } : {}), ...(body && !Buffer.isBuffer(body) ? { "Content-Type": "application/json" } : {}), ...(Buffer.isBuffer(body) ? { "Content-Type": "image/png" } : {}) };
  const response = await fetch(`${base}${route}`, { method, headers, body: body === undefined ? undefined : Buffer.isBuffer(body) ? body : JSON.stringify(body) });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  const contentType = response.headers.get("content-type") || "";
  return { status: response.status, data: contentType.includes("json") ? await response.json() : await response.arrayBuffer() };
}
try {
  for (let attempt = 0; attempt < 100; attempt++) { try { if ((await fetch(`${base}/health`)).ok) break; } catch {} await new Promise(resolve => setTimeout(resolve, 100)); }
  assert.equal((await call("/public", "GET", undefined, false)).status, 401);
  assert.equal((await call("/admin/invites", "POST", { entries: [{ name: "不接受的分類", email: "other@example.invalid", role: "other" }] })).status, 400);
  const created = await call("/admin/invites", "POST", { entries: [{ name: "測試成員", email: "member@example.invalid", role: "alumni" }] });
  assert.equal(created.status, 201);
  const invite = created.data.invites[0].invite;
  assert.equal((await call(`/invite/${invite}`)).status, 200);
  assert.equal((await call("/activate", "POST", { invite, password: "long-test-password-123" })).status, 201);
  assert.equal((await call("/activate", "POST", { invite, password: "long-test-password-123" })).status, 404);
  assert.equal((await call("/me")).data.email, "member@example.invalid");
  assert.equal((await call("/me")).data.roleLabel, "實驗室畢業學長姊");
  const profile = { displayNameZh: "測試成員", displayNameEn: "Test Member", entryYear: "", graduationYear: "2020", degree: "碩士", interests: ["高效能運算"], bio: "測試資料", affiliation: "", link: "", publishConsent: true, avatarConsent: true, selfAttested: true };
  assert.equal((await call("/me", "PUT", { ...profile, selfAttested: false })).status, 400);
  assert.equal((await call("/me", "PUT", profile)).status, 200);
  assert.equal((await call("/public")).data.members.length, 0);
  const photo = await sharp({ create: { width: 300, height: 300, channels: 3, background: "#4f77ab" } }).png().toBuffer();
  assert.equal((await call("/me/avatar", "POST", photo)).status, 200);
  const list = await call("/admin/profiles");
  assert.equal(list.data.members[0].status, "pending");
  const id = list.data.members[0].id;
  assert.equal((await call(`/admin/profiles/${id}/approve`, "POST")).status, 200);
  const publicData = (await call("/public")).data.members[0];
  assert.equal(publicData.avatarUrl, `/api/members/avatar/${id}`);
  assert.equal(JSON.stringify(publicData).includes("member@example.invalid"), false);
  assert.equal(JSON.stringify(publicData).includes("selfAttested"), false);
  assert.equal((await call(`/avatar/${id}`)).status, 200);
  assert.equal((await call("/me", "PUT", { ...profile, publishConsent: false, avatarConsent: false })).status, 200);
  assert.equal((await call("/public")).data.members.length, 0);
  assert.equal((await call(`/avatar/${id}`)).status, 404);
  assert.equal((await call("/me", "PUT", profile)).status, 200);
  assert.equal((await call(`/admin/profiles/${id}/approve`, "POST")).status, 200);
  assert.equal((await call(`/admin/profiles/${id}/hide`, "POST")).status, 200);
  assert.equal((await call("/public")).data.members.length, 0);
  assert.equal((await call("/me", "PUT", profile)).status, 200);
  assert.equal((await call("/public")).data.members.length, 0);
  assert.equal((await call(`/admin/accounts/${id}/role`, "PATCH", { role: "master2" })).status, 200);
  assert.equal((await call("/me")).data.role, "master2");
  assert.equal((await call("/public")).data.members.length, 0);
  const reset = await call(`/admin/accounts/${id}/reset`, "POST");
  assert.equal(reset.status, 200);
  assert.equal((await call("/reset", "POST", { reset: reset.data.reset, password: "another-long-password-123" })).status, 200);
  assert.equal((await call("/reset", "POST", { reset: reset.data.reset, password: "another-long-password-123" })).status, 404);
  assert.equal((await call("/login", "POST", { email: "member@example.invalid", password: "long-test-password-123" })).status, 401);
  assert.equal((await call("/login", "POST", { email: "member@example.invalid", password: "another-long-password-123" })).status, 200);
  console.log("Member service flow verified: invite, session, consent, avatar, review, hide, reset.");
} finally {
  child.kill();
  await rm(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
