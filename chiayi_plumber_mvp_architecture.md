# 嘉義水電媒合平台 MVP｜Webhook API 流程圖 + 程式架構

## 1. 專案定位

這個平台前期定位為：

- **嘉義在地水電緊急維修媒合平台**
- 使用 **LINE Official Account + LINE Messaging API** 作為使用者介面
- 使用 **Node.js + Express** 作為後端 webhook 服務
- 使用 **Supabase（PostgreSQL + Storage）** 作為資料與檔案儲存
- 前期採用 **半自動 + 人工控管** 的 MVP 模式

前期不做：

- 平台代收款
- 複雜自動排程派單
- 完整前台網站

前期先做：

1. 顧客 LINE 報修
2. 管理員人工審核與派單
3. 師傅 LINE 接單
4. 報價 / 追加確認
5. 完工回報
6. 雙邊比對與評價
7. 平台保留完整紀錄

---

## 2. 技術架構

### 使用者介面

- LINE Official Account
- LINE Messaging API

### 後端

- Node.js
- Express

### 資料庫

- Supabase（底層 PostgreSQL）

### 檔案儲存

- Supabase Storage

### 部署

- Render（建議 Express API 使用）
- 或 Vercel（若未來改成 Next.js API Routes）

### 安全機制

- X-Line-Signature 驗證
- HTTPS Webhook
- Rate limiting
- 環境變數管理密鑰
- SQL injection 防護
- 權限控管（顧客 / 師傅 / 管理員）
- Webhook 重送防護（冪等處理）
- 操作紀錄與狀態異動 Log
- 上傳檔案大小 / 類型 / 數量限制

---

## 3. 整體系統架構圖

```text
顧客 / 師傅（LINE）
        ↓
LINE Messaging API
        ↓
POST /webhook
        ↓
Webhook Controller
        ↓
Event Router（依角色 / 狀態 / 訊息分流）
        ↓
Service Layer
  ├─ 建立案件
  ├─ 審核案件
  ├─ 派單
  ├─ 接單
  ├─ 到場
  ├─ 報價 / 追加
  ├─ 完工
  ├─ 結案 / 評價
  └─ 取消 / 爭議處理
        ↓
Repository / DB Layer
  ├─ users
  ├─ orders
  ├─ order_messages
  ├─ order_images
  ├─ order_logs
  └─ assignments
        ↓
Supabase / Storage
```

---

## 4. 完整交易流程（工程版）

```text
顧客按「我要報修」
↓
逐步填資料（類型 / 區域 / 地址 / 問題 / 照片 / 聯絡）
↓
送出 → 建立案件 pending_review
↓
管理員審核
  ├─ 正常 → pending_dispatch
  ├─ 補資料 → waiting_customer_info
  └─ 異常 → platform_cancelled
↓
通知 3-5 位符合條件的師傅
↓
師傅按「接單」
↓
平台確認派單 → assigned
↓
師傅到場 → arrived
↓
師傅現場收取出勤費（平台只記錄規則，不代收）
↓
若需追加 → submit_change_request
↓
平台審核 → 顧客 LINE 確認
↓
顧客同意 → in_progress
顧客拒絕 → platform_review / customer_cancelled
↓
施工完工 → technician_submit_completion
↓
顧客確認實付金額與完工結果
↓
平台雙邊比對
  ├─ 正常 → closed
  └─ 異常 → dispute_review
↓
案件結案 + 顧客評價
```

---

## 5. Webhook 事件流程圖

### 5.1 顧客報修流程

```text
LINE 使用者傳訊 / 點按鈕
↓
POST /webhook
↓
verifyXLineSignature()
↓
parse event
↓
findOrCreateUserByLineId()
↓
依 user.role 判斷為 customer
↓
讀取 customer_session.current_step
↓
根據 step 驗證輸入內容
  ├─ 驗證失敗 → reply 錯誤提示
  └─ 驗證成功 → 更新 session + 寫入暫存資料
↓
若尚未完成所有欄位 → 回下一題
↓
若完成全部欄位 → 建立 order + logs + message records
↓
reply「已建立案件」
↓
notify 管理員審核
```

### 5.2 管理員審核 / 派單流程

```text
管理員於後台查看 pending_review 案件
↓
按「通過審核」
↓
更新 order.status = pending_dispatch
↓
根據 service_type / area / technician_status 撈出 3-5 位師傅
↓
建立 assignment records
↓
push message 給對應師傅
↓
等待師傅回覆「接單」
```

### 5.3 師傅接單流程

