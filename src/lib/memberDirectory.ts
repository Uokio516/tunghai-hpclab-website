import type { Language } from "./locale";
export type DirectoryRole = "master1" | "master2" | "alumni";
export type DirectoryMember = { id: number; name: string; role: DirectoryRole; graduationYear: string; studyStart: string; studyEnd: string; cohortGroup?: number; displayOrder?: number; yearEstimated?: boolean };
export function directoryRoleLabel(role: DirectoryRole, language: Language) {
  return ({ master1: ["碩一", "Master's Year 1"], master2: ["碩二", "Master's Year 2"], alumni: ["畢業學長姊", "Alumni"] })[role][language === "en" ? 1 : 0];
}
export function studyPeriod(member: Pick<DirectoryMember, "studyStart" | "studyEnd" | "role">, language: Language) {
  if (!member.studyStart) return "";
  const date = (value: string) => language === "en" ? value.replace("-", "/") : `${value.slice(0,4)} 年 ${Number(value.slice(5))} 月`;
  const missingEnd = member.role === "alumni" ? language === "en" ? "End date not specified" : "結束年月未填" : language === "en" ? "Present" : "至今";
  return `${date(member.studyStart)} – ${member.studyEnd ? date(member.studyEnd) : missingEnd}`;
}
