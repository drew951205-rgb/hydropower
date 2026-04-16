# 師傅抵嘉

嘉義在地水電緊急維修媒合 MVP。第一版聚焦 LINE 報修、管理員審核派單、師傅接單、到場、報價、完工與顧客確認。

## 快速開始

```bash
npm install
cp .env.example .env
npm run dev
```

開發模式預設 `SKIP_LINE_SIGNATURE=true`，方便用 Postman 或 PowerShell 測試 `/webhook`。正式上線請改為 `false` 並設定 LINE Channel Secret / Access Token。

## 管理後台

啟動 API 後開啟：

```text
http://localhost:3000/admin
```

輸入 `.env` 的 `ADMIN_API_KEY` 後，可以查看訂單、建立師傅、審核、派單、到場、報價、完工與結案。

## 主要 API

- `GET /health`
- `POST /webhook`
- `GET /api/orders`
- `GET /api/orders/:id`
- `POST /api/orders/:id/review`
- `POST /api/orders/:id/dispatch`
- `POST /api/orders/:id/assign`
- `POST /api/orders/:id/cancel`
- `POST /api/orders/:id/platform-review`
- `POST /api/orders/:id/arrive`
- `POST /api/orders/:id/quote`
- `POST /api/orders/:id/change-request`
- `POST /api/orders/:id/complete`
- `POST /api/orders/:id/customer-confirm-quote`
- `POST /api/orders/:id/customer-confirm-completion`
- `POST /api/orders/:id/customer-dispute`
- `GET /api/technicians`
- `POST /api/technicians`
- `POST /api/technicians/:id/toggle-availability`
- `GET /api/technicians/:id/assignments`

管理類 API 需帶 header：`x-admin-api-key: change-me`。

## Supabase

repository 會依環境自動切換：

- 沒有設定 `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`：使用記憶體儲存，適合本機快速測試。
- 有設定 Supabase 環境變數：直接讀寫 Supabase，資料會持久化。

Supabase 資料表 SQL 放在 `supabase/schema.sql`。建立 Supabase project 後，到 SQL Editor 執行該檔案內容，再把 Project URL 與 server secret key 填入 `.env`。

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_or_service_role_key
```

更新 `.env` 後請重新啟動 API。

既有資料庫若要啟用追加報價狀態，請再執行：

```text
supabase/add_change_request_status.sql
```

## 部署

Render 與 LINE 正式 webhook 設定請看：

```text
DEPLOYMENT.md
```

## 建立測試師傅

```powershell
$body = @{
  line_user_id = "U-test-technician-001"
  name = "王師傅"
  phone = "0911222333"
  available = $true
  service_areas = @("西區", "東區")
  service_types = @("漏水", "馬桶堵塞")
} | ConvertTo-Json -Depth 10

Invoke-RestMethod `
  -Uri "http://localhost:3000/api/technicians" `
  -Method Post `
  -Headers @{ "x-admin-api-key" = "change-me" } `
  -ContentType "application/json; charset=utf-8" `
  -Body $body
```