```text
師傅在 LINE 按「接單」
↓
POST /webhook
↓
verifyXLineSignature()
↓
find technician by line_user_id
↓
檢查 assignment 是否有效 / 是否仍可接
  ├─ 無效 → reply「案件已被接走或失效」
  └─ 有效 → 進入 lockOrderAssignment()
↓
第一位成功搶單者獲得案件
↓
更新 orders.technician_id
更新 order.status = assigned
寫入 order_logs
↓
push 顧客「已媒合到師傅」
push 師傅完整地址 / 電話
```

### 5.4 到場 / 報價 / 追加流程

```text
師傅按「已到場」
↓
POST /webhook
↓
驗證身分與案件歸屬
↓
update status = arrived
↓
push 顧客「師傅已到場」

師傅填報價
↓
create quote record / update orders.quote_amount
update status = quoted
↓
push 顧客報價按鈕
  ├─ 同意 → quote_accepted → in_progress
  ├─ 拒絕 → quote_rejected → platform_review
  └─ 想再詢問 → negotiation_pending

若有追加
↓
師傅提交 change_request（照片 + 說明 + 金額）
↓
平台審核
↓
顧客按鈕確認
  ├─ 同意 → 更新追加金額，繼續施工
  └─ 拒絕 → platform_review / 關單
```

### 5.5 完工 / 結案流程

```text
師傅按「完工回報」
↓
提交：完工照片 / 明細 / 最終金額
↓
update order.status = completed_pending_customer
↓
push 顧客確認

顧客確認：
  ├─ 完工且金額一致 → closed
  ├─ 金額差異過大 → dispute_review
  └─ 施工有問題 → dispute_review
↓
若 closed
→ push 顧客評價表單 / 按鈕
→ 更新師傅信任分數
```

---

## 6. 建議訂單狀態設計

### 6.1 完整 MVP 狀態

```text
pending_review              待管理員審核
waiting_customer_info       待客戶補資料
pending_dispatch            待派單
dispatching                 派單中
assigned                    已派單
arrived                     已到場
quoted                      已報價
quote_accepted              顧客同意報價
quote_rejected              顧客拒絕報價
negotiation_pending         協商中
in_progress                 施工中
completed_pending_customer  待顧客確認完工
closed                      已結案
customer_cancelled          顧客取消
technician_cancelled        師傅取消
platform_cancelled          平台取消
dispute_review              爭議審核中
```

### 6.2 前期精簡版狀態

```text
pending_review
pending_dispatch
assigned
arrived
quoted
in_progress
completed_pending_customer
closed
customer_cancelled
technician_cancelled
platform_cancelled
platform_review
```

---

## 7. Webhook API 路由設計表

> 說明：LINE 正式 webhook 入口通常只有一個 `POST /webhook`。以下同時列出內部呼叫邏輯與管理後台 API，方便工程實作。

### 7.1 LINE Webhook 入口

#### `POST /webhook`

用途：
- 接收 LINE 傳來的所有事件

處理內容：
- 驗證 `X-Line-Signature`
- 解析 event
- 依角色與狀態分流
- 呼叫對應 service

可能事件：
- message event
- postback event
- follow event
- unfollow event

---

### 7.2 內部事件處理邏輯（Service 對應）

#### `handleFollowEvent(event)`

用途：
- 使用者首次加入 LINE 官方帳號時建立基本帳號

動作：
- 建立或更新 users
- 預設 role = customer
- 發送歡迎訊息

#### `handleCustomerMessage(event)`

用途：
- 處理顧客對話流程

動作：
- 讀取 session step
- 驗證輸入
- 更新暫存資料
- 建立案件或回下一題

#### `handleTechnicianMessage(event)`

用途：
- 處理師傅接單、到場、報價、完工等操作

#### `handlePostbackEvent(event)`

用途：
- 處理按鈕操作

常見 postback：
- `customer:start_repair`
- `customer:confirm_order`
- `customer:accept_quote:{orderId}`
- `customer:reject_quote:{orderId}`
- `technician:accept_assignment:{assignmentId}`
- `technician:arrived:{orderId}`
- `technician:complete:{orderId}`

---

### 7.3 管理後台 API

#### `GET /api/orders`

用途：
- 查詢案件列表

支援條件：
- status
- area
- service_type
- date range
- risk_level

#### `GET /api/orders/:id`

用途：
- 查看單一案件詳情

包含：
- 主資料
- 訊息紀錄
- 圖片
- 狀態 Log
- 指派紀錄

#### `POST /api/orders/:id/review`

用途：
- 管理員審核案件

body 範例：

```json
{
  "action": "approve",
  "note": "資料完整"
}
```

可能 action：
- approve
- request_more_info
- reject

#### `POST /api/orders/:id/dispatch`

