export type PersonRole = "pi" | "student" | "alumnus";

export interface Person {
  id: string;
  nameZh: string;
  nameEn: string;
  role: PersonRole;
  titleZh: string;
  interests?: string[];
}

// Only the PI is currently confirmed from public sources (see the
// hpc-lab-real-content memory for what was checked and what wasn't).
// Current students/RAs are deliberately left empty rather than guessed
// from paper co-authors or past graduates — fill in once confirmed.
export const people: Person[] = [
  {
    id: "chao-tung-yang",
    nameZh: "楊朝棟",
    nameEn: "Chao-Tung Yang",
    role: "pi",
    titleZh: "終身特聘教授 / 實驗室主持人",
    interests: ["High Performance Computing", "Cloud Computing", "Big Data", "AIoT"],
  },
];
