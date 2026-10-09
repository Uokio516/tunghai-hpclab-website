import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PageShell } from "../layout/PageShell";
import { AvatarCropDialog } from "../AvatarCropDialog";
import { graduationTerms, graduationYearOptions } from "../../lib/memberGraduation";
import { localizedInterest, type MemberBackground, type RgbBadge } from "../../lib/memberProfiles";
import { localizedServerError, useLocale, type Language } from "../../lib/locale";

type Role = "master1" | "master2" | "alumni";
type Profile = {
  displayNameZh: string; displayNameEn: string; entryYear: string; graduationYear: string; graduationTerm: string;
  degree: string; interests: string[]; bio: string; affiliation: string; link: string;
  background: MemberBackground[]; rgbBadges: RgbBadge[];
  publishConsent: boolean; avatarConsent: boolean; selfAttested: boolean;
};
type Account = { id: number; email: string; name: string; role: Role; roleLabel: string; status: string; badgeLimit: number; profile: Profile | null; avatarUrl: string | null };
const emptyProfile = (name: string): Profile => ({ displayNameZh: name, displayNameEn: "", entryYear: "", graduationYear: "", graduationTerm: "", degree: "", interests: [], bio: "", affiliation: "", link: "", background: [], rgbBadges: [], publishConsent: false, avatarConsent: false, selfAttested: false });
const topics = ["高效能運算", "雲端／分散式系統", "AI／LLM", "大數據", "AIoT／邊緣運算"];
const statusText: Record<string, string> = { draft: "尚未填寫", pending: "資料處理中", approved: "已公開", private: "僅自己與實驗室可見", changes: "請更新資料", hidden: "暫停公開" };
const statusTextEn: Record<string, string> = { draft: "Not completed", pending: "Processing", approved: "Published", private: "Private to you and the lab", changes: "Update needed", hidden: "Publication paused" };
const roleEn: Record<Role, string> = { master1: "Master's Year 1", master2: "Master's Year 2", alumni: "Alumni" };
const roleLabelEn: Record<string, string> = { "碩一": roleEn.master1, "碩二": roleEn.master2, "實驗室畢業學長姊": roleEn.alumni };
async function reply(response: Response, language: Language = document.documentElement.lang === "en" ? "en" : "zh-TW") { const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(localizedServerError(data.error || "操作失敗，請稍後再試", language)); return data; }

export function MemberJoinPage() {
  const { language, t } = useLocale();
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
    if (password !== confirmation) return setError(t("兩次密碼不一致", "Passwords do not match"));
    setBusy(true);
    try { await reply(await fetch("/api/members/activate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ invite, password }) })); navigate("/member/me", { replace: true }); }
    catch (error) { setError((error as Error).message); } finally { setBusy(false); }
  };
  return <PageShell eyebrow="Member Invitation" title={t("啟用成員帳號", "Activate Member Account")} lede={t("這是由實驗室個別發出的邀請。請自行設定密碼，之後可登入更新資料與頭像。", "This invitation was issued by the lab. Set a password to update your profile and photo later.")}>
    <section className="member-shell">
      {preview ? <form onSubmit={activate} className="member-panel member-form">
        <div className="member-invite-person"><strong>{preview.name}</strong><span>{language === "en" ? roleLabelEn[preview.roleLabel] ?? preview.roleLabel : preview.roleLabel} · {preview.email}</span></div>
        <label>{t("設定密碼（至少 10 字元）", "Set password (at least 10 characters)")}<input type="password" autoComplete="new-password" minLength={10} maxLength={128} required value={password} onChange={event => setPassword(event.target.value)} /></label>
        <label>{t("再次輸入密碼", "Confirm password")}<input type="password" autoComplete="new-password" minLength={10} required value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label>
        <p className="member-hint">{t("邀請連結只可使用一次，請勿轉傳。帳號啟用後，由你決定是否將資料公開於研究成員頁。", "This invitation link can be used once. Please do not forward it. After activation, you decide whether your profile is public.")}</p>
        {error && <p role="alert" className="member-error">{error}</p>}
        <button disabled={busy} className="member-primary">{busy ? t("啟用中…", "Activating…") : t("啟用並開始填寫", "Activate and continue")}</button>
      </form> : <div className="member-panel">{error ? <p role="alert" className="member-error">{error}。{t("請向實驗室索取新的邀請連結。", "Please request a new invitation from the lab.")}</p> : t("正在確認邀請…", "Checking invitation…")}</div>}
    </section>
  </PageShell>;
}

export function MemberLoginPage() {
  const { t } = useLocale();
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
  return <PageShell eyebrow="Member Sign In" title={t("成員登入", "Member Sign In")} lede={t("已收到邀請並啟用帳號的碩一、碩二與實驗室畢業學長姊，可以在這裡更新資料。", "Invited and activated students and alumni can update their profiles here.")}>
    <section className="member-shell"><form onSubmit={login} className="member-panel member-form">
      <label>{t("聯絡信箱", "Email address")}<input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} /></label>
      <label>{t("密碼", "Password")}<input type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} /></label>
      {error && <p role="alert" className="member-error">{error}</p>}
      <button disabled={busy} className="member-primary">{busy ? t("登入中…", "Signing in…") : t("登入", "Sign in")}</button>
      <p className="member-hint">{t("尚未收到邀請？請透過", "No invitation yet? Use")} <Link to="/contact">{t("聯絡我們", "Contact Us")}</Link> {t("核對身分；網站不開放自行註冊。", "to verify your identity; self-registration is unavailable.")}</p>
    </form></section>
  </PageShell>;
}

