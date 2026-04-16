# 師傅抵嘉部署指南

這份指南用於把 Express API 部署到 Render，並串接 LINE Messaging API 正式 webhook。

## 1. 部署前確認

本機先確認：

```bash
npm test
npm run dev
```

開啟：

```text
http://localhost:3000/health
```

應回傳：

```json
{ "ok": true, "service": "師傅抵嘉 API" }
```

## 2. Supabase

請確認 Supabase 已執行：

```text
supabase/schema.sql
supabase/add_change_request_status.sql
```

部署環境會需要：

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_or_service_role_key
```

新版 Supabase 請使用 server 端 secret key，不要用 publishable key。

## 3. Render 部署

專案根目錄已提供：

```text
render.yaml
```

Render Blueprint 會建立一個 Node web service：

```text
name: shi-fu-di-jia-api
buildCommand: npm install
startCommand: npm start
healthCheckPath: /health
```

Render Blueprint 建立流程：

1. 把專案推到 GitHub / GitLab / Bitbucket。
2. 到 Render Dashboard。
3. 點 `New`。
4. 選 `Blueprint`。
5. 連接這個 repo。
6. Render 會讀取 `render.yaml`。
7. 填入 `sync: false` 的 secret env vars。

需要填的 Render 環境變數：

```env
ADMIN_API_KEY=請換成強密碼
LINE_CHANNEL_SECRET=LINE channel secret
LINE_CHANNEL_ACCESS_TOKEN=LINE channel access token
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_or_service_role_key
```

Render 會自動提供 `PORT`，不用手動設定。

部署成功後會得到類似：

```text
https://shi-fu-di-jia-api.onrender.com
```

確認：

```text
https://shi-fu-di-jia-api.onrender.com/health
https://shi-fu-di-jia-api.onrender.com/admin/
```

## 4. LINE Developers 設定

到 LINE Developers Console 的 Messaging API channel：

1. 開啟 `Messaging API` tab。
2. 確認或發行 Channel access token。
3. 複製 Channel secret。
4. Webhook URL 填：

```text
https://你的-render-url.onrender.com/webhook
```

注意：一定要是 `/webhook`，不是網站根目錄。

5. 啟用 `Use webhook`。
6. 點 `Verify` 測試 webhook。

正式環境請確認：

```env
SKIP_LINE_SIGNATURE=false
```

## 5. 正式測試路徑

1. 加 LINE 官方帳號好友。
2. 應收到「我要報修」按鈕。
3. 點「我要報修」。
4. 依序輸入服務類型、區域、地址、問題、電話。
5. 到管理後台審核與派單。
6. 師傅 LINE 使用「接單」「已到場」「完工回報」按鈕。
7. 顧客 LINE 使用「同意報價」「同意追加」「確認完工」按鈕。

## 6. 常見問題

### Render health check 失敗

確認：

```text
/health
```

是否回 200。

### LINE Verify 失敗

確認：

```text
Webhook URL = https://你的-render-url.onrender.com/webhook
SKIP_LINE_SIGNATURE=false
LINE_CHANNEL_SECRET 正確
```

### LINE 收不到 push

確認：

```text
LINE_CHANNEL_ACCESS_TOKEN 正確
使用者 line_user_id 是真實 LINE 使用者 ID
```

本機測試用的 `U-test-...` 不能收到正式 LINE push。
