import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { PageShell } from "../layout/PageShell";
import { useLocale } from "../../lib/locale";
import { directoryRoleLabel, studyPeriod, type DirectoryMember, type DirectoryRole } from "../../lib/memberDirectory";

type Entry = Omit<DirectoryMember, "id">;
const blank = (): Entry => ({ name: "", role: "master1", graduationYear: "", studyStart: "", studyEnd: "" });
const roles: DirectoryRole[] = ["master1", "master2", "alumni"];
const years = Array.from({ length: new Date().getFullYear() + 11 - 1900 }, (_, index) => String(new Date().getFullYear() + 10 - index));
function MonthSelect({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const { t } = useLocale();
  const [year = "", month = ""] = value.split("-");
  return <fieldset className="directory-month"><legend>{label}</legend><div className="directory-month-controls">
    <select aria-label={`${label} ${t("西元年", "year")}`} value={year} onChange={event => onChange(event.target.value ? `${event.target.value}-${month}` : "")}><option value="">{t("西元年", "Year")}</option>{years.map(item => <option key={item} value={item}>{item}</option>)}</select>
    <select aria-label={`${label} ${t("月份", "month")}`} value={month} disabled={!year} onChange={event => onChange(`${year}-${event.target.value}`)}><option value="">{t("月份", "Month")}</option>{Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2,"0")).map(item => <option key={item} value={item}>{Number(item)} {t("月", "")}</option>)}</select>
  </div></fieldset>;
}

