# 遊戲頁維護

入口 `/games`；頂部導覽與選單共用 `src/lib/constants.ts`。目前提供「算力 2048」，支援繁體中文、英文、明暗主題、鍵盤、滑動與方向按鈕。

- `src/lib/compute2048.ts`：純函式遊戲規則、合併計分、隨機生成、可行步數判定。
- `src/components/pages/GamesPage.tsx`：畫面、輸入、單步復原、達成 2048 後繼續、重新開始。
- `src/styles/games.css`：響應式版面、晶片出現與合併動畫，尊重減少動態效果設定。
- `tools/test-compute2048.ts`：執行 `npx tsx tools/test-compute2048.ts` 驗證規則。

最高分使用 localStorage `hpclab-compute2048-best`，不傳送伺服器、不建立帳號或公開排行榜；禁止儲存時仍可玩。重新整理開始新局。新遊戲可以使用一次復原回到前局。棋盤自行處理鍵盤輸入，不攔截其他區域的捲動；棋盤區停用全站滑鼠特效。

玩法參考 Gabriele Cirulli 的 2048，邏輯與介面由本專案實作。遊戲數字不代表實驗室實際算力。
