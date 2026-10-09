import { graduationLabel } from "./memberGraduation";
import type { Language } from "./locale";

export type MemberBackground = {
  kind: "education" | "experience";
  organization: string;
  detail: string;
  period: string;
};

export type RgbBadge = { kind: "custom" | "interest"; value: string };

export type PublicMember = {
  id: number;
  role: string;
  roleLabel: string;
  displayNameZh: string;
  displayNameEn: string;
  entryYear: string;
  graduationYear: string;
  graduationTerm?: string;
  degree: string;
  interests: string[];
  bio: string;
  affiliation: string;
  link: string;
  background?: MemberBackground[];
  rgbBadges?: RgbBadge[];
  avatarUrl: string | null;
};

export function memberCaption(member: PublicMember): string {
  if (member.role === "alumni") return graduationLabel(member.graduationYear, member.graduationTerm);
  return `${member.roleLabel}${member.entryYear ? ` · ${member.entryYear} 入學` : ""}`;
}

export function localizedMemberCaption(member: PublicMember, language: Language): string {
  if (language === "zh-TW") return memberCaption(member);
  if (member.role === "alumni") return member.graduationYear
    ? `Graduated ${member.graduationYear}${member.graduationTerm === "上" ? " · First half" : member.graduationTerm === "下" ? " · Second half" : ""}`
    : "Graduation year pending";
  const role = member.role === "master1" ? "Master's Year 1" : member.role === "master2" ? "Master's Year 2" : "Research Member";
  return `${role}${member.entryYear ? ` · Joined ${member.entryYear}` : ""}`;
}

const interestNamesEn: Record<string, string> = {
  "高效能運算": "High Performance Computing",
  "雲端／分散式系統": "Cloud / Distributed Systems",
  "AI／LLM": "AI / LLM",
  "大數據": "Big Data",
  "AIoT／邊緣運算": "AIoT / Edge Computing",
};

export function localizedInterest(interest: string, language: Language): string {
  return language === "en" ? interestNamesEn[interest] ?? interest : interest;
}
