import { graduationLabel, type DirectoryMember } from "../lib/memberDirectory";
import type { Language } from "../lib/locale";

export function GraduationDate({ member, language }: { member: DirectoryMember; language: Language }) {
  const label = graduationLabel(member, language);
  if (!label) return null;
  const lines = language === "zh-TW" ? label.match(/^(.+?年）)(\d+ 月畢業)$/) : null;
  return <p>{lines ? <><span className="block">{lines[1]}</span><span className="block">{lines[2]}</span></> : label}</p>;
}
