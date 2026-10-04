export interface LabConfig {
  nameZh: string;
  nameEn: string;
  shortName: string;
  founded: string;
  university: string;
  universityEn: string;
  department: string;
  departmentEn: string;
  website: string;
  positioning: string;
  positioningEn: string;
}

export const lab: LabConfig = {
  nameZh: "高效能計算實驗室",
  nameEn: "High Performance Computing Laboratory",
  shortName: "HPC Lab",
  founded: "2001",
  university: "東海大學",
  universityEn: "Tunghai University",
  department: "資訊工程學系",
  departmentEn: "Department of Computer Science",
  website: "https://hpc.thu.edu.tw/",
  positioning:
    "探索高效能計算、分散式系統、雲端基礎架構、大數據、人工智慧、AIoT 與智慧化真實世界應用交界的研究團隊。",
  positioningEn:
    "A research group exploring the intersection of high-performance computing, distributed systems, cloud infrastructure, big data, artificial intelligence, AIoT, and intelligent real-world applications.",
};

export interface ProfessorConfig {
  nameZh: string;
  nameEn: string;
  title: string;
  titleEn: string;
  roles: string[];
  education: { degree: string; school: string; field: string; year: string }[];
  orcid: string;
  dblpUrl: string;
  researchGateUrl: string;
  profileUrl: string;
  scholarUrl: string | null;
}

export const professor: ProfessorConfig = {
  nameZh: "楊朝棟",
  nameEn: "Chao-Tung Yang",
  title: "終身特聘教授",
  titleEn: "Lifetime Distinguished Professor",
  // 東海大學官方簡歷列出 2026/08 起任教務長，原系主任與圖資長任期均至 2026/07。
  roles: ["東海大學教務處 教務長（2026.08 起）", "東海大學資訊工程學系 終身特聘教授"],
  education: [
    { degree: "博士", school: "國立交通大學(現陽明交通大學)", field: "資訊科學研究所", year: "1996" },
    { degree: "碩士", school: "國立交通大學(現陽明交通大學)", field: "資訊科學研究所", year: "1992" },
    { degree: "學士", school: "東海大學", field: "資訊科學系", year: "1990" },
  ],
  orcid: "0000-0002-9579-4426",
  dblpUrl: "https://dblp.org/pid/y/ChaoTungYang",
  researchGateUrl: "https://www.researchgate.net/profile/Chao-Tung-Yang-2",
  profileUrl: "https://hpc.thu.edu.tw/profile/",
  scholarUrl: null,
};
