import type { Language } from "./locale";
export type DirectoryRole = "phd" | "master1" | "master2" | "phdAlumni" | "alumni";
export const isAlumniRole = (role: DirectoryRole) => role === "alumni" || role === "phdAlumni";
export type DirectoryMember = { id: number; name: string; role: DirectoryRole; graduationYear: string; studyStart: string; studyEnd: string; cohortGroup?: number; displayOrder?: number; yearEstimated?: boolean };
export function directoryRoleLabel(role: DirectoryRole, language: Language) {
  return ({ phd: ["博士班", "PhD Students"], master1: ["碩一", "Master's Year 1"], master2: ["碩二", "Master's Year 2"], phdAlumni: ["博士班（已畢業）", "PhD Alumni"], alumni: ["碩士班（已畢業）", "Master's Alumni"] })[role][language === "en" ? 1 : 0];
}
export function graduationLabel(member: Pick<DirectoryMember, "graduationYear" | "studyEnd">, language: Language) {
  const year = member.studyEnd?.slice(0, 4) || member.graduationYear;
  if (!year) return "";
  const month = member.studyEnd ? Number(member.studyEnd.slice(5)) : null;
  if (language === "en") return `Graduated ${month ? `${year}/${String(month).padStart(2, "0")}` : year}`;
  return `${year} 年（民國 ${Number(year) - 1911} 年）${month ? `${month} 月` : ""}畢業`;
}
export function studyPeriod(member: Pick<DirectoryMember, "studyStart" | "studyEnd" | "role">, language: Language) {
  if (!member.studyStart) return "";
  const date = (value: string) => language === "en" ? value.replace("-", "/") : `${value.slice(0,4)} 年 ${Number(value.slice(5))} 月`;
  const missingEnd = isAlumniRole(member.role) ? language === "en" ? "End date not specified" : "結束年月未填" : language === "en" ? "Present" : "至今";
  return `${date(member.studyStart)} – ${member.studyEnd ? date(member.studyEnd) : missingEnd}`;
}
