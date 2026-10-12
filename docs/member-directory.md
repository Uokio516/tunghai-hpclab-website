# 成員名單管理（2026-10-11）

操作與維護說明已整合於線上 `/admin/members`：登入後展開「名單管理手冊」即可閱讀，並支援中英切換。畫面元件為 `src/components/DirectoryGuide.tsx`；本文件供原始碼交接參考，修改操作規則時應同步更新線上教學。

現行名單由管理者在 `/admin/members` 維護，不需信箱、密碼或邀請。公開 `/people` 分成碩一、碩二、畢業學長姊三組，以姓名卡片顯示畢業年份與就學期間，教授區維持原有資訊。

畢業名單以 `displayOrder` 連續排列，不按年份或原始段落分段。正整數越小越前，0 列在已指定順序者後面；相同順序以 ID 排列。管理者可在後台修改顯示順序。`yearEstimated` 標記尚未確認的推估年份，公開卡片顯示「2024 年畢業（待確認）」；核對後可取消勾選。`cohortGroup` 僅保留原始段落紀錄。資料庫向後相容新增 `display_order` 與 `year_estimated`，既有資料預設 0。

## 操作流程

1. 用網站 `ADMIN_PASSWORD` 登入 `/admin/members`。
2. 按「新增成員」，填姓名並選分類；畢業學長姊可選畢業西元年。
3. 選就學開始／結束的西元年與月。沒有資料可留空；在校生只有開始時間時顯示「至今」，畢業成員缺結束時間時顯示「結束年月未填」。
4. 儲存後公開名單立即可讀；「修改」可改姓名、分類與日期，「刪除」經確認後移除名單紀錄。

開始與結束時間採 `YYYY-MM`，後端會拒絕無效月份、不完整日期、只有結束時間或結束早於開始。分類由碩二改為畢業學長姊後可補畢業年份；改回在校生會清除畢業年份。允許同名者，以獨立 ID 管理。

## 資料與相容性

- SQLite `directory` 位於既有成員服務 PVC 的 `members.sqlite`，新增名單不建立帳號。
- 第一次啟動由既有已公開 profiles 帶入姓名、分類與畢業年份；沒有精確月份時留空。`directory_migrations` 確保只執行一次，刪除的名字不會在重啟後重現。
- 舊 accounts、profiles、照片保留；舊登入 API 仍可使用，但修改個人資料不會覆寫管理者名單。舊 `/people/:id` 轉至 `/people`。
- `GET /api/members/directory` 只輸出 `id/name/role/graduationYear/studyStart/studyEnd/cohortGroup/displayOrder/yearEstimated`。
- 管理操作使用 `/api/members/admin/directory` 的 GET/POST，以及 `/:id` 的 PUT/DELETE；網站代理仍檢查 `ADMIN_PASSWORD`，成員服務仍檢查內部 token。
- 前端模組：`MemberAdminPage.tsx`、`PeoplePage.tsx`、`src/lib/memberDirectory.ts`；樣式在 `src/styles/members.css`。

## 驗證與部署

執行 `npm run lint`、`npm run build`、`npm run test:members`。整合測試涵蓋舊資料遷移、新增／修改／刪除、年月驗證、重啟保存、公開欄位白名單與未授權拒絕。

更新包含 `member-service.ts`，須先備份 SQLite 與頭像，再部署 `hpc-lab-members` 與 `hpc-lab-site` 並核對兩種 Pod 的 imageID。不要只重啟網站，否則新名單 API 不存在。備份使用 `tools/backup-sqlite.cjs`，不可只複製運作中的主檔。
