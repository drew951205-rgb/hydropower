# LINE Rich Menu 設定指南

這份文件用來設定「師傅抵嘉」LINE 聊天室底部固定選單。第一版先做顧客版，讓客戶不用輸入文字就能快速打開報修表單或加入會員。

## 檔案

- 設計稿：`public/assets/customer-rich-menu.svg`
- 按鈕座標：`line-rich-menu/customer-rich-menu.json`

LINE Rich Menu 上傳圖片建議使用 PNG 或 JPG。請先把 `public/assets/customer-rich-menu.svg` 匯出成 PNG，尺寸保持：

```text
2500 x 1686
```

## 顧客版按鈕

| 區塊 | 動作 |
|---|---|
| 我要報修 | 開啟 `https://shi-fu-di-jia-api.onrender.com/liff/repair` |
| 加入會員 | 開啟 `https://shi-fu-di-jia-api.onrender.com/liff/profile` |
| 我的案件 | 傳送文字 `我的案件` |
| 最新消息 | 傳送文字 `最新消息` |
| 聯絡客服 | 傳送文字 `聯絡客服` |

目前最重要的是「我要報修」與「加入會員」。其他三個先用文字事件，之後可以再接 LIFF 頁面或客服流程。

## 用 LINE Official Account Manager 手動設定

1. 進入 LINE Official Account Manager。
2. 選你的官方帳號。
3. 左側找到「聊天」或「Rich Menu / 圖文選單」。
4. 新增圖文選單。
5. 上傳從 `customer-rich-menu.svg` 匯出的 PNG 圖。
6. 設定顯示期間，可以先設今天到一年後。
7. 選「顯示於聊天室底部」。
8. 依照下表設定區塊：

| 區塊 | 類型 | 內容 |
|---|---|---|
| 我要報修 | 連結 | `https://shi-fu-di-jia-api.onrender.com/liff/repair` |
| 加入會員 | 連結 | `https://shi-fu-di-jia-api.onrender.com/liff/profile` |
| 我的案件 | 文字 | `我的案件` |
| 最新消息 | 文字 | `最新消息` |
| 聯絡客服 | 文字 | `聯絡客服` |

## 建議下一步

後續可以再做兩個加強：

1. 師傅版 Rich Menu  
   內容可以是「我的案件」、「加入師傅」、「退出師傅」、「報價說明」。

2. 自動建立 Rich Menu 腳本  
   用 LINE Messaging API 讀取 `line-rich-menu/customer-rich-menu.json`，上傳 PNG，並設為預設選單。

## 用腳本自動建立

如果你已經有 `LINE_CHANNEL_ACCESS_TOKEN`，也可以用腳本建立。

先把 `public/assets/customer-rich-menu.svg` 匯出為：

```text
line-rich-menu/customer-rich-menu.png
```

再執行：

```bash
node scripts/create-rich-menu.js
```

腳本會做三件事：

1. 建立 Rich Menu。
2. 上傳 `customer-rich-menu.png`。
3. 設為所有使用者的預設 Rich Menu。

## 注意

如果從一般瀏覽器開 LIFF 網址，可能抓不到 LINE user id。從 LINE Rich Menu 開啟時，LIFF 會取得 LINE 使用者資料，報修與會員頁會正常綁定客戶。
