import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PageShell } from "../layout/PageShell";
import { AvatarCropDialog } from "../AvatarCropDialog";

type Role = "master1" | "master2" | "alumni";
type Profile = {
  displayNameZh: string; displayNameEn: string; entryYear: string; graduationYear: string;
  degree: string; interests: string[]; bio: string; affiliation: string; link: string;
  publishConsent: boolean; avatarConsent: boolean; selfAttested: boolean;
};
type Account = { id: number; email: string; name: string; role: Role; roleLabel: string; status: string; profile: Profile | null; avatarUrl: string | null };
const emptyProfile = (name: string): Profile => ({ displayNameZh: name, displayNameEn: "", entryYear: "", graduationYear: "", degree: "", interests: [], bio: "", affiliation: "", link: "", publishConsent: false, avatarConsent: false, selfAttested: false });
const topics = ["高效能運算", "雲端／分散式系統", "AI／LLM", "大數據", "AIoT／邊緣運算"];
const statusText: Record<string, string> = { draft: "尚未填寫", pending: "資料處理中", approved: "已公開", private: "僅自己與實驗室可見", changes: "請更新資料", hidden: "暫停公開" };
async function reply(response: Response) { const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || "操作失敗，請稍後再試"); return data; }

export function MemberJoinPage() {
  const { invite } = useParams();
  const navigate = useNavigate();
  const [preview, setPreview] = useState<{ email: string; name: string; roleLabel: string } | null>(null);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!invite) return; fetch(`/api/members/invite/${encodeURIComponent(invite)}`, { cache: "no-store" }).then(reply).then(setPreview).catch(error => setError(error.message)); }, [invite]);
  const activate = async (event: FormEvent) => {
    event.preventDefault(); setError("");
    if (password !== confirmation) return setError("兩次密碼不一致");
    setBusy(true);
    try { await reply(await fetch("/api/members/activate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ invite, password }) })); navigate("/member/me", { replace: true }); }
    catch (error) { setError((error as Error).message); } finally { setBusy(false); }
  };
  return <PageShell eyebrow="Member Invitation" title="啟用成員帳號" lede="這是由實驗室個別發出的邀請。請自行設定密碼，之後可登入更新資料與頭像。">
    <section className="member-shell">
      {preview ? <form onSubmit={activate} className="member-panel member-form">
        <div className="member-invite-person"><strong>{preview.name}</strong><span>{preview.roleLabel} · {preview.email}</span></div>
        <label>設定密碼（至少 10 字元）<input type="password" autoComplete="new-password" minLength={10} maxLength={128} required value={password} onChange={event => setPassword(event.target.value)} /></label>
        <label>再次輸入密碼<input type="password" autoComplete="new-password" minLength={10} required value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label>
        <p className="member-hint">邀請連結只可使用一次，請勿轉傳。帳號啟用後，由你決定是否將資料公開於研究成員頁。</p>
        {error && <p role="alert" className="member-error">{error}</p>}
        <button disabled={busy} className="member-primary">{busy ? "啟用中…" : "啟用並開始填寫"}</button>
      </form> : <div className="member-panel">{error ? <p role="alert" className="member-error">{error}。請向實驗室索取新的邀請連結。</p> : "正在確認邀請…"}</div>}
    </section>
  </PageShell>;
}

export function MemberLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const login = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try { await reply(await fetch("/api/members/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) })); navigate("/member/me", { replace: true }); }
    catch (error) { setError((error as Error).message); } finally { setBusy(false); }
  };
  return <PageShell eyebrow="Member Sign In" title="成員登入" lede="已收到邀請並啟用帳號的碩一、碩二與實驗室畢業學長姊，可以在這裡更新資料。">
    <section className="member-shell"><form onSubmit={login} className="member-panel member-form">
      <label>聯絡信箱<input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} /></label>
      <label>密碼<input type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} /></label>
      {error && <p role="alert" className="member-error">{error}</p>}
      <button disabled={busy} className="member-primary">{busy ? "登入中…" : "登入"}</button>
      <p className="member-hint">尚未收到邀請？請透過 <Link to="/contact">聯絡我們</Link> 核對身分；網站不開放自行註冊。</p>
    </form></section>
  </PageShell>;
}

export function MemberResetPage() {
  const { reset } = useParams();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!reset) return; fetch(`/api/members/reset/${encodeURIComponent(reset)}`, { cache: "no-store" }).then(reply).then(data => setName(data.name)).catch(err => setError(err.message)); }, [reset]);
  const submit = async (event: FormEvent) => { event.preventDefault(); if (password !== confirmation) return setError("兩次密碼不一致"); setBusy(true); setError(""); try { await reply(await fetch("/api/members/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reset, password }) })); navigate("/member/me", { replace: true }); } catch (err) { setError((err as Error).message); } finally { setBusy(false); } };
  return <PageShell eyebrow="Password Reset" title="重設成員密碼" lede="由實驗室核對身分後發出的重設連結，有效一小時且只能使用一次。"><section className="member-shell">{name ? <form className="member-panel member-form" onSubmit={submit}><strong>{name}</strong><label>新密碼（至少 10 字元）<input type="password" autoComplete="new-password" minLength={10} maxLength={128} required value={password} onChange={event => setPassword(event.target.value)} /></label><label>再次輸入新密碼<input type="password" autoComplete="new-password" minLength={10} required value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label>{error && <p role="alert" className="member-error">{error}</p>}<button className="member-primary" disabled={busy}>設定新密碼</button></form> : <div className="member-panel">{error || "正在確認重設連結…"}</div>}</section></PageShell>;
}

export function MemberProfilePage() {
  const navigate = useNavigate();
  const [account, setAccount] = useState<Account | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [cropSource, setCropSource] = useState<File | null>(null);
  const [originalPhoto, setOriginalPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!photo) { setPhotoPreview(null); return; } const url = URL.createObjectURL(photo); setPhotoPreview(url); return () => URL.revokeObjectURL(url); }, [photo]);
  useEffect(() => { fetch("/api/members/me", { cache: "no-store" }).then(response => response.status === 401 ? (navigate("/member/login", { replace: true }), null) : reply(response)).then((data: Account | null) => { if (data) { setAccount(data); setProfile(data.profile ?? emptyProfile(data.name)); } }).catch(error => setError(error.message)); }, [navigate]);
  const change = (key: keyof Profile, value: string | boolean | string[]) => setProfile(current => current ? { ...current, [key]: value } : current);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (!profile) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await reply(await fetch("/api/members/me", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(profile) }));
      if (photo) await reply(await fetch("/api/members/me/avatar", { method: "POST", headers: { "Content-Type": photo.type }, body: photo }));
      setPhoto(null); setOriginalPhoto(null);
      const updated = await reply(await fetch("/api/members/me", { cache: "no-store" }));
      setAccount({ ...updated, avatarUrl: updated.avatarUrl ? `${updated.avatarUrl}?v=${Date.now()}` : null });
      setNotice(updated.status === "hidden" ? "資料已儲存；此帳號目前暫停公開，請聯絡實驗室。" : profile.publishConsent ? "資料已更新，研究成員頁將立即顯示最新內容。" : "資料已儲存為私人資料，網站不會刊登。");
    } catch (error) { setError((error as Error).message); } finally { setBusy(false); }
  };
  const logout = async () => { await fetch("/api/members/logout", { method: "POST" }); navigate("/member/login", { replace: true }); };
  const removeAvatar = async () => { if (!confirm("確定要移除頭像？公開頁面的照片也會立即撤下。")) return; try { await reply(await fetch("/api/members/me/avatar", { method: "DELETE" })); setPhoto(null); setOriginalPhoto(null); setAccount(current => current ? { ...current, avatarUrl: null } : current); setNotice("頭像已移除。"); } catch (error) { setError((error as Error).message); } };
  const choosePhoto = (file: File | null) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setPhotoError("請選擇 JPEG、PNG 或 WebP 照片。"); return; }
    if (file.size > 5 * 1024 * 1024) { setPhotoError("照片不可超過 5 MB。"); return; }
    setPhotoError("");
    setError("");
    setNotice("");
    setCropSource(file);
  };
  return <PageShell eyebrow="Member Profile" title="我的成員資料" lede="你可以隨時更新資料；勾選公開同意並儲存後，研究成員頁會立即更新。">
    <section className="member-shell member-shell-wide">
      {!account || !profile ? <div className="member-panel">{error ? <p role="alert" className="member-error">{error}</p> : "正在讀取資料…"}</div> : <>
        <div className="member-account-line"><span>{account.name} · {account.roleLabel} · {account.email}</span><button type="button" onClick={logout}>登出</button></div>
        <div className="member-status">目前狀態：<strong>{statusText[account.status] ?? account.status}</strong></div>
        <form onSubmit={submit} className="member-panel member-form">
          <h2>基本資料</h2><div className="member-form-grid">
            <label>中文顯示姓名 <b>*</b><input required maxLength={40} value={profile.displayNameZh} onChange={event => change("displayNameZh", event.target.value)} /></label>
            <label>英文姓名（選填）<input maxLength={80} value={profile.displayNameEn} onChange={event => change("displayNameEn", event.target.value)} /></label>
            {account.role === "alumni" ? <><label>畢業年度 <b>*</b><input required placeholder="例如 2020，或填待確認" maxLength={12} value={profile.graduationYear} onChange={event => change("graduationYear", event.target.value)} /></label><label>學位 <b>*</b><select required value={profile.degree} onChange={event => change("degree", event.target.value)}><option value="">請選擇</option><option>碩士</option><option>博士</option><option>學士</option><option>其他／待確認</option></select></label></> : <label>入學學年度 <b>*</b><input required placeholder="例如 2025" maxLength={12} value={profile.entryYear} onChange={event => change("entryYear", event.target.value)} /></label>}
            <label>目前單位／職稱（選填）<input maxLength={80} value={profile.affiliation} onChange={event => change("affiliation", event.target.value)} /></label>
          </div>
          <h2>網站展示</h2><fieldset><legend>研究方向（最多 3 項）</legend><div className="member-topic-list">{topics.map(topic => <label key={topic}><input type="checkbox" checked={profile.interests.includes(topic)} onChange={event => change("interests", event.target.checked ? [...profile.interests, topic].slice(0, 3) : profile.interests.filter(value => value !== topic))} />{topic}</label>)}</div></fieldset>
          <label>一句自我介紹（選填，120 字以內）<textarea rows={3} maxLength={120} value={profile.bio} onChange={event => change("bio", event.target.value)} /></label>
          <label>個人網站／GitHub／LinkedIn（選填）<input type="url" placeholder="https://" maxLength={200} value={profile.link} onChange={event => change("link", event.target.value)} /></label>
          <div className="member-photo">
            <div className="member-photo-preview">{photoPreview ? <img src={photoPreview} alt="裁切後的新頭像預覽" /> : account.avatarUrl ? <img src={account.avatarUrl} alt="目前頭像" /> : <span>{profile.displayNameZh.slice(0, 1) || "人"}</span>}</div>
            <div className="member-photo-content">
              <strong>頭像照片（選填）</strong>
              <p className="member-hint">點選照片後可移動、縮放裁切框，確認後再按頁面底部的儲存按鈕上傳。</p>
              <input ref={photoInputRef} className="member-photo-input" type="file" accept="image/jpeg,image/png,image/webp" aria-label="選擇頭像照片" onChange={event => { choosePhoto(event.target.files?.[0] ?? null); event.target.value = ""; }} />
              <div className="member-photo-actions">
                <button type="button" className="member-photo-choose" onClick={() => photoInputRef.current?.click()}>{photo || account.avatarUrl ? "選擇新照片" : "選擇照片並裁切"}</button>
                {photo && originalPhoto && <button type="button" className="member-text-button" onClick={() => setCropSource(originalPhoto)}>重新裁切</button>}
                {photo && <button type="button" className="member-text-button" onClick={() => { setPhoto(null); setOriginalPhoto(null); }}>取消新照片</button>}
                {account.avatarUrl && <button type="button" className="member-text-button" onClick={removeAvatar}>移除已上傳頭像</button>}
              </div>
              {photoError && <p className="member-error" role="alert">{photoError}</p>}
              <p className="member-hint">{photo ? "已完成裁切，按下方儲存按鈕後才會上傳。" : "支援 JPEG、PNG、WebP；原圖至少 200×200、最多 5 MB。"}</p>
            </div>
          </div>
          <h2>公開同意</h2><label className="member-check"><input type="checkbox" checked={profile.publishConsent} onChange={event => change("publishConsent", event.target.checked)} />我同意將上述顯示資料刊登於官網；儲存後立即更新，取消勾選並儲存會立即撤下。</label>
          <label className="member-check"><input type="checkbox" checked={profile.avatarConsent} onChange={event => change("avatarConsent", event.target.checked)} />我另行同意公開我上傳的頭像；未勾選時照片不會出現在官網。</label>
          <label className="member-check"><input type="checkbox" required checked={profile.selfAttested} onChange={event => change("selfAttested", event.target.checked)} />以上資料由本人提供或已取得當事人同意；我了解勾選公開同意並儲存後會立即刊登，並可隨時修改或撤下。</label>
          <p className="member-hint">聯絡信箱僅供帳號與身分核對，不會公開。你可隨時修改資料，也可透過「聯絡我們」要求更正或撤下。</p>
          {error && <p role="alert" className="member-error">{error}</p>}{notice && <p role="status" className="member-success">{notice}</p>}
          <button disabled={busy} className="member-primary">{busy ? "儲存中…" : profile.publishConsent ? "儲存並更新公開資料" : "只儲存私人資料"}</button>
        </form>
      </>}
      {cropSource && <AvatarCropDialog file={cropSource} onCancel={() => setCropSource(null)}
        onConfirm={cropped => { setPhoto(cropped); setOriginalPhoto(cropSource); setCropSource(null); setPhotoError(""); setError(""); setNotice(""); }} />}
    </section>
  </PageShell>;
}
