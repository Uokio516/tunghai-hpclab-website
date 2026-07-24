export interface ResearchArea {
  id: string;
  index: string;
  titleZh: string;
  titleEn: string;
  keywords: string[];
  descriptionZh: string;
  descriptionEn: string;
}

export const researchAreas: ResearchArea[] = [
  {
    id: "hpc",
    index: "01",
    titleZh: "高效能計算",
    titleEn: "High Performance Computing",
    keywords: ["Parallel Computing", "Multicore Computing", "Cluster Computing", "Grid Computing", "Performance Optimization", "Resource Scheduling"],
    descriptionZh: "研究處理大規模複雜運算工作負載的計算架構與平行系統。",
    descriptionEn: "We explore computational architectures and parallel systems designed to process complex workloads at scale.",
  },
  {
    id: "cloud",
    index: "02",
    titleZh: "雲端與分散式系統",
    titleEn: "Cloud & Distributed Systems",
    keywords: ["Cloud Computing", "Distributed Systems", "OpenStack", "Kubernetes", "Virtualization", "Cloud Storage"],
    descriptionZh: "設計可跨雲端與邊緣環境連結分散式資源的可擴展、具韌性的運算基礎設施。",
    descriptionEn: "We design scalable and resilient computing infrastructures that connect distributed resources across cloud and edge environments.",
  },
  {
    id: "big-data",
    index: "03",
    titleZh: "大數據與資料平台",
    titleEn: "Big Data & Data Platforms",
    keywords: ["Big Data", "Hadoop", "HDFS", "Ceph", "ELK Stack", "Data Visualization"],
    descriptionZh: "透過可擴展的儲存、處理與視覺化系統,將大規模資料轉化為可用知識。",
    descriptionEn: "We transform large-scale data into usable knowledge through scalable storage, processing, and visualization systems.",
  },
  {
    id: "ai",
    index: "04",
    titleZh: "人工智慧",
    titleEn: "Artificial Intelligence",
    keywords: ["Machine Learning", "Deep Learning", "Neural Networks", "Computer Vision", "Prediction", "Intelligent Systems"],
    descriptionZh: "開發能從資料中學習、並在複雜真實世界情境中輔助決策的智慧系統。",
    descriptionEn: "We develop intelligent systems that learn from data and support decision-making in complex real-world environments.",
  },
  {
    id: "aiot",
    index: "05",
    titleZh: "AIoT 與邊緣運算",
    titleEn: "AIoT & Edge Computing",
    keywords: ["AIoT", "Edge Computing", "Cloud-Edge Architecture", "IoT", "Sensor Networks", "Intelligent Monitoring"],
    descriptionZh: "透過分散式感測器、邊緣裝置與 AI 系統,將智慧運算與實體環境連結。",
    descriptionEn: "We connect intelligent computation with physical environments through distributed sensors, edge devices, and AI systems.",
  },
  {
    id: "smart-applications",
    index: "06",
    titleZh: "智慧應用",
    titleEn: "Smart Applications",
    keywords: ["Smart Campus", "Environmental Monitoring", "Healthcare", "Energy Monitoring", "Air Quality", "Medical AI"],
    descriptionZh: "將運算智慧應用於環境、醫療、能源與智慧系統等真實世界的挑戰。",
    descriptionEn: "We apply computational intelligence to real-world challenges in environments, healthcare, energy, and smart systems.",
  },
];