export function MemberAdminPage() {
  const { language, t } = useLocale();
  const [password, setPassword] = useState("");
  const [members, setMembers] = useState<DirectoryMember[] | null>(null);
  const [entry, setEntry] = useState<Entry>(blank);
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const call = async (suffix = "", method = "GET", body?: Entry) => {
    const response = await fetch(`/api/members/admin/directory${suffix}`, { method, cache: "no-store", headers: { "X-Admin-Password": password, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(response.status === 401 ? t("管理密碼錯誤或未設定。", "Admin password is incorrect or not configured.") : t(data.error || "操作失敗，請稍後再試。", "Could not complete the action. Check the name and dates, then try again."));
    return data;
  };
  const refresh = async () => { const data = await call(); setMembers(data.members); };
  const login = async (event: FormEvent) => { event.preventDefault(); setBusy(true); setError(""); try { await refresh(); } catch (err) { setError((err as Error).message); } finally { setBusy(false); } };
  const openEditor = (member?: DirectoryMember) => { setEntry(member ? { name: member.name, role: member.role, graduationYear: member.graduationYear, studyStart: member.studyStart, studyEnd: member.studyEnd } : blank()); setEditing(member?.id ?? "new"); setError(""); setNotice(""); document.getElementById("directory-editor")?.scrollIntoView({ block: "center" }); };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    const complete = (value: string) => !value || /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
    if (!complete(entry.studyStart) || !complete(entry.studyEnd) || entry.studyEnd && !entry.studyStart || entry.studyStart && entry.studyEnd && entry.studyEnd < entry.studyStart) {
      setError(t("請選完整的起訖年月；結束年月不能早於開始年月。", "Select complete dates. The end date must not precede the start date.")); return;
    }
    setBusy(true); setError(""); setNotice("");
    try { await call(editing === "new" ? "" : `/${editing}`, editing === "new" ? "POST" : "PUT", entry); await refresh(); setEditing(null); setNotice(t("名單已儲存，研究成員頁已同步更新。", "Directory saved and published to the People page.")); }
    catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  };
  const remove = async (member: DirectoryMember) => {
    if (!confirm(t(`確定從名單刪除「${member.name}」？`, `Remove ${member.name} from the directory?`))) return;
    setBusy(true); setError(""); setNotice("");
    try { await call(`/${member.id}`, "DELETE"); await refresh(); if (editing === member.id) setEditing(null); setNotice(t("已從名單刪除。", "Removed from the directory.")); }
    catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  };
  return <PageShell eyebrow="Member Directory" title={t("成員名單管理", "Member Directory")} lede={t("直接維護姓名、身分、畢業年份與就學年月；儲存後立即更新公開名單。", "Manage names, roles, graduation years and study dates. Changes are published immediately.")}>
    <section className="member-shell member-shell-wide">
      {members === null ? <form onSubmit={login} className="member-panel member-form"><label>{t("網站管理密碼", "Admin password")}<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required /></label><button className="member-primary" disabled={busy}>{busy ? t("確認中…", "Checking…") : t("進入管理", "Sign in")}</button>{error && <p className="member-error" role="alert">{error}</p>}</form> : <>
        <div className="member-account-line"><span>{members.length} {t("位成員", "members")}</span><Link to="/people">{t("查看公開名單 ↗", "View public directory ↗")}</Link><button type="button" className="member-primary" disabled={busy} onClick={() => openEditor()}>{t("新增成員", "Add member")}</button></div>
        <div id="directory-editor">{editing !== null && <form className="member-panel member-form directory-editor" onSubmit={save}>
          <h2>{editing === "new" ? t("新增成員", "Add member") : t("修改成員", "Edit member")}</h2>
          <div className="member-form-grid"><label>{t("姓名", "Name")}<input autoFocus required maxLength={40} value={entry.name} onChange={event => setEntry({ ...entry, name: event.target.value })} /></label><label>{t("名單分類", "Category")}<select value={entry.role} onChange={event => setEntry({ ...entry, role: event.target.value as DirectoryRole, graduationYear: event.target.value === "alumni" ? entry.graduationYear : "" })}>{roles.map(role => <option key={role} value={role}>{directoryRoleLabel(role, language)}</option>)}</select></label>
          {entry.role === "alumni" && <label>{t("畢業年份（西元）", "Graduation year")}<select value={entry.graduationYear} onChange={event => setEntry({ ...entry, graduationYear: event.target.value })}><option value="">{t("尚未填寫", "Not specified")}</option>{years.map(year => <option key={year} value={year}>{year}</option>)}</select></label>}
          <MonthSelect label={t("就學開始年月", "Study start")} value={entry.studyStart} onChange={studyStart => setEntry({ ...entry, studyStart })} /><MonthSelect label={t("就學結束年月", "Study end")} value={entry.studyEnd} onChange={studyEnd => setEntry({ ...entry, studyEnd })} /></div>
          <p className="member-hint">{t("年月皆採西元。起訖年月可留空；仍在就學者只填開始年月，公開頁顯示「至今」。", "Dates use Gregorian years. Dates are optional; current students can leave the end date blank to show Present.")}</p>
          <div className="member-review-actions"><button className="member-primary" disabled={busy}>{busy ? t("儲存中…", "Saving…") : t("儲存名單", "Save")}</button><button type="button" disabled={busy} onClick={() => { setEditing(null); setError(""); }}>{t("取消", "Cancel")}</button></div>
        </form>}</div>
        {error && <p className="member-error" role="alert">{error}</p>}{notice && <p className="member-success" role="status">{notice}</p>}
        {roles.map(role => <section className="directory-group" key={role}><div className="member-admin-heading"><h2>{directoryRoleLabel(role, language)}</h2><span>{members.filter(member => member.role === role).length}</span></div><div className="directory-grid">{members.filter(member => member.role === role).map(member => <article className="member-panel directory-card" key={member.id}><h3>{member.name}</h3>{role === "alumni" && member.graduationYear && <p>{t(`${member.graduationYear} 年畢業`, `Graduated ${member.graduationYear}`)}</p>}{studyPeriod(member,language) && <p className="member-hint">{studyPeriod(member,language)}</p>}<div className="member-review-actions"><button type="button" disabled={busy} onClick={() => openEditor(member)}>{t("修改", "Edit")}</button><button type="button" disabled={busy} onClick={() => remove(member)}>{t("刪除", "Delete")}</button></div></article>)}</div>{!members.some(member => member.role === role) && <p className="member-hint">{t("目前沒有名單。", "No members yet.")}</p>}</section>)}
      </>}
    </section>
  </PageShell>;
}
