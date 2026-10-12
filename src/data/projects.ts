export interface Project {
  id: string;
  titleZh: string;
  titleEn: string;
  categories: string[];
  descriptionZh: string;
  descriptionEn: string;
  image: string;
  imageAltZh: string;
  imageAltEn: string;
  imageKind: "original" | "recreated";
  group: "research" | "platform";
  featured: boolean;
}

// System images were supplied by the lab. The tennis image is a reconstruction
// from the screenshot and is labeled accordingly in the interface.
export const projects: Project[] = [
  {
    id: "tennis-analysis", titleZh: "網球比賽分析助手", titleEn: "Tennis Match Analysis Assistant",
    categories: ["電腦視覺", "運動分析", "影片處理"],
    descriptionZh: "從比賽影片整理回合、球員站位、擊球速度與落點，將球場軌跡和統計結果放在同一個分析畫面。",
    descriptionEn: "Organizes rallies, player positions, shot speeds and landing points from match video, with trajectories and statistics in one view.",
    image: "/images/projects/tennis-analysis.webp", imageAltZh: "網球比賽分析助手的球場軌跡與回合統計畫面示意", imageAltEn: "Recreated tennis analysis view with court trajectories and rally statistics", imageKind: "recreated", group: "research", featured: true,
  },
  {
    id: "trackguard", titleZh: "TrackGuard 車輛碰撞偵測", titleEn: "TrackGuard Vehicle Collision Detection",
    categories: ["電腦視覺", "車輛追蹤", "交通安全"],
    descriptionZh: "從道路攝影畫面標出車輛與行人、追蹤移動軌跡，並在介面中呈現碰撞警示與事件統計。畫面為展示截圖，不是即時影像。",
    descriptionEn: "Marks vehicles and pedestrians in road video, tracks their trajectories and presents collision alerts and event counts. The image is a showcase, not a live feed.",
    image: "/images/projects/trackguard.webp", imageAltZh: "TrackGuard 道路車輛追蹤與碰撞偵測畫面示意", imageAltEn: "Recreated TrackGuard road scene with vehicle tracking and collision detection", imageKind: "recreated", group: "research", featured: true,
  },
  {
    id: "cardiollm", titleZh: "CardioLLM 心臟超音波與病歷摘要", titleEn: "CardioLLM Cardiac Report Intelligence",
    categories: ["醫療 AI", "LLM", "心臟超音波"],
    descriptionZh: "與台中榮總合作的研究系統，結合心臟超音波資料、病歷轉譯及語言模型訓練，探索臨床摘要的輔助流程。畫面為登入入口。",
    descriptionEn: "A research system with Taichung Veterans General Hospital exploring echocardiography data, report translation, language-model training and clinical summaries. The image shows the sign-in screen.",
    image: "/images/projects/echollm.jpg", imageAltZh: "CardioLLM 心臟分析工作站登入畫面", imageAltEn: "CardioLLM sign-in screen", imageKind: "original", group: "research", featured: true,
  },
  {
    id: "icems", titleZh: "ICEMS 智慧校園監測", titleEn: "ICEMS Smart Campus Monitoring",
    categories: ["智慧校園", "用電監測", "環境資料"],
    descriptionZh: "呈現校園用電、區域比較及環境資訊，讓使用者從儀表板查看監測數據。圖中的數值是擷取當時的畫面。",
    descriptionEn: "A campus dashboard for electricity use, area comparisons and environmental data. Values shown belong to the captured screen.",
    image: "/images/projects/icems.jpg", imageAltZh: "ICEMS 智慧校園監測儀表板畫面", imageAltEn: "ICEMS campus monitoring dashboard", imageKind: "original", group: "research", featured: true,
  },
  {
    id: "kebbi", titleZh: "Kebbi 對話紀錄系統", titleEn: "Kebbi Conversation Archive",
    categories: ["對話系統", "資料管理", "機器人"],
    descriptionZh: "整理機器人對話紀錄，提供篩選、查詢與管理介面。截圖為受權限保護的管理畫面。",
    descriptionEn: "An interface for filtering, searching and managing robot conversation records. The captured view is an access-controlled administrative screen.",
    image: "/images/projects/kebbi.jpg", imageAltZh: "Kebbi 對話紀錄管理畫面", imageAltEn: "Kebbi conversation archive screen", imageKind: "original", group: "research", featured: false,
  },
  {
    id: "proxmox", titleZh: "Proxmox 虛擬化叢集", titleEn: "Proxmox Virtualization Cluster",
    categories: ["虛擬化", "運算平台", "叢集管理"],
    descriptionZh: "實驗室的虛擬化管理畫面，集中檢視實體節點與虛擬機器。此處展示的是歷史截圖。",
    descriptionEn: "A lab virtualization console for viewing physical nodes and virtual machines. This is a historical screenshot.",
    image: "/images/projects/proxmox.jpg", imageAltZh: "Proxmox 節點與虛擬機器清單", imageAltEn: "Proxmox node and virtual machine list", imageKind: "original", group: "platform", featured: false,
  },
  {
    id: "cubecos", titleZh: "CubeCOS 私有雲平台", titleEn: "CubeCOS Private Cloud",
    categories: ["私有雲", "資源配置", "服務健康度"],
    descriptionZh: "以儀表板檢視虛擬機器配置、運算資源與平台健康資訊。畫面中的數字是擷取時的快照。",
    descriptionEn: "A dashboard for virtual machine allocation, compute resources and platform health. Numbers shown are a capture-time snapshot.",
    image: "/images/projects/cubecos.jpg", imageAltZh: "CubeCOS 私有雲資源與健康儀表板", imageAltEn: "CubeCOS resource and health dashboard", imageKind: "original", group: "platform", featured: false,
  },
  {
    id: "esxi", titleZh: "VMware ESXi 虛擬化", titleEn: "VMware ESXi Virtualization",
    categories: ["虛擬化", "研究服務", "基礎設施"],
    descriptionZh: "展示既有虛擬機器與研究服務的管理介面；影像為歷史截圖。",
    descriptionEn: "A management view of virtual machines and research services. This is a historical image.",
    image: "/images/projects/esxi.jpg", imageAltZh: "VMware ESXi 虛擬機器清單", imageAltEn: "VMware ESXi virtual machine list", imageKind: "original", group: "platform", featured: false,
  },
];
