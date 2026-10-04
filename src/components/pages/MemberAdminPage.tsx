import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { PageShell } from "../layout/PageShell";

type Role = "master1" | "master2" | "alumni";
type Invite = { name: string; email: string; role: Role; invite: string; expiresAt: number };
type Member = { id: number; name: string; email: string; role: Role; roleLabel: string; status: string; profile: { displayNameZh: string; entryYear: string; graduationYear: string; degree: string; interests: string[]; bio: string; affiliation: string; link: string; publishConsent: boolean; avatarConsent: boolean } | null; hasAvatar: boolean; published: boolean; updatedAt: number | null };
const roles: { value: Role; label: string }[] = [{ value: "master1", label: "碩一" }, { value: "master2", label: "碩二" }, { value: "alumni", label: "實驗室畢業學長姊" }];
const status: Record<string, string> = { draft: "尚未填寫", pending: "待審核", approved: "已公開", private: "不公開", changes: "需修改", hidden: "已暫停公開" };

export function MemberAdminPage() {
  const [password, setPassword] = useState("");
  const [members, setMembers] = useState<Member[] | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("master1");
  const [invites, setInvites] = useState<Invite[]>([]);
  const [resetLink, setResetLink] = useState<{ name: string; email: string; url: string } | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const call = async (path: string, method = "GET", body?: unknown) => {
    const response = await fetch(`/api/members/admin/${path}`, { method, cache: "no-store", headers: { "X-Admin-Password": password, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(response.status === 401 ? "管理密碼錯誤或未設定" : data.error || "操作失敗");
    return data;
  };
  const refresh = async () => { const data = await call("profiles"); setMembers(data.members); };
  const authenticate = async (event: FormEvent) => { event.preventDefault(); setBusy(true); setError(""); try { await refresh(); } catch (err) { setError((err as Error).message); } finally { setBusy(false); } };
  const createInvite = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try { const data = await call("invites", "POST", { entries: [{ name, email, role }] }); setInvites(data.invites); setName(""); setEmail(""); setNotice("邀請已建立。請複製連結並由你自行發給本人；離開此頁後不再顯示完整連結。"); }
    catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  };
  const review = async (member: Member, action: "approve" | "hide" | "request-changes") => {
    if (action === "approve" && !confirm(`確定公開 ${member.name} 已同意刊登的資料？`)) return;
    if (action === "hide" && !confirm(`確定立即撤下 ${member.name} 的公開資料與照片？`)) return;
    setBusy(true); setError("");
    try { await call(`profiles/${member.id}/${action}`, "POST"); await refresh(); setNotice(action === "approve" ? "已核准公開。" : action === "hide" ? "已撤下公開資料。" : "已標記為需修改，請另行通知本人。"); }
    catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  };
  const resetPassword = async (member: Member) => { if (!confirm(`已透過其他方式核對 ${member.name} 的身分，並要產生一次性密碼重設連結？`)) return; try { const data = await call(`accounts/${member.id}/reset`, "POST"); setResetLink({ name: data.name, email: data.email, url: `${window.location.origin}/member/reset/${data.reset}` }); setNotice("重設連結有效一小時。請自行透過已核對的管道發給本人。"); } catch (err) { setError((err as Error).message); } };
  const changeRole = async (member: Member, nextRole: Role) => { if (nextRole === member.role) return; if (!confirm(`確定變更 ${member.name} 的身分？公開資料會先撤下，待本人更新與重新審核。`)) return; try { await call(`accounts/${member.id}/role`, "PATCH", { role: nextRole }); await refresh(); setNotice("身分已更新，原公開資料已撤下。請通知本人補齊資料。"); } catch (err) { setError((err as Error).message); } };
  return <PageShell eyebrow="Member Management" title="成員名冊管理" lede="建立個別邀請、核對本人資料與公開同意，再決定哪些內容顯示在官網。">
    <section className="member-shell member-shell-wide">
      {members === null ? <form className="member-panel member-form" onSubmit={authenticate}><label>網站管理密碼<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required /></label><button className="member-primary" disabled={busy}>{busy ? "確認中…" : "進入管理"}</button>{error && <p role="alert" className="member-error">{error}</p>}</form> : <>
        <div className="member-account-line"><span>成員名冊 · {members.length} 個帳號</span><Link to="/admin">聯絡訊息後台</Link></div>
        <form onSubmit={createInvite} className="member-panel member-form"><h2>新增一位成員</h2><p className="member-hint">只需最小名冊：姓名、聯絡信箱，以及碩一、碩二或實驗室畢業學長姊。其餘資料由本人填寫；不需要先蒐齊全部歷屆名單。</p><div className="member-form-grid"><label>姓名<input required maxLength={40} value={name} onChange={event => setName(event.target.value)} /></label><label>聯絡信箱<input required type="email" value={email} onChange={event => setEmail(event.target.value)} /></label><label>身分<select value={role} onChange={event => setRole(event.target.value as Role)}>{roles.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label></div><button className="member-primary" disabled={busy}>產生一次性邀請連結</button></form>
        {invites.length > 0 && <div className="member-panel"><h2>請複製並自行發送</h2>{invites.map(item => { const url = `${window.location.origin}/join/${item.invite}`; return <div className="member-invite-result" key={item.invite}><strong>{item.name} · {item.email}</strong><input aria-label={`${item.name} 的邀請連結`} readOnly value={url} onFocus={event => event.target.select()} /><button type="button" onClick={() => navigator.clipboard.writeText(url).then(() => setNotice("連結已複製。"), () => setError("無法自動複製，請選取連結手動複製。"))}>複製連結</button><small>有效至 {new Date(item.expiresAt).toLocaleDateString("zh-TW")}</small></div>; })}</div>}
        {resetLink && <div className="member-panel member-invite-result"><strong>{resetLink.name} · {resetLink.email} 的密碼重設連結</strong><input aria-label="密碼重設連結" readOnly value={resetLink.url} onFocus={event => event.target.select()} /><button type="button" onClick={() => navigator.clipboard.writeText(resetLink.url).then(() => setNotice("重設連結已複製。"), () => setError("無法自動複製，請手動複製。"))}>複製連結</button></div>}
        {error && <p role="alert" className="member-error">{error}</p>}{notice && <p role="status" className="member-success">{notice}</p>}
        <div className="member-admin-heading"><h2>資料審核</h2><button type="button" className="member-text-button" onClick={() => refresh().catch(err => setError(err.message))}>重新整理</button></div>
        {members.length ? <div className="member-review-grid">{members.map(item => <article className="member-panel member-review" key={item.id}><div className="member-review-head"><div><h3>{item.profile?.displayNameZh || item.name}</h3><p>{item.roleLabel} · {item.email}</p></div><span>{status[item.status] || item.status}</span></div><label className="member-role-control">成員身分 <select value={item.role} onChange={event => changeRole(item, event.target.value as Role)}>{roles.map(option => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>{item.profile ? <><p>{[item.profile.entryYear && `入學 ${item.profile.entryYear}`, item.profile.graduationYear && `畢業 ${item.profile.graduationYear}`, item.profile.degree, item.profile.affiliation].filter(Boolean).join(" · ")}</p><p>{item.profile.interests.join(" · ")}</p><p>{item.profile.bio}</p>{item.profile.link && <a href={item.profile.link} target="_blank" rel="noopener noreferrer">個人連結 ↗</a>}<p className="member-hint">資料公開：{item.profile.publishConsent ? "同意" : "未同意"} · 頭像公開：{item.profile.avatarConsent ? "同意" : "未同意"}</p>{item.hasAvatar && <PrivateAvatar id={item.id} password={password} />}</> : <p className="member-hint">尚未提交資料</p>}<div className="member-review-actions">{item.status === "pending" && <><button disabled={busy} onClick={() => review(item, "approve")}>核准公開</button><button disabled={busy} onClick={() => review(item, "request-changes")}>需修改</button></>}{item.published && <button disabled={busy} onClick={() => review(item, "hide")}>立即撤下</button>}<button disabled={busy} onClick={() => resetPassword(item)}>重設密碼</button></div></article>)}</div> : <div className="member-panel">目前沒有成員帳號。建立邀請後，成員自行啟用與填寫。</div>}
      </>}
    </section>
  </PageShell>;
}

function PrivateAvatar({ id, password }: { id: number; password: string }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const load = async () => { try { const response = await fetch(`/api/members/admin/profiles/${id}/avatar`, { headers: { "X-Admin-Password": password }, cache: "no-store" }); if (!response.ok) throw new Error("頭像載入失敗"); setUrl(URL.createObjectURL(await response.blob())); } catch (err) { setError((err as Error).message); } };
  return <div className="member-review-avatar">{url ? <img src={url} alt="待審頭像" onLoad={() => URL.revokeObjectURL(url)} /> : <button type="button" onClick={load}>預覽上傳頭像</button>}{error && <span role="alert">{error}</span>}</div>;
}
