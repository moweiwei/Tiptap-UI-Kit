

---

# 📘 Tiptap 协同文档系统设计方案（Java + Postgres + Redis）

## 一、技术栈

```md
前端：
- Vue3
- Tiptap UI Kit
- Yjs
- Hocuspocus Provider

后端：
- Java（业务 API）
- Node.js（协同服务 Hocuspocus）

基础设施：
- PostgreSQL（数据存储）
- Redis（协同扩展 & 广播）
```

---

## 二、系统架构

```md
                ┌────────────────────┐
                │     前端（Vue3）     │
                │   Tiptap Editor    │
                └────────┬───────────┘
                         │
                     WebSocket
                         │
                         ▼
                ┌────────────────────┐
                │ 协同服务（Node）    │
                │ Hocuspocus + Yjs   │
                └────────┬───────────┘
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
     PostgreSQL        Redis        Java API
```

---

## 三、核心功能

```md
- 实时协同编辑（Yjs + WebSocket）
- 用户光标显示（awareness）
- 文档权限控制（读 / 写）
- 历史版本管理（snapshot）
```

---

## 四、数据模型设计（Postgres）

### 4.1 文档表

```sql
CREATE TABLE document (
  id            VARCHAR PRIMARY KEY,
  title         VARCHAR,
  owner_id      VARCHAR,
  created_at    TIMESTAMP,
  updated_at    TIMESTAMP
);
```

---

### 4.2 权限表

```sql
CREATE TABLE document_permission (
  id         SERIAL PRIMARY KEY,
  doc_id     VARCHAR,
  user_id    VARCHAR,
  role       VARCHAR, -- owner/editor/viewer
  created_at TIMESTAMP
);
```

---

### 4.3 历史版本表

```sql
CREATE TABLE document_version (
  id          SERIAL PRIMARY KEY,
  doc_id      VARCHAR,
  snapshot    BYTEA,     -- Yjs binary
  created_by  VARCHAR,
  created_at  TIMESTAMP
);
```

---

## 五、协同服务（Hocuspocus）

### 5.1 安装依赖

```bash
pnpm add @hocuspocus/server @hocuspocus/extension-redis
```

---

### 5.2 基础服务

```ts
import { Server } from '@hocuspocus/server'

const server = new Server({
  port: 1234,
})

server.listen()
```

---

### 5.3 Redis 扩展（必须）

```ts
import { Redis } from '@hocuspocus/extension-redis'

extensions: [
  new Redis({
    host: '127.0.0.1',
    port: 6379,
  }),
]
```

---

### 5.4 加载文档（从 Postgres）

```ts
onLoadDocument: async ({ documentName }) => {
  const res = await pg.query(
    'SELECT snapshot FROM document_version WHERE doc_id=$1 ORDER BY id DESC LIMIT 1',
    [documentName]
  )

  if (res.rows.length) {
    return res.rows[0].snapshot
  }

  return null
}
```

---

### 5.5 保存文档（自动持久化）

```ts
onStoreDocument: async ({ documentName, document }) => {
  await pg.query(
    'INSERT INTO document_version (doc_id, snapshot, created_at) VALUES ($1, $2, NOW())',
    [documentName, document]
  )
}
```

---

### 5.6 权限校验（调用 Java）

```ts
onAuthenticate: async ({ token, documentName }) => {
  const res = await fetch('http://java-api/check-permission', {
    method: 'POST',
    body: JSON.stringify({ token, docId: documentName }),
  })

  if (!res.ok) {
    throw new Error('Unauthorized')
  }
}
```

---

## 六、前端实现（Vue3 + Tiptap）

### 6.1 安装依赖

```bash
pnpm add yjs @tiptap/extension-collaboration \
@tiptap/extension-collaboration-caret \
@hocuspocus/provider
```

---

### 6.2 协同初始化

```ts
import * as Y from 'yjs'
import { HocuspocusProvider } from '@hocuspocus/provider'

export function useCollab(docId, user) {
  const ydoc = new Y.Doc()

  const provider = new HocuspocusProvider({
    url: 'ws://your-domain:1234',
    name: docId,
    token: user.token,
  })

  return { ydoc, provider }
}
```

---

### 6.3 Editor 初始化

```ts
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCaret from '@tiptap/extension-collaboration-caret'

const editor = new Editor({
  extensions: [
    StarterKit.configure({
      undoRedo: false,
    }),

    Collaboration.configure({
      document: provider.document,
    }),

    CollaborationCaret.configure({
      provider,
      user: {
        name: user.name,
        color: user.color,
      },
    }),
  ],
})
```

---

### ⚠️ 注意

```md
❌ 不要使用 content 初始化
❌ 不要开启 undoRedo
```

---

## 七、权限系统设计

### 7.1 权限模型

```md
owner  → 可管理权限
editor → 可编辑
viewer → 只读
```

---

### 7.2 前端控制

```ts
editor.setEditable(role !== 'viewer')
```

---

### 7.3 后端校验（强制）

```md
Hocuspocus → onAuthenticate → Java API
```

---

## 八、历史版本设计

### 8.1 保存版本

```ts
import { encodeStateAsUpdate } from 'yjs'

const snapshot = encodeStateAsUpdate(ydoc)

await api.saveVersion({
  docId,
  snapshot,
})
```

---

### 8.2 恢复版本

```ts
import { applyUpdate } from 'yjs'

applyUpdate(ydoc, snapshot)
```

---

### 8.3 版本接口

```http
GET  /versions?docId=xxx
POST /versions
POST /versions/restore
```

---

### 8.4 版本策略

```md
- 手动保存版本
- 每5分钟自动快照
- 重要操作自动保存
```

---

## 九、前端项目结构建议

```md
src/
 ├── editor/
 │   ├── useCollab.ts
 │   ├── usePermission.ts
 │   ├── useVersion.ts
 │
 ├── components/
 │   ├── Editor.vue
 │   ├── VersionPanel.vue
 │   └── UserPresence.vue
```

---

## 十、部署方案

### 10.1 nginx（WebSocket）

```nginx
location /ws {
  proxy_pass http://node:1234;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
}
```

---

### 10.2 服务拆分

```md
协同服务：Node（Hocuspocus）
业务服务：Java
数据库：Postgres
缓存：Redis
```

---

## 十一、关键设计原则

```md
1️⃣ 文档内容必须使用 Yjs（二进制），不能用 HTML

2️⃣ 协同必须使用 Hocuspocus，不建议自研

3️⃣ 权限必须三层控制：
   - 前端
   - WebSocket
   - 后端 API

4️⃣ 历史版本使用 snapshot（Yjs）
```

---

## 十二、扩展能力（后续可加）

```md
- 评论系统（mark + side panel）
- 文档锁（段落级）
- 操作审计日志
- diff 对比（类似 Git）
- 离线编辑（IndexedDB）
```

---

# ✅ 使用方式（给 AI）

你可以直接把这份文档丢给 AI，然后说：

```md
请基于这份方案：

1. 生成 Vue3 + Tiptap 完整前端代码
2. 生成 Node Hocuspocus 服务代码
3. 生成 Java Spring Boot 后端接口
4. 生成 PostgreSQL 初始化 SQL
```

---

如果你下一步要更狠一点，我可以帮你直接做👇

👉 **“一键生成：完整前后端代码（可运行项目结构）”**
👉 或帮你优化：**大文档性能 / 表格协同 / 光标同步问题**
