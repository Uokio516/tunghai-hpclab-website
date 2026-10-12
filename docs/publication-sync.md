# 論文自動更新

`/publications` 讀取 `/api/publications`，每週同步 OpenAlex 與 Crossref。Google Scholar 僅作參考連結，沒有排程抓取 Scholar。

## 模組與資料流

- `publication-sync.ts`：來源讀取、教授身分驗證、完整分頁、DOI 去重、Crossref 欄位核對、失敗保留與每週排程判斷。
- `src/data/publications.default.json`：已實際查詢的初始清單，由 `tools/collect-publications.ts` 產生。保留 `src/data/publications.ts` 的既有精選著作，未在來源中找到者不直接刪除。
- `member-service.ts`：既有單一寫入服務在 SQLite 建立 `publication_cache` 表。成功清單、嘗試時間與錯誤狀態持久保存；不寫網站 hostPath。
- `server.ts`：網站副本代理內部 `/publications`，公開 `/api/publications`。內部服務不可用時回傳映像內初始清單，標記 `syncDelayed`。
- `PublicationsPage.tsx`：搜尋、年份篩選、24 筆分批載入、作者資訊、DOI 連結及最近更新日期。
- `PublicationSyncAdmin.tsx`：在 `/admin/members` 登入後顯示同步狀態、下次更新與手動更新。

## 作者與去重

教授 ORCID：`0000-0002-9579-4426`。
已確認同一教授的 OpenAlex 作者 ID：`A5031161487`、`A5101008873`、`A5138152082`。每次同步先用 ORCID 驗證這些固定 ID，再合併其著作；不使用姓名模糊搜尋。

DOI 統一小寫、移除 doi.org 前綴。同 DOI 合併，Crossref metadata 優先。不同 DOI 不會僅因題目相同而刪除。無 DOI 資料依題目、年份與期刊去重；既有精選著作只有在題目已存在時才合併。

Crossref 使用 ORCID 批次查詢；只核對返回的 DOI，尚未核對的文章仍保留 OpenAlex 資料，前端不宣稱全數經 Crossref 核對。
資料庫收錄範圍不同，筆數不等同 Google Scholar，亦不展示混合來源的引用次數或 h-index。

## 排程與失敗行為

單一服務每小時檢查一次到期狀態，距上次成功七天才同步。服務重啟後仍按資料庫時間判斷。來源錯誤六小時後才重試；手動更新可立即觸發。並行要求共用同一同步工作。

兩個來源都完整讀取後才替換清單。來源錯誤、作者 ORCID 改變、異常空清單或筆數突然少於原本 70% 時，保留上次成功資料，後台顯示錯誤。來源失敗不會清空網站。

`OPENALEX_API_KEY` 可選，僅設在內部 `hpc-lab-members` 環境。基本 API 可匿名查詢；若日後需要較大配額可使用免費 key。Key 不回傳瀏覽器。測試可設定 `PUBLICATION_SYNC_DISABLED=true` 停用背景排程。

## 操作與驗證

重新建立映像內清單：`npx tsx tools/collect-publications.ts`。
檢查：`npm run lint`、`npm run test:publications`、`npm run test:members`、`npm run build`。
部署前用 `tools/backup-sqlite.cjs` 備份成員 SQLite 及 avatars；先更新 `hpc-lab-members`，再更新 `hpc-lab-site`，核對兩者實際映像。

來源文件：
- https://help.openalex.org/api/
- https://help.openalex.org/api/authentication/
- https://www.crossref.org/documentation/retrieve-metadata/rest-api/access-and-authentication/
- https://scholar.google.com/intl/en/scholar/help.html
