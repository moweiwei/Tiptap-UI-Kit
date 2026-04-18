# Tiptap 协同编辑功能实现方案

## 一、技术栈

```
前端：
- Vue 3.5 + Composition API (TypeScript)
- Tiptap 3 (ProseMirror)
- Yjs (CRDT 协同引擎)
- @hocuspocus/provider (WebSocket 客户端)
- @tiptap/extension-collaboration (文档同步)
- @tiptap/extension-collaboration-cursor (远程光标)

协同层（Node.js）：
- @hocuspocus/server v2 (WebSocket 协同服务)
- @hocuspocus/extension-redis (多实例 pub/sub)
- PostgreSQL 16 (文档持久化，Yjs 二进制快照)
- Redis 7 (协同广播)

部署：
- Docker Compose (PostgreSQL + Redis + Hocuspocus)
- 云服务器 Ubuntu
```

---

## 二、系统架构

```
┌─────────────────────────┐     ┌─────────────────────────┐
│   浏览器 A (Vue3)        │     │   浏览器 B (Vue3)        │
│   Tiptap Editor          │     │   Tiptap Editor          │
│   + Yjs + HocuspocusProvider   │   + Yjs + HocuspocusProvider
└───────────┬─────────────┘     └───────────┬─────────────┘
            │ WebSocket (ws://host:443)      │
            └───────────┬───────────────────┘
                        ▼
            ┌───────────────────────┐
            │  Hocuspocus Server    │
            │  (Node.js, port 1234) │
            └───────┬───────┬───────┘
                    │       │
              ┌─────▼──┐ ┌──▼─────┐
              │ Redis   │ │ Postgres│
              │ pub/sub │ │ 持久化  │
              └────────┘ └────────┘
```

**数据流：**
1. 用户在编辑器中输入 → Yjs 生成 CRDT 操作
2. HocuspocusProvider 通过 WebSocket 发送到 Hocuspocus Server
3. Server 通过 Redis pub/sub 广播给所有连接的客户端
4. Server 通过 PostgreSQL 扩展自动持久化 Yjs 快照（内置 2 秒防抖）
5. 新客户端连接时，Server 从 PostgreSQL 加载最新快照恢复文档

---

## 三、服务端实现

### 3.1 项目结构

```
server/
├── package.json
├── tsconfig.json
├── .env.example
├── Dockerfile
├── docker-compose.yml
├── src/
│   ├── index.ts                  # 入口：迁移 + 启动
│   ├── hocuspocus.ts             # Hocuspocus 配置
│   ├── db/
│   │   ├── pool.ts               # PostgreSQL 连接池
│   │   ├── migrate.ts            # SQL 迁移执行器
│   │   └── migrations/
│   │       └── 001_init.sql      # 建表 SQL
│   └── extensions/
│       └── postgres.ts           # 自定义持久化扩展
```

### 3.2 依赖

```json
{
  "dependencies": {
    "@hocuspocus/server": "^2.0.0",
    "@hocuspocus/extension-redis": "^2.0.0",
    "pg": "^8.13.0",
    "yjs": "^13.6.27",
    "dotenv": "^16.4.0"
  },
  "devDependencies": {
    "@types/pg": "^8.11.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0"
  }
}
```

### 3.3 数据库设计

```sql
-- 文档表
CREATE TABLE IF NOT EXISTS document (
  id            VARCHAR(64) PRIMARY KEY,
  title         VARCHAR(255) NOT NULL DEFAULT '未命名文档',
  owner_id      VARCHAR(64),
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

-- 文档版本表（Yjs 二进制快照）
CREATE TABLE IF NOT EXISTS document_version (
  id          SERIAL PRIMARY KEY,
  doc_id      VARCHAR(64) NOT NULL REFERENCES document(id) ON DELETE CASCADE,
  snapshot    BYTEA NOT NULL,
  created_by  VARCHAR(64),
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_version_doc_id ON document_version(doc_id);
CREATE INDEX IF NOT EXISTS idx_version_doc_created ON document_version(doc_id, created_at DESC);

-- 文档权限表（预留，Java 后端接管后使用）
CREATE TABLE IF NOT EXISTS document_permission (
  id         SERIAL PRIMARY KEY,
  doc_id     VARCHAR(64) NOT NULL REFERENCES document(id) ON DELETE CASCADE,
  user_id    VARCHAR(64) NOT NULL,
  role       VARCHAR(16) NOT NULL DEFAULT 'editor',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_permission_doc_user ON document_permission(doc_id, user_id);
```

