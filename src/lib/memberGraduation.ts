export const graduationTerms = ["上", "下"] as const;

const firstYear = 1970;
const lastYear = new Date().getFullYear() + 6;
export const graduationYearOptions = Array.from(
  { length: lastYear - firstYear + 1 },
  (_, index) => String(lastYear - index),
);

export function graduationLabel(year: string, term?: string): string {
  if (!/^\d{4}$/.test(year)) return "畢業年度待確認";
  return `${year}年${graduationTerms.some(value => value === term) ? `‧${term}` : ""}畢業`;
}
