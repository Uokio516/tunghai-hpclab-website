import { graduationLabel } from "./memberGraduation";

export type MemberBackground = {
  kind: "education" | "experience";
  organization: string;
  detail: string;
  period: string;
};

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
  avatarUrl: string | null;
};

export function memberCaption(member: PublicMember): string {
  if (member.role === "alumni") return graduationLabel(member.graduationYear, member.graduationTerm);
  return `${member.roleLabel}${member.entryYear ? ` · ${member.entryYear} 入學` : ""}`;
}
