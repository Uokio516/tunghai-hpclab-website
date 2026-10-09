import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { PageShell } from "../layout/PageShell";
import { localizedInterest } from "../../lib/memberProfiles";
import { localizedServerError, useLocale } from "../../lib/locale";

type Role = "master1" | "master2" | "alumni";
type Invite = { name: string; email: string; role: Role; invite: string; expiresAt: number };
type Member = {
  id: number; name: string; email: string; role: Role; roleLabel: string; status: string;
  profile: { displayNameZh: string; entryYear: string; graduationYear: string; graduationTerm?: string; degree: string; interests: string[]; bio: string; affiliation: string; link: string; publishConsent: boolean; avatarConsent: boolean } | null;
  hasAvatar: boolean; published: boolean; updatedAt: number | null;
};

export function MemberAdminPage() {
  const { language, t } = useLocale();
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
  const roles: { value: Role; label: string }[] = [
    { value: "master1", label: t("碩一", "Master's Year 1") },
    { value: "master2", label: t("碩二", "Master's Year 2") },
    { value: "alumni", label: t("實驗室畢業學長姊", "Alumni") },
  ];
  const statuses: Record<string, string> = {
    draft: t("尚未填寫", "Not completed"), pending: t("資料處理中", "Processing"),
    approved: t("已公開", "Published"), private: t("不公開", "Private"),
    changes: t("待本人更新", "Update needed"), hidden: t("已暫停公開", "Publication paused"),
  };
  const call = async (path: string, method = "GET", body?: unknown) => {
    const response = await fetch(`/api/members/admin/${path}`, {
      method, cache: "no-store",
      headers: { "X-Admin-Password": password, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(response.status === 401
      ? t("管理密碼錯誤或未設定", "Admin password is incorrect or not configured")
      : localizedServerError(data.error || t("操作失敗", "Action failed"), language));
    return data;
  };
  const refresh = async () => { const data = await call("profiles"); setMembers(data.members); };
  const authenticate = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try { await refresh(); } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  };
  const createInvite = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const data = await call("invites", "POST", { entries: [{ name, email, role }] });
      setInvites(data.invites); setName(""); setEmail("");
      setNotice(t("邀請已建立。請複製連結並由你自行發給本人；離開此頁後不再顯示完整連結。", "Invitation created. Copy and send the link to the member yourself; the full link will disappear when you leave this page."));
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  };
  const manageVisibility = async (member: Member, action: "hide" | "restore") => {
    const message = action === "restore"
      ? t(`確定恢復公開 ${member.name} 已同意刊登的資料？`, `Restore ${member.name}'s previously approved public profile?`)
      : t(`確定立即撤下 ${member.name} 的公開資料與照片？`, `Immediately remove ${member.name}'s public profile and photo?`);
    if (!confirm(message)) return;
    setBusy(true); setError("");
    try {
      await call(`profiles/${member.id}/${action}`, "POST"); await refresh();
      setNotice(action === "restore" ? t("已恢復公開。", "Profile restored.") : t("已撤下公開資料。", "Public profile removed."));
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  };
  const resetPassword = async (member: Member) => {
    if (!confirm(t(`已透過其他方式核對 ${member.name} 的身分，並要產生一次性密碼重設連結？`, `Have you verified ${member.name}'s identity through another channel and want to generate a one-time password reset link?`))) return;
    try {
      const data = await call(`accounts/${member.id}/reset`, "POST");
      setResetLink({ name: data.name, email: data.email, url: `${window.location.origin}/member/reset/${data.reset}` });
      setNotice(t("重設連結有效一小時。請自行透過已核對的管道發給本人。", "The reset link is valid for one hour. Send it through the verified channel yourself."));
    } catch (err) { setError((err as Error).message); }
  };
  const changeRole = async (member: Member, nextRole: Role) => {
    if (nextRole === member.role) return;
    if (!confirm(t(`確定變更 ${member.name} 的身分？公開資料會先撤下，待本人更新資料後自行重新公開。`, `Change ${member.name}'s role? Their public profile will be removed until they update and republish it.`))) return;
    try {
      await call(`accounts/${member.id}/role`, "PATCH", { role: nextRole }); await refresh();
      setNotice(t("身分已更新，原公開資料已撤下。請通知本人補齊資料。", "Role updated and public profile removed. Ask the member to update their information."));
    } catch (err) { setError((err as Error).message); }
  };
  const copyLink = (url: string, reset = false) => navigator.clipboard.writeText(url).then(
    () => setNotice(reset ? t("重設連結已複製。", "Reset link copied.") : t("連結已複製。", "Link copied.")),
    () => setError(t("無法自動複製，請選取連結手動複製。", "Could not copy automatically. Select and copy the link manually.")),
  );

  return <PageShell eyebrow="Member Management" title={t("成員名冊管理", "Member Management")} lede={t("建立個別邀請、管理成員身分與公開狀態；成員同意公開後可自行更新資料。", "Create invitations and manage member roles and publication status. Members can update their own profiles after consenting to publication.")}>
    <section className="member-shell member-shell-wide">
      {members === null ? <form className="member-panel member-form" onSubmit={authenticate}>
        <label>{t("網站管理密碼", "Admin password")}<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required /></label>
        <button className="member-primary" disabled={busy}>{busy ? t("確認中…", "Checking…") : t("進入管理", "Open management")}</button>
        {error && <p role="alert" className="member-error">{error}</p>}
      </form> : <>
        <div className="member-account-line"><span>{t("成員名冊", "Member directory")} · {members.length} {t("個帳號", "accounts")}</span><Link to="/admin">{t("聯絡訊息後台", "Contact messages")}</Link></div>
        <form onSubmit={createInvite} className="member-panel member-form">
          <h2>{t("新增一位成員", "Add a member")}</h2>
          <p className="member-hint">{t("只需最小名冊：姓名、聯絡信箱，以及碩一、碩二或實驗室畢業學長姊。其餘資料由本人填寫；不需要先蒐齊全部歷屆名單。", "Start with a name, contact email and role. Members fill in the rest themselves; you do not need a complete historical roster first.")}</p>
          <div className="member-form-grid">
            <label>{t("姓名", "Name")}<input required maxLength={40} value={name} onChange={event => setName(event.target.value)} /></label>
            <label>{t("聯絡信箱", "Contact email")}<input required type="email" value={email} onChange={event => setEmail(event.target.value)} /></label>
            <label>{t("身分", "Role")}<select value={role} onChange={event => setRole(event.target.value as Role)}>{roles.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          </div>
          <button className="member-primary" disabled={busy}>{t("產生一次性邀請連結", "Create one-time invitation")}</button>
        </form>
        {invites.length > 0 && <div className="member-panel"><h2>{t("請複製並自行發送", "Copy and send the links")}</h2>{invites.map(item => {
          const url = `${window.location.origin}/join/${item.invite}`;
          return <div className="member-invite-result" key={item.invite}><strong>{item.name} · {item.email}</strong><input aria-label={t(`${item.name} 的邀請連結`, `Invitation link for ${item.name}`)} readOnly value={url} onFocus={event => event.target.select()} /><button type="button" onClick={() => copyLink(url)}>{t("複製連結", "Copy link")}</button><small>{t("有效至", "Valid until")} {new Date(item.expiresAt).toLocaleDateString(language)}</small></div>;
        })}</div>}
        {resetLink && <div className="member-panel member-invite-result"><strong>{resetLink.name} · {resetLink.email} {t("的密碼重設連結", "password reset link")}</strong><input aria-label={t("密碼重設連結", "Password reset link")} readOnly value={resetLink.url} onFocus={event => event.target.select()} /><button type="button" onClick={() => copyLink(resetLink.url, true)}>{t("複製連結", "Copy link")}</button></div>}
        {error && <p role="alert" className="member-error">{error}</p>}{notice && <p role="status" className="member-success">{notice}</p>}
        <div className="member-admin-heading"><h2>{t("成員資料", "Member profiles")}</h2><button type="button" className="member-text-button" onClick={() => refresh().catch(err => setError(err.message))}>{t("重新整理", "Refresh")}</button></div>
        {members.length ? <div className="member-review-grid">{members.map(item => <article className="member-panel member-review" key={item.id}>
          <div className="member-review-head"><div><h3>{item.profile?.displayNameZh || item.name}</h3><p>{roles.find(option => option.value === item.role)?.label || item.roleLabel} · {item.email}</p></div><span>{statuses[item.status] || item.status}</span></div>
          <label className="member-role-control">{t("成員身分", "Member role")} <select value={item.role} onChange={event => changeRole(item, event.target.value as Role)}>{roles.map(option => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
          {item.profile ? <>
            <p>{[item.profile.entryYear && `${t("入學", "Joined")} ${item.profile.entryYear}`, item.profile.graduationYear && `${t("畢業", "Graduated")} ${item.profile.graduationYear}`, item.profile.degree, item.profile.affiliation].filter(Boolean).join(" · ")}</p>
            <p>{item.profile.interests.map(interest => localizedInterest(interest, language)).join(" · ")}</p><p>{item.profile.bio}</p>
            {item.profile.link && <a href={item.profile.link} target="_blank" rel="noopener noreferrer">{t("個人連結 ↗", "Personal link ↗")}</a>}
            <p className="member-hint">{t("資料公開", "Profile publication")}: {item.profile.publishConsent ? t("同意", "Consented") : t("未同意", "Not consented")} · {t("頭像公開", "Photo publication")}: {item.profile.avatarConsent ? t("同意", "Consented") : t("未同意", "Not consented")}</p>
            {item.hasAvatar && <PrivateAvatar id={item.id} password={password} />}
          </> : <p className="member-hint">{t("尚未提交資料", "No profile submitted")}</p>}
          <div className="member-review-actions">{item.status === "hidden" && item.profile?.publishConsent && <button disabled={busy} onClick={() => manageVisibility(item, "restore")}>{t("恢復公開", "Restore profile")}</button>}{item.published && <button disabled={busy} onClick={() => manageVisibility(item, "hide")}>{t("立即撤下", "Remove now")}</button>}<button disabled={busy} onClick={() => resetPassword(item)}>{t("重設密碼", "Reset password")}</button></div>
        </article>)}</div> : <div className="member-panel">{t("目前沒有成員帳號。建立邀請後，成員自行啟用與填寫。", "There are no member accounts yet. Create an invitation so members can activate and complete their profiles.")}</div>}
      </>}
    </section>
  </PageShell>;
}

function PrivateAvatar({ id, password }: { id: number; password: string }) {
  const { t } = useLocale();
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const load = async () => {
    try {
      const response = await fetch(`/api/members/admin/profiles/${id}/avatar`, { headers: { "X-Admin-Password": password }, cache: "no-store" });
      if (!response.ok) throw new Error(t("頭像載入失敗", "Could not load photo"));
      setUrl(URL.createObjectURL(await response.blob()));
    } catch (err) { setError((err as Error).message); }
  };
  return <div className="member-review-avatar">{url ? <img src={url} alt={t("成員頭像", "Member photo")} onLoad={() => URL.revokeObjectURL(url)} /> : <button type="button" onClick={load}>{t("預覽上傳頭像", "Preview uploaded photo")}</button>}{error && <span role="alert">{error}</span>}</div>;
}