### 3.4 PostgreSQL 持久化扩展

```typescript
// server/src/extensions/postgres.ts
import type {
  Extension,
  onLoadDocumentPayload,
  onStoreDocumentPayload,
  onConnectPayload,
} from '@hocuspocus/server';
import * as Y from 'yjs';
import { pool } from '../db/pool.js';

function parseDocId(documentName: string): string {
  // 房间名格式：document-{id}，与前端 collaboration.ts 一致
  return documentName.startsWith('document-')
    ? documentName.slice('document-'.length)
    : documentName;
}

export class PostgresExtension implements Extension {
  // 加载文档：从最新快照恢复 Yjs 状态
  async onLoadDocument({ documentName, document }: onLoadDocumentPayload): Promise<void> {
    const docId = parseDocId(documentName);
    const result = await pool.query(
      `SELECT snapshot FROM document_version
       WHERE doc_id = $1 ORDER BY id DESC LIMIT 1`,
      [docId],
    );
    if (result.rows.length > 0) {
      const snapshot = result.rows[0].snapshot as Buffer;
      Y.applyUpdate(document, new Uint8Array(snapshot));
    }
  }

  // 保存文档：将 Yjs 状态编码为二进制快照存入 PostgreSQL
  async onStoreDocument({ documentName, document }: onStoreDocumentPayload): Promise<void> {
    const docId = parseDocId(documentName);
    const update = Y.encodeStateAsUpdate(document);
    const buffer = Buffer.from(update);
    await pool.query(
      `INSERT INTO document_version (doc_id, snapshot, created_at) VALUES ($1, $2, NOW())`,
      [docId, buffer],
    );
    await pool.query(
      `UPDATE document SET updated_at = NOW() WHERE id = $1`,
      [docId],
    );
  }

  // 连接时自动创建文档记录（如不存在）
  async onConnect({ documentName }: onConnectPayload): Promise<void> {
    const docId = parseDocId(documentName);
    await pool.query(
      `INSERT INTO document (id, title, created_at, updated_at)
       VALUES ($1, '未命名文档', NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [docId],
    );
  }
}
```

### 3.5 Hocuspocus 服务配置

```typescript
// server/src/hocuspocus.ts
import { Server } from '@hocuspocus/server';
import { Redis } from '@hocuspocus/extension-redis';
import { PostgresExtension } from './extensions/postgres.js';

const port = Number(process.env.HOCUSPOCUS_PORT) || 1234;

const server = Server.configure({
  port,
  extensions: [
    new Redis({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: Number(process.env.REDIS_PORT) || 6379,
    }),
    new PostgresExtension(),
  ],
  async onConnect({ documentName, requestParameters }) {
    const userId = requestParameters.get('userId') ?? 'anonymous';
    console.log(`[Hocuspocus] User "${userId}" connected to "${documentName}".`);
  },
  async onDisconnect({ documentName }) {
    console.log(`[Hocuspocus] Client disconnected from "${documentName}".`);
  },
});

export { server };
```

### 3.6 入口文件

```typescript
// server/src/index.ts
import 'dotenv/config';
import { runMigrations } from './db/migrate.js';
import { server } from './hocuspocus.js';

async function main(): Promise<void> {
  console.log('[Server] Running database migrations...');
  await runMigrations();
  await server.listen();
  const port = Number(process.env.HOCUSPOCUS_PORT) || 1234;
  console.log(`[Server] Hocuspocus collaboration server running on ws://0.0.0.0:${port}`);
}