export function MemberResetPage() {
  const { t } = useLocale();
  const { reset } = useParams();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!reset) return; fetch(`/api/members/reset/${encodeURIComponent(reset)}`, { cache: "no-store" }).then(reply).then(data => setName(data.name)).catch(err => setError(err.message)); }, [reset]);
  const submit = async (event: FormEvent) => { event.preventDefault(); if (password !== confirmation) return setError(t("兩次密碼不一致", "Passwords do not match")); setBusy(true); setError(""); try { await reply(await fetch("/api/members/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reset, password }) })); navigate("/member/me", { replace: true }); } catch (err) { setError((err as Error).message); } finally { setBusy(false); } };
  return <PageShell eyebrow="Password Reset" title={t("重設成員密碼", "Reset Member Password")} lede={t("由實驗室核對身分後發出的重設連結，有效一小時且只能使用一次。", "The lab issued this reset link after verifying your identity. It is valid for one hour and can be used once.")}><section className="member-shell">{name ? <form className="member-panel member-form" onSubmit={submit}><strong>{name}</strong><label>{t("新密碼（至少 10 字元）", "New password (at least 10 characters)")}<input type="password" autoComplete="new-password" minLength={10} maxLength={128} required value={password} onChange={event => setPassword(event.target.value)} /></label><label>{t("再次輸入新密碼", "Confirm new password")}<input type="password" autoComplete="new-password" minLength={10} required value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label>{error && <p role="alert" className="member-error">{error}</p>}<button className="member-primary" disabled={busy}>{t("設定新密碼", "Set new password")}</button></form> : <div className="member-panel">{error || t("正在確認重設連結…", "Checking reset link…")}</div>}</section></PageShell>;
}

export function MemberProfilePage() {
  const { language, t } = useLocale();
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
  useEffect(() => { fetch("/api/members/me", { cache: "no-store" }).then(response => response.status === 401 ? (navigate("/member/login", { replace: true }), null) : reply(response)).then((data: Account | null) => { if (data) { setAccount(data); setProfile(data.profile ? { ...data.profile, graduationYear: data.role === "alumni" && !graduationYearOptions.includes(data.profile.graduationYear) ? "" : data.profile.graduationYear, graduationTerm: data.profile.graduationTerm ?? "", background: data.profile.background ?? [], rgbBadges: data.profile.rgbBadges ?? [] } : emptyProfile(data.name)); } }).catch(error => setError(error.message)); }, [navigate]);
  const change = (key: keyof Profile, value: string | boolean | string[]) => setProfile(current => current ? { ...current, [key]: value } : current);
  const addBackground = () => setProfile(current => current && current.background.length < 8 ? { ...current, background: [...current.background, { kind: "education", organization: "", detail: "", period: "" }] } : current);
  const updateBackground = (index: number, patch: Partial<MemberBackground>) => setProfile(current => current ? { ...current, background: current.background.map((item, position) => position === index ? { ...item, ...patch } : item) } : current);
  const removeBackground = (index: number) => setProfile(current => current ? { ...current, background: current.background.filter((_, position) => position !== index) } : current);
  const moveBackground = (index: number, offset: number) => setProfile(current => { if (!current) return current; const next = [...current.background]; const target = index + offset; if (target < 0 || target >= next.length) return current; [next[index], next[target]] = [next[target], next[index]]; return { ...current, background: next }; });
  const updateBadge = (index: number, badge: RgbBadge) => setProfile(current => current ? { ...current, rgbBadges: current.rgbBadges.map((item, position) => position === index ? badge : item) } : current);
  const removeBadge = (index: number) => setProfile(current => current ? { ...current, rgbBadges: current.rgbBadges.filter((_, position) => position !== index) } : current);
  const addBadge = () => setProfile(current => current && current.rgbBadges.length < (account?.badgeLimit ?? 1) ? { ...current, rgbBadges: [...current.rgbBadges, { kind: "custom", value: "" }] } : current);
  const toggleInterest = (topic: string, checked: boolean) => setProfile(current => { if (!current) return current; const interests = checked ? [...current.interests, topic].slice(0, 3) : current.interests.filter(value => value !== topic); return { ...current, interests, rgbBadges: current.rgbBadges.filter(badge => badge.kind !== "interest" || interests.includes(badge.value)) }; });
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (!profile) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await reply(await fetch("/api/members/me", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(profile) }));
      if (photo) await reply(await fetch("/api/members/me/avatar", { method: "POST", headers: { "Content-Type": photo.type }, body: photo }));
      setPhoto(null); setOriginalPhoto(null);
      const updated = await reply(await fetch("/api/members/me", { cache: "no-store" }));
      setAccount({ ...updated, avatarUrl: updated.avatarUrl ? `${updated.avatarUrl}?v=${Date.now()}` : null });
      setNotice(updated.status === "hidden" ? t("資料已儲存；此帳號目前暫停公開，請聯絡實驗室。", "Profile saved. Publication is paused for this account; contact the lab.") : profile.publishConsent ? t("資料已更新，研究成員頁將立即顯示最新內容。", "Profile updated. The People page will show the latest version immediately.") : t("資料已儲存為私人資料，網站不會刊登。", "Profile saved privately and will not be published."));
    } catch (error) { setError((error as Error).message); } finally { setBusy(false); }
  };
  const logout = async () => { await fetch("/api/members/logout", { method: "POST" }); navigate("/member/login", { replace: true }); };
  const removeAvatar = async () => { if (!confirm(t("確定要移除頭像？公開頁面的照片也會立即撤下。", "Remove your avatar? The public photo will disappear immediately."))) return; try { await reply(await fetch("/api/members/me/avatar", { method: "DELETE" })); setPhoto(null); setOriginalPhoto(null); setAccount(current => current ? { ...current, avatarUrl: null } : current); setNotice(t("頭像已移除。", "Avatar removed.")); } catch (error) { setError((error as Error).message); } };
  const choosePhoto = (file: File | null) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setPhotoError(t("請選擇 JPEG、PNG 或 WebP 照片。", "Choose a JPEG, PNG or WebP photo.")); return; }
    if (file.size > 5 * 1024 * 1024) { setPhotoError(t("照片不可超過 5 MB。", "The photo must be 5 MB or smaller.")); return; }
    setPhotoError("");
    setError("");
    setNotice("");
    setCropSource(file);
  };
  return <PageShell eyebrow="Member Profile" title={t("我的成員資料", "My Member Profile")} lede={t("你可以隨時更新資料；勾選公開同意並儲存後，研究成員頁會立即更新。", "Update your profile at any time. With publication consent, saving updates the People page immediately.")}>
    <section className="member-shell member-shell-wide">
      {!account || !profile ? <div className="member-panel">{error ? <p role="alert" className="member-error">{error}</p> : t("正在讀取資料…", "Loading profile…")}</div> : <>
        <div className="member-account-line"><span>{account.name} · {language === "en" ? roleEn[account.role] : account.roleLabel} · {account.email}</span><button type="button" onClick={logout}>{t("登出", "Sign out")}</button></div>
        <div className="member-status">{t("目前狀態：", "Current status: ")}<strong>{(language === "en" ? statusTextEn : statusText)[account.status] ?? account.status}</strong></div>
        <form onSubmit={submit} className="member-panel member-form">
          <h2>{t("基本資料", "Basic Information")}</h2><div className="member-form-grid">
            <label>{t("中文顯示姓名", "Chinese display name")} <b>*</b><input required maxLength={40} value={profile.displayNameZh} onChange={event => change("displayNameZh", event.target.value)} /></label>
            <label>{t("英文姓名（選填）", "English name (optional)")}<input maxLength={80} value={profile.displayNameEn} onChange={event => change("displayNameEn", event.target.value)} /></label>
            {account.role === "alumni" ? <><label>{t("畢業年份（西元）", "Graduation year")}<b>*</b><select required value={profile.graduationYear} onChange={event => change("graduationYear", event.target.value)}><option value="">{t("請選擇年份", "Select a year")}</option>{graduationYearOptions.map(year => <option key={year} value={year}>{year} {t("年", "")}</option>)}</select></label><label>{t("畢業學期", "Graduation term")} <b>*</b><select required value={profile.graduationTerm} onChange={event => change("graduationTerm", event.target.value)}><option value="">{t("請選擇學期", "Select a term")}</option>{graduationTerms.map(term => <option key={term} value={term}>{term === "上" ? t("上學期", "First half") : t("下學期", "Second half")}</option>)}</select></label><label>{t("學位", "Degree")} <b>*</b><select required value={profile.degree} onChange={event => change("degree", event.target.value)}><option value="">{t("請選擇", "Select")}</option>{["碩士", "博士", "學士", "其他／待確認"].map((degree, index) => <option key={degree} value={degree}>{language === "en" ? ["Master's", "Doctorate", "Bachelor's", "Other / pending"][index] : degree}</option>)}</select></label></> : <label>{t("入學學年度", "Year of admission")} <b>*</b><input required placeholder={t("例如 2025", "e.g. 2025")} maxLength={12} value={profile.entryYear} onChange={event => change("entryYear", event.target.value)} /></label>}
            <label>{t("目前單位／職稱（選填）", "Current affiliation / title (optional)")}<input maxLength={80} value={profile.affiliation} onChange={event => change("affiliation", event.target.value)} /></label>
          </div>
          <h2>{t("網站展示", "Public Profile")}</h2><fieldset><legend>{t("研究方向（最多 3 項）", "Research interests (up to 3)")}</legend><div className="member-topic-list">{topics.map(topic => <label key={topic}><input type="checkbox" checked={profile.interests.includes(topic)} onChange={event => toggleInterest(topic, event.target.checked)} />{localizedInterest(topic, language)}</label>)}</div></fieldset>
          <label>{t("一句自我介紹（選填，120 字以內）", "Short bio (optional, up to 120 characters)")}<textarea rows={3} maxLength={120} value={profile.bio} onChange={event => change("bio", event.target.value)} /></label>
          <section className="member-badge-editor" aria-labelledby="member-badge-title">
            <div className="member-background-heading"><div><h2 id="member-badge-title">{t("RGB 技能按鈕", "RGB Skill Badges")}</h2><p className="member-hint">{t(`可自訂文字，或把已選的研究方向設為 RGB 技能。此帳號最多 ${account.badgeLimit} 個；只有您登入後能修改或關閉。`, `Use custom text or a selected research interest. This account allows up to ${account.badgeLimit} badges; only you can edit or turn them off after signing in.`)}</p></div><button type="button" className="member-photo-choose" onClick={addBadge} disabled={profile.rgbBadges.length >= account.badgeLimit}>{t("啟用一個 RGB 技能", "Add an RGB skill")}</button></div>
            {profile.rgbBadges.map((badge, index) => <div className="member-badge-row" key={index}>
              <label>{t("內容來源", "Content source")}<select aria-label={t(`第 ${index + 1} 個 RGB 技能內容來源`, `Content source for RGB skill ${index + 1}`)} value={badge.kind} onChange={event => updateBadge(index, { kind: event.target.value as RgbBadge["kind"], value: event.target.value === "interest" ? (profile.interests.find(interest => !profile.rgbBadges.some((item, position) => position !== index && item.value === interest)) ?? "") : "" })}><option value="custom">{t("自訂文字", "Custom text")}</option><option value="interest">{t("研究方向", "Research interest")}</option></select></label>
              {badge.kind === "custom" ? <label>{t("按鈕文字", "Badge text")}<input aria-label={t(`第 ${index + 1} 個 RGB 技能文字`, `Text for RGB skill ${index + 1}`)} required maxLength={30} value={badge.value} onChange={event => updateBadge(index, { ...badge, value: event.target.value })} placeholder={t("例如：GPU 運算", "e.g. GPU Computing")} /></label> : <label>{t("選擇研究方向", "Choose research interest")}<select aria-label={t(`第 ${index + 1} 個 RGB 技能研究方向`, `Research interest for RGB skill ${index + 1}`)} required value={badge.value} onChange={event => updateBadge(index, { ...badge, value: event.target.value })}><option value="">{t("選擇方向", "Select interest")}</option>{profile.interests.map(interest => <option key={interest} value={interest} disabled={profile.rgbBadges.some((item, position) => position !== index && item.value === interest)}>{localizedInterest(interest, language)}</option>)}</select></label>}
              <button type="button" className="member-text-button" onClick={() => removeBadge(index)} aria-label={t(`關閉第 ${index + 1} 個 RGB 技能`, `Remove RGB skill ${index + 1}`)}>{t("關閉特效", "Remove badge")}</button>
            </div>)}
          </section>
          <div className="member-background-heading"><div><h2>{t("學歷與經歷", "Education & Experience")}</h2><p className="member-hint">{t("只填想公開的資料，最多 8 筆；會依這裡的順序出現在個人頁面。例如「彰化高工／電子科」、「國立高雄科技大學」。", "Add only what you want to publish, up to eight entries. They appear on your profile in this order, such as a school, department or university.")}</p></div><button type="button" className="member-photo-choose" onClick={addBackground} disabled={profile.background.length >= 8}>{t("新增一筆", "Add an entry")}</button></div>
          {profile.background.map((item, index) => <div className="member-background-editor" key={index}><div className="member-background-editor-head"><strong>{t(`第 ${index + 1} 筆`, `Entry ${index + 1}`)}</strong><div><button type="button" disabled={index === 0} onClick={() => moveBackground(index, -1)} aria-label={t(`將第 ${index + 1} 筆上移`, `Move entry ${index + 1} up`)}>{t("上移", "Up")}</button><button type="button" disabled={index === profile.background.length - 1} onClick={() => moveBackground(index, 1)} aria-label={t(`將第 ${index + 1} 筆下移`, `Move entry ${index + 1} down`)}>{t("下移", "Down")}</button><button type="button" onClick={() => removeBackground(index)} aria-label={t(`移除第 ${index + 1} 筆`, `Remove entry ${index + 1}`)}>{t("移除", "Remove")}</button></div></div><div className="member-form-grid"><label>{t("類型", "Type")}<select value={item.kind} onChange={event => updateBackground(index, { kind: event.target.value as MemberBackground["kind"] })}><option value="education">{t("學歷", "Education")}</option><option value="experience">{t("經歷", "Experience")}</option></select></label><label>{t("學校／單位", "School / Organization")} <b>*</b><input required maxLength={80} value={item.organization} onChange={event => updateBackground(index, { organization: event.target.value })} placeholder={t("例如 彰化高工", "e.g. Your school")} /></label><label>{t("科系／職稱（選填）", "Department / Title (optional)")}<input maxLength={80} value={item.detail} onChange={event => updateBackground(index, { detail: event.target.value })} placeholder={t("例如 電子科", "e.g. Electronics Department")} /></label><label>{t("就讀／任職期間（選填）", "Study / Employment period (optional)")}<input maxLength={40} value={item.period} onChange={event => updateBackground(index, { period: event.target.value })} placeholder={t("例如 2020–2023", "e.g. 2020–2023")} /></label></div></div>)}
          <label>{t("個人網站／GitHub／LinkedIn（選填）", "Personal website / GitHub / LinkedIn (optional)")}<input type="url" placeholder="https://" maxLength={200} value={profile.link} onChange={event => change("link", event.target.value)} /></label>
          <div className="member-photo">
            <div className="member-photo-preview">{photoPreview ? <img src={photoPreview} alt={t("裁切後的新頭像預覽", "Preview of cropped avatar")} /> : account.avatarUrl ? <img src={account.avatarUrl} alt={t("目前頭像", "Current avatar")} /> : <span>{profile.displayNameZh.slice(0, 1) || t("人", "M")}</span>}</div>
            <div className="member-photo-content">
              <strong>{t("頭像照片（選填）", "Avatar photo (optional)")}</strong>
              <p className="member-hint">{t("點選照片後可移動、縮放裁切框，確認後再按頁面底部的儲存按鈕上傳。", "Choose a photo, move and resize the crop frame, then save the page to upload it.")}</p>
              <input ref={photoInputRef} className="member-photo-input" type="file" accept="image/jpeg,image/png,image/webp" aria-label={t("選擇頭像照片", "Choose avatar photo")} onChange={event => { choosePhoto(event.target.files?.[0] ?? null); event.target.value = ""; }} />
              <div className="member-photo-actions">
                <button type="button" className="member-photo-choose" onClick={() => photoInputRef.current?.click()}>{photo || account.avatarUrl ? t("選擇新照片", "Choose new photo") : t("選擇照片並裁切", "Choose and crop photo")}</button>
                {photo && originalPhoto && <button type="button" className="member-text-button" onClick={() => setCropSource(originalPhoto)}>{t("重新裁切", "Crop again")}</button>}
                {photo && <button type="button" className="member-text-button" onClick={() => { setPhoto(null); setOriginalPhoto(null); }}>{t("取消新照片", "Discard new photo")}</button>}
                {account.avatarUrl && <button type="button" className="member-text-button" onClick={removeAvatar}>{t("移除已上傳頭像", "Remove uploaded avatar")}</button>}
              </div>
              {photoError && <p className="member-error" role="alert">{photoError}</p>}
              <p className="member-hint">{photo ? t("已完成裁切，按下方儲存按鈕後才會上傳。", "Crop ready. The photo uploads when you save below.") : t("支援 JPEG、PNG、WebP；原圖至少 200×200、最多 5 MB。", "JPEG, PNG or WebP; original at least 200×200 pixels, maximum 5 MB.")}</p>
            </div>
          </div>
          <h2>{t("公開同意", "Publication Consent")}</h2><label className="member-check"><input type="checkbox" checked={profile.publishConsent} onChange={event => change("publishConsent", event.target.checked)} />{t("我同意將上述顯示資料刊登於官網；儲存後立即更新，取消勾選並儲存會立即撤下。", "I agree to publish the profile information above. Saving updates the site immediately; unchecking and saving removes it immediately.")}</label>
          <label className="member-check"><input type="checkbox" checked={profile.avatarConsent} onChange={event => change("avatarConsent", event.target.checked)} />{t("我另行同意公開我上傳的頭像；未勾選時照片不會出現在官網。", "I separately agree to publish my uploaded avatar. Without this consent, the photo will not appear on the site.")}</label>
          <label className="member-check"><input type="checkbox" required checked={profile.selfAttested} onChange={event => change("selfAttested", event.target.checked)} />{t("以上資料由本人提供或已取得當事人同意；我了解勾選公開同意並儲存後會立即刊登，並可隨時修改或撤下。", "I provided this information or obtained the subject's consent. I understand that publishing takes effect when I save and that I can edit or remove it at any time.")}</label>
          <p className="member-hint">{t("聯絡信箱僅供帳號與身分核對，不會公開。你可隨時修改資料，也可透過「聯絡我們」要求更正或撤下。", "Your email is used only for account and identity verification and is not published. You can edit your profile or contact us to request corrections or removal.")}</p>
          {error && <p role="alert" className="member-error">{error}</p>}{notice && <p role="status" className="member-success">{notice}</p>}
          <button disabled={busy} className="member-primary">{busy ? t("儲存中…", "Saving…") : profile.publishConsent ? t("儲存並更新公開資料", "Save and update public profile") : t("只儲存私人資料", "Save privately")}</button>
        </form>
      </>}
      {cropSource && <AvatarCropDialog file={cropSource} onCancel={() => setCropSource(null)}
        onConfirm={cropped => { setPhoto(cropped); setOriginalPhoto(cropSource); setCropSource(null); setPhotoError(""); setError(""); setNotice(""); }} />}
    </section>
  </PageShell>;
}
