import type { Language } from "./locale";
export type DirectoryRole = "master1" | "master2" | "alumni";
export type DirectoryMember = { id: number; name: string; role: DirectoryRole; graduationYear: string; studyStart: string; studyEnd: string; cohortGroup?: number };
export function alumniSections(members: DirectoryMember[], language: Language) {
  const groups = new Map<string, DirectoryMember[]>();
  for (const member of members.filter(item => item.role === "alumni")) {
    const key = member.graduationYear ? `year:${member.graduationYear}` : member.cohortGroup ? `group:${member.cohortGroup}` : "unknown";
    groups.set(key, [...(groups.get(key) ?? []), member]);
  }
  return [...groups.entries()].sort(([a], [b]) => {
    const rank = (key: string) => key.startsWith("year:") ? 0 : key.startsWith("group:") ? 1 : 2;
    return rank(a) - rank(b) || (a.startsWith("year:") ? Number(b.slice(5)) - Number(a.slice(5)) : Number(a.slice(6)) - Number(b.slice(6)));
  }).map(([key, items]) => ({ key, members: items, title: key.startsWith("year:") ? language === "en" ? `Class of ${key.slice(5)}` : `${key.slice(5)} 年畢業` : key.startsWith("group:") ? language === "en" ? `Group ${key.slice(6).padStart(2,"0")} · Year unconfirmed` : `歷屆分組 ${key.slice(6).padStart(2,"0")}・年份待確認` : language === "en" ? "Other alumni · Year unconfirmed" : "其他畢業成員・年份待確認" }));
}
export function directoryRoleLabel(role: DirectoryRole, language: Language) {
  return ({ master1: ["碩一", "Master's Year 1"], master2: ["碩二", "Master's Year 2"], alumni: ["畢業學長姊", "Alumni"] })[role][language === "en" ? 1 : 0];
}
export function studyPeriod(member: Pick<DirectoryMember, "studyStart" | "studyEnd" | "role">, language: Language) {
  if (!member.studyStart) return "";
  const date = (value: string) => language === "en" ? value.replace("-", "/") : `${value.slice(0,4)} 年 ${Number(value.slice(5))} 月`;
  const missingEnd = member.role === "alumni" ? language === "en" ? "End date not specified" : "結束年月未填" : language === "en" ? "Present" : "至今";
  return `${date(member.studyStart)} – ${member.studyEnd ? date(member.studyEnd) : missingEnd}`;
}