main().catch((err) => {
  console.error('[Server] Fatal error during startup:', err);
  process.exit(1);
});
```

---

## 四、Docker Compose 部署

### 4.1 docker-compose.yml

```yaml
services:
  postgres:
    image: postgres:16-alpine
    ports: ["5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]
    environment:
      POSTGRES_DB: tiptap_collab
      POSTGRES_USER: tiptap
      POSTGRES_PASSWORD: tiptap_secret
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U tiptap -d tiptap_collab"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  hocuspocus:
    build: .
    ports: ["443:1234"]
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      DATABASE_URL: postgres://tiptap:tiptap_secret@postgres:5432/tiptap_collab
      REDIS_HOST: redis
      REDIS_PORT: 6379
      HOCUSPOCUS_PORT: 1234

volumes:
  pgdata:
```

### 4.2 Dockerfile

```dockerfile
FROM node:20-alpine
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build && cp -r src/db/migrations dist/db/migrations
EXPOSE 1234
CMD ["node", "dist/index.js"]
```

### 4.3 部署步骤

```bash
# 1. 上传 server/ 到云服务器
rsync -avz --exclude='node_modules' --exclude='dist' \
  server/ ubuntu@your-server:~/tiptap-collab-server/

# 2. SSH 到服务器，启动服务
ssh ubuntu@your-server
cd ~/tiptap-collab-server
docker compose up -d

# 3. 验证
docker compose logs hocuspocus --tail 10
# 应看到：Hocuspocus v2.15.3 running at ws://0.0.0.0:1234, Ready.
```

---

## 五、前端改造

### 5.1 改动文件清单

| 文件 | 改动说明 |
|------|----------|
| `src/tools/collaboration/collaboration.ts` | Provider 从 y-websocket 切换到 HocuspocusProvider |
| `src/tools/collaboration/types.ts` | 添加 `token?: string` 字段 |
| `src/api/websocket.ts` | 移除 URL 路径拼接（Hocuspocus 通过 name 路由） |
| `package.json` | 移除 y-websocket，添加 @hocuspocus/provider |
| `vite.config.ts` | rollup externals 更新 |

### 5.2 不需要改动的文件

- `useCollaboration.ts` — composable API 完全 provider 无关
- `CollaborationToggle.vue` — 纯展示组件
- `utils.ts` — 工具函数与 provider 无关
- `TiptapProEditor.vue` — 通过 composable 间接使用

### 5.3 核心改动：collaboration.ts

**Provider 切换（4 处改动）：**

```typescript
// 1. 动态 import
const [{ getWebSocketUrl }, Y, { HocuspocusProvider }] = await Promise.all([
  import('@/api/websocket'),
  import('yjs'),
  import('@hocuspocus/provider'),  // 原：import('y-websocket')
])

// 2. Provider 构造
const wsProvider = new HocuspocusProvider({
  url: wsUrl,
  name: roomName,
  document: doc,
  token: options.token || 'anonymous',
  connect: true,
})
// 原：new WebsocketProvider(wsUrl, roomName, doc, { connect: true })

// 3. 同步事件
eventManager.on(wsProvider, 'synced', ({ state }: { state: boolean }) => handleSync(state))
// 原：eventManager.on(wsProvider, 'sync', handleSync)

// 4. 同步状态检查
if (wsProvider.isSynced && !contentInitialized) {
// 原：if (wsProvider.synced && !contentInitialized) {
```

**协作扩展创建：**

```typescript
export async function createCollaborationExtensions(
  instance: CollaborationInstance | null,
  getUserInfo?: () => UserInfo
): Promise<AnyExtension[]> {
  if (!instance) return []

  const [Collaboration, CollaborationCursor] = await Promise.all([
    import('@tiptap/extension-collaboration').then(m => m.default),
    import('@tiptap/extension-collaboration-cursor').then(m => m.default),
  ])

  const user = getUserInfo?.() ?? { id: 'anonymous', name: '匿名用户' }

  return [
    Collaboration.configure({ document: instance.doc }),
    CollaborationCursor.configure({
      provider: instance.provider,
      user: { id: user.id, name: user.name, color: getRandomColor() },
    }),
  ]
}
```

### 5.4 WebSocket URL

```typescript
// src/api/websocket.ts
// Hocuspocus 通过 provider 的 name 参数路由文档，不走 URL path
export function getWebSocketUrl(_documentId?: string): string {
  const baseUrl = import.meta.env?.VITE_COLLABORATION_WS_URL
  if (!baseUrl) {
    console.warn('[Tiptap] VITE_COLLABORATION_WS_URL not configured')
    return ''
  }
  return baseUrl
}
```

### 5.5 依赖变更

```diff
# package.json devDependencies
- "y-websocket": "^3.0.0"
+ "@hocuspocus/provider": "^2.0.0"

# 升级 cursor 扩展以兼容 Tiptap 3
- "@tiptap/extension-collaboration-cursor": "^2.26.2"
+ "@tiptap/extension-collaboration-cursor": "^3.0.0"

# cursor v3 的 peer dependency
+ "y-prosemirror": "^1.2.6"
```

### 5.6 环境变量

```bash
# .env
VITE_COLLABORATION_WS_URL=ws://your-server:443
```

### 5.7 使用方式

```vue
<TiptapProEditor
  :document-id="documentId"
  :features="{ collaboration: true, headerNav: true, footerNav: true }"
  :version="'advanced'"
/>
```

三个条件同时满足时协同自动启用：
1. `features.collaboration = true`
2. `documentId` 非空
3. `VITE_COLLABORATION_WS_URL` 已配置

---

## 六、踩坑记录

### 6.1 @tiptap/extension-collaboration-cursor 版本兼容

**问题：** cursor v2.26.2 在编辑器初始化时崩溃：
```
TypeError: Cannot read properties of undefined (reading 'doc')
    at createDecorations
```

**原因：** cursor v2 依赖 `ySyncPluginKey` 从 collaboration 插件获取 Yjs 状态，但 `@tiptap/extension-collaboration` v3 内部结构已变更。

**解决：** 升级到 `@tiptap/extension-collaboration-cursor@3.0.0`，同时安装 peer dependency `y-prosemirror@^1.2.6`。

### 6.2 SQL 迁移文件不在 dist 目录

**问题：** Docker 构建后启动报错 `ENOENT: no such file or directory, scandir '/app/dist/db/migrations'`

**原因：** TypeScript 编译（tsc）不会复制 `.sql` 文件到 `dist/`。

**解决：** Dockerfile 中 build 后手动复制：
```dockerfile
RUN pnpm build && cp -r src/db/migrations dist/db/migrations
```

### 6.3 云服务器安全组端口未放行

**问题：** WebSocket 连接失败 `ws://host:1234/ failed`

**原因：** 云服务商安全组默认只开放 22 端口。

**解决：** Docker Compose 端口映射改为 `443:1234`，利用已开放的 443 端口。

### 6.4 HocuspocusProvider.awareness 可能为 null

**问题：** TypeScript 报错 `'wsProvider.awareness' is possibly 'null'`

**原因：** HocuspocusProvider 的 `awareness` 属性类型为 `Awareness | null`，与 y-websocket 的非空类型不同。

**解决：** 使用可选链和空值检查：
```typescript
wsProvider.awareness?.setLocalStateField('user', { ... })
if (wsProvider.awareness) {
  eventManager.on(wsProvider.awareness, 'change', handler)
}
```

---

## 七、后续扩展

```
已完成：
✅ 实时协同编辑（Yjs + Hocuspocus）
✅ 远程光标显示（CollaborationCursor）
✅ 文档持久化（PostgreSQL Yjs 快照）
✅ 多实例扩展（Redis pub/sub）
✅ Docker Compose 一键部署

待实现（Java Spring Boot 后端接管后）：
- 用户认证（JWT token → Hocuspocus onAuthenticate）
- 文档权限控制（owner/editor/viewer）
- 文档 CRUD API（列表、创建、删除）
- 历史版本管理（版本列表、恢复）
- 评论系统（mark + side panel）
- 离线编辑（IndexedDB）
```
