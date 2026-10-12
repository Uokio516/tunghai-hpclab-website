import { BookOpen, ChevronDown } from "lucide-react";
import { useLocale } from "../lib/locale";

export function DirectoryGuide() {
  const { t } = useLocale();
  const steps = [
    [t("新增姓名", "Add a name"), t("按「新增成員」，填姓名，再選碩一、碩二或畢業學長姊。不需要信箱、成員密碼或邀請連結。", "Select Add member, enter a name and choose Master's Year 1, Master's Year 2 or Alumni. No email, member password or invitation is needed.")],
    [t("選擇年份與月份", "Choose years and months"), t("畢業學長姊可選畢業西元年。就學開始與結束各選年、月，例如 2024 年 9 月到 2026 年 6 月；沒有資料時可留空。", "For alumni, select a graduation year. Select the year and month for study start and end, for example September 2024 to June 2026. Unknown dates may be left blank.")],
    [t("儲存並查看名單", "Save and view the directory"), t("按「儲存名單」後，研究成員頁立即更新。用上方「查看公開名單」確認結果；公開卡片顯示姓名、畢業年份與就學期間。", "Select Save to update the People page immediately. Use View public directory to check the name cards, graduation years and study periods.")],
    [t("修改或刪除", "Edit or delete"), t("在姓名卡片按「修改」可改姓名、分類與日期。按「刪除」並確認後，該筆名單立即移除。允許同名者，操作前請確認所選卡片。", "Select Edit on a name card to change its name, category or dates. Select Delete and confirm to remove the entry immediately. Duplicate names are allowed, so check the selected card first.")],
  ];
  const dateRules = [
    t("畢業名單優先按畢業年分段；年份未知時，可選原始名單分組。分組編號不代表已確認的屆別，補上年份後會自動歸入該年。", "Alumni are grouped by graduation year first. For unknown years, select an original directory group. Group numbers do not imply verified classes; a specified year takes priority."),
    t("仍在就學者只填開始年月，結束留空時顯示「至今」。", "For current students, a start date with no end date displays Present."),
    t("畢業成員若填了開始年月但未填結束年月，顯示「結束年月未填」，不會顯示「至今」。", "For alumni with a start date but no end date, the card displays End date not specified instead of Present."),
    t("選了年份就要選月份；結束年月不能早於開始年月，也不能只填結束年月。", "Each selected year needs a month. An end date requires a start date and cannot precede it."),
    t("從碩二改為畢業學長姊時可補畢業年份；改回碩一或碩二會清除畢業年份。", "Changing a student to Alumni enables graduation year selection. Changing back to a student clears the graduation year."),
  ];
  const dataNotes = [
    t("名單由管理者維護，新增姓名不會建立登入帳號。舊帳號、個人資料及照片保留；成員修改舊個人資料不會覆寫這份名單。", "The directory is administrator-owned. Adding a name does not create an account. Existing accounts, profiles and photos are retained; edits to legacy profiles do not overwrite this directory."),
    t("第一次更新只帶入已公開成員的姓名、分類與畢業年份，未知月份留空；暫停公開的資料不會自動重新刊登。遷移只執行一次，刪除的姓名不會因重啟重現。", "The first upgrade imports names, roles and graduation years from published profiles once. Unknown months remain blank and paused profiles stay unpublished. Deleted names do not return after a restart."),
    t("名單存於成員服務 PVC 的 members.sqlite，使用 directory 資料表；directory_migrations 記錄一次性遷移。", "The directory table is stored in members.sqlite on the member service PVC. The directory_migrations table records the one-time migration."),
    t("公開讀取：GET /api/members/directory，只輸出 id、name、role、graduationYear、studyStart、studyEnd、cohortGroup。舊 /people/:id 網址轉至 /people。", "Public endpoint: GET /api/members/directory, exposing only id, name, role, graduationYear, studyStart, studyEnd and cohortGroup. Legacy /people/:id URLs redirect to /people."),
    t("管理 API：/api/members/admin/directory 使用 GET／POST，/:id 使用 PUT／DELETE。網站驗證 ADMIN_PASSWORD，成員服務驗證內部 token。管理密碼只保存在本次頁面記憶體。", "Admin API: GET/POST on /api/members/admin/directory and PUT/DELETE on /:id. The website checks ADMIN_PASSWORD and the member service checks its internal token. The admin password stays in page memory."),
    t("維護入口：MemberAdminPage.tsx、PeoplePage.tsx、DirectoryGuide.tsx、src/lib/memberDirectory.ts；樣式在 src/styles/members.css，後端在 member-service.ts。", "Maintenance files: MemberAdminPage.tsx, PeoplePage.tsx, DirectoryGuide.tsx and src/lib/memberDirectory.ts. Styles live in src/styles/members.css and the backend in member-service.ts."),
  ];
  return <details className="member-panel directory-guide">
    <summary className="directory-guide-summary"><BookOpen size={21} aria-hidden="true" /><span><strong>{t("名單管理手冊", "Directory Handbook")}</strong><small>{t("新增、修改、刪除與年月填寫教學", "How to add, edit, delete and enter study dates")}</small></span><ChevronDown size={18} className="directory-guide-chevron" aria-hidden="true" /></summary>
    <div className="directory-guide-content">
      <ol className="directory-guide-steps">{steps.map(([title, description], index) => <li key={index}><span className="directory-guide-number" aria-hidden="true">{index + 1}</span><h3>{title}</h3><p>{description}</p></li>)}</ol>
      <h3 className="directory-guide-heading">{t("年月與分類規則", "Date and category rules")}</h3>
      <ul className="directory-guide-notes">{dateRules.map(note => <li key={note}>{note}</li>)}</ul>
      <details className="directory-guide-maintenance"><summary>{t("資料保存與開發維護說明", "Data storage and developer maintenance")}</summary>
        <ul className="directory-guide-notes">{dataNotes.map(note => <li key={note}>{note}</li>)}</ul>
        <h3 className="directory-guide-heading">{t("驗證與部署", "Validation and deployment")}</h3>
        <p>{t("修改後執行下列檢查；整合測試涵蓋遷移、名單操作、日期驗證、重啟保存、公開欄位及未授權拒絕。", "Run the following checks after changes. Integration tests cover migration, directory operations, date validation, persistence, public fields and authentication.")}</p>
        <pre><code>{"npm run lint\nnpm run build\nnpm run test:members"}</code></pre>
        <p>{t("部署前使用 tools/backup-sqlite.cjs 備份 SQLite，並備份 avatars 頭像目錄。不要只複製運作中的 SQLite 主檔；還原前應停止資料寫入，並檢查備份完整性。", "Before deployment, use tools/backup-sqlite.cjs to back up SQLite and copy the avatars directory. Do not copy only the active SQLite main file. Stop the writer before restoring and check backup integrity.")}</p>
        <p>{t("若修改 member-service.ts，需先更新 hpc-lab-members，再更新 hpc-lab-site，核對所有 Pod 的 imageID 與推送的 digest 一致；只改前端時更新網站 deployment 即可。", "When member-service.ts changes, update hpc-lab-members first, then hpc-lab-site. Verify all Pod imageIDs match the pushed digest. Frontend-only changes require updating the website deployment.")}</p>
      </details>
    </div>
  </details>;
}