用途：
- 手動或半自動派單

body 範例：

```json
{
  "technician_ids": [12, 18, 25]
}
```

動作：
- 建立 assignments
- 推播給師傅
- 更新 status = dispatching

#### `POST /api/orders/:id/assign`

用途：
- 管理員直接指定某位師傅

body 範例：

```json
{
  "technician_id": 12
}
```

#### `POST /api/orders/:id/cancel`

用途：
- 取消案件

body 範例：

```json
{
  "cancelled_by": "platform",
  "reason_code": "duplicate_order",
  "reason_text": "重複送單"
}
```

#### `POST /api/orders/:id/platform-review`

用途：
- 將案件標記為平台介入處理

body 範例：

```json
{
  "reason": "quote_dispute"
}
```

---

### 7.4 師傅專用 API（後台或內部）

#### `POST /api/technicians/:id/toggle-availability`

用途：
- 切換師傅是否可接單

body 範例：

```json
{
  "available": true
}
```

#### `GET /api/technicians/:id/assignments`

用途：
- 查詢師傅目前案件

#### `POST /api/orders/:id/arrive`

用途：
- 師傅回報到場

#### `POST /api/orders/:id/quote`

用途：
- 師傅提交報價

body 範例：

```json
{
  "amount": 1500,
  "note": "漏水檢測與管線處理"
}
```

#### `POST /api/orders/:id/change-request`

用途：
- 師傅提交追加申請

body 範例：

```json
{
  "amount": 600,
  "reason": "拆開後發現額外零件損壞",
  "images": ["url1", "url2"]
}
```

#### `POST /api/orders/:id/complete`

用途：
- 師傅提交完工回報

body 範例：

```json
{
  "final_amount": 2100,
  "summary": "已完成管線更換與測試",
  "images": ["url1", "url2"]
}
```

---

### 7.5 顧客確認 API（後台或內部）

#### `POST /api/orders/:id/customer-confirm-quote`

用途：
- 顧客確認報價

body 範例：

```json
{
  "accepted": true
}
```

#### `POST /api/orders/:id/customer-confirm-completion`

用途：
- 顧客確認完工與實付金額

body 範例：

```json
{
  "confirmed": true,
  "paid_amount": 2100,
  "rating": 5,
  "comment": "處理很快"
}
```

#### `POST /api/orders/:id/customer-dispute`

用途：
- 顧客提報爭議

body 範例：

```json
{
  "reason": "金額與現場說明不一致"
}
```

---

## 8. 專案資料夾結構（Node.js + Express）

```text
chiayi-plumber-platform/
├─ src/
│  ├─ app.js
│  ├─ server.js
│  │
│  ├─ config/
│  │  ├─ env.js
│  │  ├─ line.js
│  │  ├─ supabase.js
│  │  └─ security.js
│  │
│  ├─ routes/
│  │  ├─ webhook.routes.js
│  │  ├─ order.routes.js
│  │  ├─ technician.routes.js
│  │  └─ admin.routes.js
│  │
│  ├─ controllers/
│  │  ├─ webhook.controller.js
│  │  ├─ order.controller.js
│  │  ├─ technician.controller.js
│  │  └─ admin.controller.js
│  │
│  ├─ services/
│  │  ├─ webhook.service.js
│  │  ├─ event-router.service.js
│  │  ├─ line-message.service.js
│  │  ├─ customer-flow.service.js
│  │  ├─ technician-flow.service.js
│  │  ├─ order.service.js
│  │  ├─ dispatch.service.js
│  │  ├─ quote.service.js
│  │  ├─ completion.service.js
│  │  ├─ dispute.service.js
│  │  └─ file-upload.service.js
│  │
│  ├─ repositories/
│  │  ├─ user.repository.js
│  │  ├─ order.repository.js
│  │  ├─ assignment.repository.js
│  │  ├─ message.repository.js
│  │  ├─ image.repository.js
│  │  └─ log.repository.js
│  │
│  ├─ middlewares/
│  │  ├─ verify-line-signature.js
│  │  ├─ rate-limit.js
│  │  ├─ auth-admin.js
│  │  ├─ error-handler.js
│  │  └─ request-logger.js
│  │
│  ├─ validators/
│  │  ├─ customer.validator.js
│  │  ├─ technician.validator.js
│  │  ├─ order.validator.js
│  │  └─ quote.validator.js
│  │
│  ├─ utils/
│  │  ├─ reply-token.js
│  │  ├─ format-message.js
│  │  ├─ order-status.js
│  │  ├─ risk-score.js
│  │  ├─ priority-score.js
│  │  └─ idempotency.js
│  │
│  ├─ templates/
│  │  ├─ customer-messages.js
│  │  ├─ technician-messages.js
│  │  └─ admin-messages.js
│  │
│  └─ jobs/
│     ├─ dispatch-timeout.job.js
│     ├─ unpaid-followup.job.js
│     └─ stale-order.job.js
│
├─ tests/
│  ├─ webhook.test.js
│  ├─ order.test.js
│  └─ dispatch.test.js
│
├─ .env
├─ .env.example
├─ package.json
├─ README.md
└─ render.yaml
```

