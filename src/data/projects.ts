export interface Project {
  id: string;
  titleZh: string;
  titleEn: string;
  year: string;
  categories: string[];
  descriptionZh: string;
  descriptionEn: string;
  note?: string;
  noteEn?: string;
  featured: boolean;
}

export const projects: Project[] = [
  {
    id: "aiot-air-quality",
    titleZh: "AIoT 空氣品質監測",
    titleEn: "AIoT Air Quality Monitoring",
    year: "2021",
    categories: ["AIoT", "Cloud-Edge Computing", "Environmental Monitoring"],
    descriptionZh: "結合感測器、邊緣運算與雲端運算,對懸浮微粒(PM)進行即時監測與智慧控制。",
    descriptionEn: "Combines sensors, edge and cloud computing to monitor particulate matter in real time and support intelligent control.",
    note: "研究成果發表於 Journal of Hazardous Materials(2021)。",
    noteEn: "Published in Journal of Hazardous Materials (2021).",
    featured: true,
  },
  {
    id: "smart-campus-energy",
    titleZh: "智慧校園能源監控",
    titleEn: "Smart Campus Energy Monitoring",
    year: "2020",
    categories: ["Big Data", "Smart Campus", "Energy Monitoring"],
    descriptionZh: "運用大數據技術收集並分析校園能源使用資料,建置智慧校園能源監控服務。",
    descriptionEn: "Uses big data techniques to collect and analyze campus energy use for smart campus monitoring.",
    note: "研究成果發表於 Cluster Computing(2020)。",
    noteEn: "Published in Cluster Computing (2020).",
    featured: true,
  },
  {
    id: "chest-pain-recognition",
    titleZh: "胸痛表情智慧辨識系統",
    titleEn: "AI Chest Pain Facial Expression Recognition",
    year: "2023",
    categories: ["Deep Learning", "Medical AI", "Video Analysis"],
    descriptionZh: "整合影像串流與深度學習進行臉部表情分析,協助胸痛症狀的智慧辨識與醫療輔助。",
    descriptionEn: "Combines video streams and deep learning to analyze facial expressions and support recognition of chest-pain symptoms.",
    note: "國科會計畫 NSTC 112-2622-E-029-003,與雄欣科技股份有限公司合作。",
    noteEn: "NSTC project 112-2622-E-029-003, in collaboration with Xiong Xin Technology Co., Ltd.",
    featured: true,
  },
  {
    id: "mifas-cloud-medical-imaging",
    titleZh: "MIFAS 雲端醫療影像系統",
    titleEn: "MIFAS Cloud Medical Imaging System",
    year: "2017",
    categories: ["Cloud Computing", "Medical Imaging", "Distributed Storage"],
    descriptionZh: "結合 PACS、Hadoop、虛擬化與分散式儲存技術,建置高可用性的雲端醫療影像平台。",
    descriptionEn: "Combines PACS, Hadoop, virtualization and distributed storage in a highly available cloud medical imaging platform.",
    note: "曾獲開放軟體創作競賽學生組金牌。",
    noteEn: "Won a student gold medal in an open-source software competition.",
    featured: true,
  },
  {
    id: "smart-water-quality",
    titleZh: "智慧水質量測系統",
    titleEn: "Smart Water Quality Monitoring",
    year: "2019",
    categories: ["AIoT", "Environmental Sustainability", "Autonomous Monitoring"],
    descriptionZh: "結合智慧感測器與水質偵測巡航小艇,實現自動化、永續的水質監測。",
    descriptionEn: "Uses smart sensors and an autonomous survey boat for sustainable, automated water-quality monitoring.",
    featured: false,
  },
];
