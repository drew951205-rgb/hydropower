# LINE Rich Menu 重新發布指南

這份文件整理目前專案的 Rich Menu 發布方式，目標是讓我們每次改完入口網址後，都能穩定重新發布，不用再靠記憶操作。

## 目前檔案位置

- 設定檔：`line-rich-menu/customer-rich-menu.json`
- 圖片檔：`line-rich-menu/customer-rich-menu.png`
- 上傳腳本：`scripts/create-rich-menu.js`

## 目前入口策略

目前我們已先把「我要報修」改成一般網站網址，避免卡在 LIFF：

- 我要報修：
  `https://shi-fu-di-jia-platform.vercel.app/liff/repair`

其餘三格目前仍保留既有設定，之後如果要一起改成一般網址或簽名網址策略，再同步更新 `customer-rich-menu.json`。

## 發布前檢查

發布前先確認這三件事：

1. `line-rich-menu/customer-rich-menu.json` 已經是你要的最新網址
2. `line-rich-menu/customer-rich-menu.png` 是最新圖檔
3. `.env` 有正確的 `LINE_CHANNEL_ACCESS_TOKEN`

`.env` 至少要有：

```env
LINE_CHANNEL_ACCESS_TOKEN=你的 Messaging API channel access token
```

## 重新發布指令

在專案根目錄執行：

```bash
npm run line:rich-menu
```

這個腳本會自動做三件事：

1. 建立一個新的 Rich Menu
2. 上傳 `customer-rich-menu.png`
3. 把新的 Rich Menu 設成全體使用者的預設選單

成功時會看到：

```text
Created and set default rich menu: richmenu-xxxxxxxxxxxxxxxx
```

請把這個 `richMenuId` 記下來，之後若要清理舊選單會用到。

## 標準重新發布流程

建議每次都照這個順序做：

1. 修改 `line-rich-menu/customer-rich-menu.json`
2. 如果版面有調整，重新輸出 `line-rich-menu/customer-rich-menu.png`
3. 在本機確認 `.env` 的 `LINE_CHANNEL_ACCESS_TOKEN`
4. 執行：

   ```bash
   npm run line:rich-menu
   ```

5. 到 LINE 手機端確認：
   - 新的 Rich Menu 是否顯示
   - 「我要報修」是否打開一般網站報修頁

## 建議驗證項目

重新發布後，至少驗這兩條：

1. 點 Rich Menu 的「我要報修」
   - 應該打開：
     `https://shi-fu-di-jia-platform.vercel.app/liff/repair`

2. 送出報修單
   - 應成功建立案件
   - 客戶應收到一則「平台正在審核訂單」通知

## 如果要手動在 LINE 後台檢查

可以到 LINE Official Account Manager / LINE Developers 後台確認：

1. 已有新的 Rich Menu
2. 預設 Rich Menu 已指向最新那組
3. 如有舊版本，可視需要手動刪除

## 常見問題

### 1. 為什麼我改了 JSON，手機上沒變？

因為改檔不會自動同步到 LINE。

你一定要重新執行：

```bash
npm run line:rich-menu
```

### 2. 為什麼圖片沒更新？

腳本只會上傳 `line-rich-menu/customer-rich-menu.png`。

如果你改的是設計稿或 SVG，記得先重新輸出 PNG，再執行發布。

### 3. 為什麼還是打開舊網址？

請依序檢查：

1. `customer-rich-menu.json` 是否已改對
2. 是否真的重新執行了 `npm run line:rich-menu`
3. LINE 手機端是否還在看舊的快取畫面

## 推薦操作原則

- 入口型功能（例如我要報修）優先用一般網站網址
- 敏感案件操作保留聊天室按鈕，但改走簽名網址策略
- Rich Menu 每次修改後都重新發布，不假設 LINE 會自動同步
