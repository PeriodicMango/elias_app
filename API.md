# Elias REST API Reference

Base URL: `http://<host>:3457`

## Authentication

| Method | Header | How |
|--------|--------|-----|
| Session cookie | `Cookie: connect.sid=...` | Set by Discord OAuth login. Works same-origin. |
| Bearer token | `Authorization: Bearer <token>` | Cross-origin (Capacitor/PWA). Get from `POST /api/auth/token`. |

All `/api/*` routes require auth (unless noted). 401 → `{ "error": "未登录。请先通过 Discord 登录。" }`

---

## Public Routes (no auth)

### `GET /auth/login`
Redirect to Discord OAuth authorize URL.

```
→ 302 https://discord.com/api/oauth2/authorize?client_id=...&redirect_uri=...&scope=identify&state=0|1
```

State `1` = login initiated from Tailscale HTTPS domain (triggers session handoff after callback).

### `GET /auth/callback?code=<code>&state=<0|1>`
Discord OAuth callback. Exchanges code for token, fetches user, verifies master, sets session.

```
← 302 /                        (normal flow)
← 302 <TAILSCALE_URL>/auth/handoff?token=...  (PWA handoff)
← 403 你不是我的 Master。
```

### `GET /auth/handoff?token=<token>`
Session handoff from HTTP to HTTPS domain. Sets session cookie from one-time token.

```
← 302 /
← 410 登录已过期，请重新登录。
```

### `GET /auth/logout`
Destroys session, redirects to `/`.

---

## Auth Token

### `GET /api/auth/me`
Current user info.

```json
// ← 200
{ "id": "string", "username": "string", "avatar": "string" }
```

### `POST /api/auth/token`
Generate a Bearer token for cross-origin API access.

```json
// ← 200
{ "token": "hex-string" }
```
Token valid 7 days. Stored in `localStorage("elias-auth-token")`.

---

## Home

### `GET /api/home/greeting?persona=<name>`
LLM-generated in-character greeting. Cached per persona until restart.

```json
// ← 200
{ "greeting": "唔…来了啊。" }
```

---

## Chat

### `POST /api/chat`
Send a message to a persona.

```json
// → body
{
  "persona": "elias",    // optional, default "elias"
  "message": "你好",      // required
  "fastMode": false       // optional, skip thinking
}

// ← 200
{
  "reply": "string",
  "thinking": "string",
  "toolsUsed": ["string"],
  "mood": "string"
}
```

### `POST /api/chat/clear`
Clear chat history for current session.

```json
// ← 200
{ "ok": true }
```

---

## Personas

### `GET /api/personas`
List all personas (summary).

```json
// ← 200
{
  "personas": [
    { "name": "elias", "displayName": "Elias", "triggers": ["elias"], "masterTitle": "指挥官" }
  ]
}
```

### `GET /api/personas/:name`
Full persona details.

```json
// ← 200
{
  "name": "elias",
  "displayName": "Elias",
  "triggers": ["elias", "伊莱亚斯"],
  "masterTitle": "指挥官",
  "avatarUrl": "string",
  "fileContent": "string (full .md content)"
}
```

### `PUT /api/personas/:name`
Update persona file + avatar.

```json
// → body (at least one field)
{
  "fileContent": "string",
  "avatarUrl": "string",
  "avatarData": "data:image/png;base64,..."
}

// ← 200
{ "ok": true, "updated": true }
```

### `POST /api/personas/rename`
Rename a persona.

```json
// → body
{ "from": "elias", "to": "elias_v2" }

// ← 200
{ "ok": true, "message": "已重命名 elias → elias_v2" }
```

---

## Dashboard

### `GET /api/dashboard`
System status overview.

```json
// ← 200
{
  "uptime": 86400,
  "memory": { "heapMB": 64.2, "rssMB": 128.5 },
  "model": "deepseek-v4-pro",
  "apiUrl": "https://api.openai.com/v1",
  "masterId": "1234****",
  "personas": 3,
  "kbOk": true,
  "eliasDataOk": true
}
```

---

## Settings — API Config

### `GET /api/settings/api`

```json
// ← 200
{ "model": "deepseek-v4-pro", "apiUrl": "https://...", "apiKey": "sk-abc123****" }
```

### `PUT /api/settings/api`

