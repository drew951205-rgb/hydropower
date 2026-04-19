# LINE Rich Menu 設定指南

這份文件用來設定「師傅抵嘉」LINE 聊天室底部固定選單。這一版使用你指定的版型：

```text
上方整排：我要報修
下方三格：加入會員｜我的案件｜聯絡客服
```

## 檔案

- 設計稿：`public/assets/customer-rich-menu.svg`
- LINE API 座標設定：`line-rich-menu/customer-rich-menu.json`
- PNG 輸出位置建議：`line-rich-menu/customer-rich-menu.png`

LINE Rich Menu 上傳圖片建議用 PNG 或 JPG。請先把 `public/assets/customer-rich-menu.svg` 匯出成 PNG，尺寸保持：

```text
2500 x 1686
```

## 在 LINE 後台選模板

請選你截圖中的版型：

```text
上面一整條
下面三格
```

也就是：

```text
┌───────────────┐
│   我要報修     │
├─────┬─────┬───┤
│加入會員│我的案件│客服│
└─────┴─────┴───┘
```

## 按鈕設定

| 位置 | 名稱 | 類型 | 內容 |
|---|---|---|---|
| 上方整排 | 我要報修 | 連結 | `https://shi-fu-di-jia-api.onrender.com/liff/repair` |
| 下方左格 | 加入會員 | 連結 | `https://shi-fu-di-jia-api.onrender.com/liff/profile` |
| 下方中格 | 我的案件 | 文字 | `我的案件` |
| 下方右格 | 聯絡客服 | 文字 | `聯絡客服` |

## 用 LINE Official Account Manager 手動設定

1. 進入 LINE Official Account Manager。
2. 選你的官方帳號。
3. 左側找到「圖文選單」或「Rich Menu」。
4. 新增圖文選單。
5. 選模板：上方一整條、下方三格。
6. 上傳 `customer-rich-menu.svg` 匯出的 PNG 圖。
7. 設定顯示期間，可以先設今天到一年後。
8. 選單列文字填：

```text
選單
```

9. 依照上方表格設定每個區塊。
10. 儲存並啟用。

## 用腳本自動建立

如果你要用 LINE API 建立，先把 PNG 放到：

```text
line-rich-menu/customer-rich-menu.png
```

並確認 `.env` 有：

```text
LINE_CHANNEL_ACCESS_TOKEN=你的 token
```

接著執行：

```bash
npm run line:rich-menu
```

腳本會：

1. 建立 Rich Menu。
2. 上傳 PNG。
3. 設為所有使用者的預設選單。

## 注意

從 LINE Rich Menu 打開 LIFF 頁面時，系統會自動取得使用者資料。若從一般瀏覽器打開，可能需要在網址加上 `line_user_id` 才能測試。
