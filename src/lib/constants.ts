export interface NavItem {
  index: string;
  labelZh: string;
  labelEn: string;
  to: string;
}

/* Deliberately five, and deliberately not the full six research areas —
   the hero shows a readable shortlist, the full set lives in the research
   section below it. */
export const heroKeywords = ["CLOUD", "DATA", "AI", "AIoT", "EDGE"];

export const navItems: NavItem[] = [
  { index: "00", labelZh: "首頁", labelEn: "HOME", to: "/" },
  { index: "01", labelZh: "研究方向", labelEn: "RESEARCH", to: "/research" },
  { index: "02", labelZh: "研究專案", labelEn: "PROJECTS", to: "/projects" },
  { index: "03", labelZh: "研究成員", labelEn: "PEOPLE", to: "/people" },
  { index: "04", labelZh: "論文著作", labelEn: "PUBLICATIONS", to: "/publications" },
  { index: "05", labelZh: "最新消息", labelEn: "NEWS", to: "/news" },
  { index: "06", labelZh: "聯絡我們", labelEn: "CONTACT", to: "/contact" },
  { index: "07", labelZh: "圖書館 GPU 主機", labelEn: "GPU MONITOR", to: "/gpus" },
  { index: "08", labelZh: "叢集資訊", labelEn: "CLUSTERS", to: "/infrastructure" },
];