---

## 9. 各資料夾職責說明

### `config/`

放環境設定與第三方初始化：
- LINE Channel Secret / Token
- Supabase client
- 安全相關設定

### `routes/`

只負責定義路由，不寫商業邏輯。

### `controllers/`

接收 request，呼叫 service，回傳 response。

### `services/`

商業邏輯核心層。

例如：
- 顧客目前填到第幾步
- 是否可接單
- 是否允許追加
- 何時進入爭議流程

### `repositories/`

封裝資料庫操作，避免 SQL / 查詢散落各處。

### `middlewares/`

處理：
- LINE 簽章驗證
- 限流
- 錯誤處理
- 管理員驗證

### `validators/`

做欄位驗證：
- 電話格式
- 地址長度
- 報價金額
- 上傳資料完整性

### `utils/`

放共用工具：
- 狀態列舉
- 風險分數
- priority 計算
- 冪等處理

### `templates/`

統一管理 LINE 訊息模板，避免字串散落。

### `jobs/`

處理背景邏輯：
- 5 分鐘無人接單
- 逾時催收
- 長時間未更新狀態

---

## 10. 建議資料表

### `users`

- id
- line_user_id
- role（customer / technician / admin）
- name
- phone
- trust_score
- status
- created_at

### `orders`

- id
- order_no
- customer_id
- technician_id
- service_type
- area
- address
- issue_description
- status
- quote_amount
- final_amount
- priority_score
- risk_score
- cancelled_by
- cancel_reason_code
- cancel_reason_text
- created_at

### `assignments`

- id
- order_id
- technician_id
- status（pending / accepted / rejected / expired）
- created_at

### `order_messages`

- id
- order_id
- sender_role
- sender_id
- message_type
- content
- created_at

### `order_images`

- id
- order_id
- image_url
- category（issue / quote / completion / change_request）
- created_at

### `order_logs`

- id
- order_id
- from_status
- to_status
- action
- operator_role
- operator_id
- note
- created_at

### `customer_sessions`

- id
- user_id
- flow_type
- current_step
- temp_payload
- updated_at

---

## 11. 安全與穩定性實作重點

### 11.1 X-Line-Signature 驗證

所有 `/webhook` 請求都要驗證簽章，避免假請求打進來。

### 11.2 Idempotency / Webhook 重送保護

LINE 可能重送事件，應記錄 event id 或處理雜湊，避免：

- 重複建單
- 重複接單
- 重複回報完工

### 11.3 Rate Limiting

限制管理後台與公開 API 的請求速率，降低濫用與暴力測試風險。

### 11.4 權限控管

- 顧客只能看自己的案件
- 師傅只能操作自己的派單案件
- 管理員才能審核 / 派單 / 標記爭議

### 11.5 上傳限制

- 限制檔案類型：jpg / png / webp
- 限制大小：如 5MB 內
- 限制數量：每次最多 3 張

---

## 12. 第一版開發優先順序

### 第 1 階段：最低可用版

1. `POST /webhook`
2. 顧客報修流程
3. 建立案件
4. 管理員後台看單
5. 手動派單
6. 師傅接單

### 第 2 階段：交易核心

1. 師傅到場
2. 報價提交
3. 顧客確認報價
4. 完工回報
5. 顧客確認完工

### 第 3 階段：風險控制

1. 追加申請
2. 取消分流
3. 爭議處理
4. timeout job
5. 信任分數與異常單標記

---

## 13. MVP 最後結論

這套架構的重點不是做一個很大的平台，而是做一個：

- 可以收單
- 可以派單
- 可以保留證據
- 可以處理報價與追加
- 可以人工控風險

的 **在地水電媒合 MVP**。

如果只從工程面評估，這套設計的優點是：

- 技術選型簡單
- 成本低
- 容易擴充
- 符合 LINE Bot 使用情境
- 非常適合一人或小團隊先做出第一版

---

## 14. 建議下一步

完成這份架構後，下一步最適合做的是：

1. 先建立 Supabase 資料表
2. 寫 `POST /webhook`
3. 先完成顧客報修 flow
4. 先用管理員人工派單
5. 第一次真實跑單後再修流程