```json
// → body (all optional — omit to keep current value)
{ "model": "string", "url": "string", "key": "string" }

// ← 200
{ "ok": true }
```

---

## Settings — Proactive

### `GET /api/settings/proactive`

```json
// ← 200
{
  "paused": false,
  "pausedUntil": null,
  "personas": [
    { "name": "elias", "displayName": "Elias", "proactiveEnabled": true }
  ]
}
```

### `POST /api/settings/proactive/pause`

```json
// → body
{ "duration": "30m" }    // 30m, 1h, 2h, etc.

// ← 200
{ "ok": true, "pausedUntil": "2026-07-06T...Z" }
```

### `POST /api/settings/proactive/resume`

```json
// ← 200
{ "ok": true }
```

### `PUT /api/settings/proactive/:persona`

```json
// → body
{ "enabled": true }

// ← 200
{ "ok": true }
```

---

## Settings — Group Chat

### `GET /api/settings/groupchat`

```json
// ← 200
{
  "enabled": false,
  "channelId": null,
  "personas": [
    { "name": "raw", "displayName": "Raw", "inGroupChat": true }
  ]
}
```

### `PUT /api/settings/groupchat/:persona`

```json
// → body
{ "enabled": false }

// ← 200
{ "ok": true }
```

---

## Settings — Master

### `GET /api/settings/master`

```json
// ← 200
{ "masterId": "1234567890" }
```

### `POST /api/settings/master/transfer`

```json
// → body
{ "newId": "9876543210" }

// ← 200
{ "ok": true, "message": "Master 已转让至 9876543210" }
```

---

## Vault (Knowledge Base)

### `GET /api/vault/tree`
Directory tree of vault + elias_data.

```json
// ← 200
{
  "roots": [
    {
      "name": "Elias Data",
      "path": "/data",
      "type": "directory",
      "children": [
        { "name": "notes.md", "path": "data/notes.md", "type": "file" }
      ]
    }
  ]
}
```

### `GET /api/vault/read?path=<path>&source=<vault|data>`
Read a file.

```json
// ← 200
{ "path": "data/notes.md", "source": "data", "content": "..." }
// ← 404 file not found
```

### `POST /api/vault/write`
Write/update a file in elias_data.

```json
// → body
{ "filePath": "notes/todo.md", "content": "# TODO\n..." }

// ← 200
{ "ok": true, "path": "notes/todo.md" }
```

### `DELETE /api/vault/delete`
Delete a file from elias_data.

```json
// → body
{ "filePath": "notes/old.md" }

// ← 200
{ "ok": true }
```

### `GET /api/vault/search?q=<term>`
Full-text search across vault + elias_data.

```json
// ← 200
{
  "results": [
    { "path": "data/notes.md", "source": "data", "matches": ["...term..."] }
  ]
}
```

---

## Goals

### `GET /api/goals`
List goals.

```json
// ← 200
{
  "goals": [
    { "id": "goal-1700000000-abc1", "text": "健身", "raw": "- [ ] 健身" }
  ],
  "raw": "- [ ] 健身\n"
}
```

### `POST /api/goals`
Add a goal.

```json
// → body
{ "action": "add", "description": "健身", "due": "2026-07-10" }

// ← 200
{ "ok": true, "message": "已添加目标: 健身" }
```

### `PUT /api/goals/:id`
Mark goal as done.

```json
// → body
{ "action": "done" }

// ← 200
{ "ok": true, "message": "已标记完成" }
```

---

## Activity Logs

### `GET /api/activity?date=<YYYY-MM-DD>`
Daily activity log. Date defaults to today (Australia/Sydney).

```json
// ← 200
{ "date": "2026-07-06", "content": "..." }
```

### `GET /api/activity/addresses`
Saved addresses file.

```json
// ← 200
{ "content": "..." }
```

---

## Error Responses

All errors follow this shape:

```json
{ "error": "human-readable message" }
```

| Status | Meaning |
|--------|---------|
| 400 | Missing/invalid parameters |
| 401 | Not authenticated |
| 403 | Not authorized (not master) |
| 404 | Resource not found |
| 410 | Expired (handoff token) |
| 500 | Server error |

---

## CORS

`/api/*` routes include CORS headers:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Allow-Credentials: true
```

OPTIONS preflight returns 204.
