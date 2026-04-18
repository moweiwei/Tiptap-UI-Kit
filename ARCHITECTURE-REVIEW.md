# Tiptap UI Kit - 架构分析与优化待办

## 一、架构优势（做得好的地方）

1. **双编辑器策略**：轻量版 `TiptapEditor.vue` + 全功能版 `TiptapProEditor.vue`，满足不同集成场景
2. **插件化Toolbar架构**：Toolbar 由 `ToolbarFeature` 字符串驱动，支持动态组合和预设（minimal/basic/advanced/full/notion）
3. **AI 模块设计出色**：
   - Provider 抽象（OpenAI/Aliyun/Ollama）+ 统一的 `AiAdapter` 接口
   - 5 个 AI 功能作为 Tiptap Extension 实现（continue-writing/polish/summarize/translation/custom-ai）
   - `aiSuggestionManager` 状态机管理 AI 生命周期
   - 用户配置可持久化到 localStorage
4. **版本化功能控制**：`EditorVersion` + `FeatureFlags` + `PRESET_CONFIGS` 提供灵活的 feature toggle
5. **主题系统可扩展**：CSS 变量驱动 + 支持自定义主题注册
6. **国际化内置**：zh-CN/zh-TW/en-US，支持自定义消息和参数插值
7. **构建配置完善**：ESM/CJS 双输出、类型声明合并、tree-shaking 友好、__BUILD_TIME__/__VERSION__ 全局常量

---

## 二、核心问题与优化待办

### P0 - 严重问题

#### 1. 测试覆盖率几乎为零
- **现状**：仅 `src/__tests__/example.spec.ts` 中有 2 个 trivial 测试（`expect(true).toBe(true)`）
- **风险**：作为一个付费商业项目，无法向客户承诺质量稳定性；重构时无安全网
- **待办**：
  - [ ] 编写核心组件单元测试（TiptapProEditor、EditorToolbar、AiToolbarMenu）
  - [ ] 编写扩展单元测试（coreExtensions、formatPainter、math、video）
  - [ ] 编写配置系统测试（mergeConfig、PRESET_CONFIGS、toolbarConfig）
  - [ ] 编写 AI 模块测试（aiApiService、adapters、aiSuggestionManager）
  - [ ] 编写工具函数测试（prosemirrorUtils、editorState、clipboard）
  - [ ] 编写 E2E 测试覆盖关键用户流（编辑、AI 续写、表格操作、图片插入）
  - [ ] 配置覆盖率阈值门禁（>=80%）

#### 2. `coreExtensions.ts` 单体大文件 & 版本区分未实现
- **现状**：`getExtensionsByVersion()` 函数 200+ 行，硬编码了所有扩展。`_version` 参数被接收但完全忽略（第 76 行明确标注 TODO），所有版本使用完全相同的扩展列表
- **风险**：`basic`/`advanced`/`premium` 版本声称有不同功能，但底层扩展完全一样，造成 API 误导；后续加版本区分时改动会很大
- **待办**：
  - [ ] 将扩展按功能域拆分到独立配置文件（`extensions/basicExtensions.ts`、`extensions/advancedExtensions.ts`、`extensions/premiumExtensions.ts`）
  - [ ] 实现 `getExtensionsByVersion()` 的版本区分逻辑
  - [ ] 扩展配置改为声明式而非顺序 push（便于 diff、测试和文档化）

#### 3. TiptapProEditor.vue 职责过重（God Component）
- **现状**：主组件 570 行，承担了编辑器初始化、协作管理、分页计算、工具栏配置、国际化初始化、页面响应、事件管理等全部职责
- **风险**：难以测试、难以维护、难以独立扩展某个子模块
- **待办**：
  - [ ] 抽取 `useEditorInit()` composable 处理编辑器初始化逻辑
  - [ ] 抽取 `usePageCalculation()` composable 处理分页逻辑
  - [ ] 抽取 `useToolbarConfig()` composable 处理工具栏配置映射
  - [ ] 抽取 `usePreviewMode()` composable 处理预览模式逻辑
  - [ ] 目标：主组件 < 200 行，仅保留模板和生命周期

#### 4. `console.*` 泛滥（97 处）
- **现状**：24 个文件中有 97 处 `console.log/warn/error/debug`，其中大量在生产代码中（非测试/README）
- **风险**：泄露内部实现细节；性能损耗；打包后仍可见（尽管 vite.config.ts 配置了 terser drop console，但不包括 console.warn/error）
- **待办**：
  - [ ] 建立统一的 logger 工具（`src/utils/logger.ts`），支持级别控制和 tree-shaking
  - [ ] 将生产代码中的 `console.log` 替换为结构化日志或直接移除
  - [ ] 保留 `console.warn/error` 仅在关键错误边界处
  - [ ] CI 增加 eslint `no-console` 规则拦截（允许 warn/error 白名单）

### P1 - 重要改进

#### 5. `any` 类型滥用（~40 处 `as any`）
- **现状**：特别是 `coreExtensions.ts`（Tiptap 的 AnyExtension 设计合理）、但 `TiptapProEditor.vue`、`ai/` 模块、`configs/toolbarConfigs.ts` 中大量 `as any`
- **关键 unsafe 区域**：
  - `TiptapProEditor.vue:155` emit 类型 `update: [content: any]`
  - `TiptapProEditor.vue:183-184` 用户信息 fallback 使用 `(userInfo as any)`
  - `TiptapProEditor.vue:377` `getInitialContent(): any`
  - `ai/AiMenuButton.vue` 27 处 console.log
  - `configs/toolbarConfigs.ts` 大量 `(editor.commands as any).xxx`
- **待办**：
  - [ ] 为 AI editor commands 声明类型扩展（`declare module '@tiptap/core' { interface Commands { ... } }`）
  - [ ] 定义 `EditorContent` 类型（`string | JSONContent | null`）替代 `any`
  - [ ] 为 userInfo 定义接口，移除 `(userInfo as any)`
  - [ ] 逐步消除剩余的 `as any` casting

#### 6. 缺少 CHANGELOG 和版本管理
- **现状**：无 CHANGELOG.md，无 semver 发布流程
- **待办**：
  - [ ] 添加 CHANGELOG.md（可引入 `standard-version` 或 `changesets`）
  - [ ] 统一版本号（当前 `package.json` 为 `0.1.0`）
  - [ ] `__VERSION__` 已构建注入但尚未更新

#### 7. CI/CD 不完善
- **现状**：
  - `.github/workflows/ci.yml` - 存在但未覆盖类型检查
  - `.github/workflows/release.yml` - 存在但无 CHANGELOG 生成
- **待办**：
  - [ ] CI 增加 `pnpm typecheck` 步骤
  - [ ] CI 增加 `eslint` 检查步骤
  - [ ] CI 增加构建产物验证（确认 dist/ 产出完整）
  - [ ] Release workflow 自动生成 CHANGELOG 和 GitHub Release
  - [ ] PR 规则保护 main 分支（require review、require CI）

#### 8. 错误处理不统一
- **现状**：
  - 多数 catch 块为空（`catch {}`），静默吞掉错误
  - `TiptapProEditor.vue:416` `catch {}`
  - `TiptapProEditor.vue:211` `catch {}`
  - `src/core/TiptapProEditor.vue:372` `catch { return null }`
  - AI 扩展中部分错误有处理，部分没有
- **待办**：
  - [ ] 统一错误处理策略：所有 catch 必须记录或转发
  - [ ] 定义自定义错误类（`EditorError`、`AiError`、`CollaborationError`）
  - [ ] 提供 `onError` 回调让消费者可选择处理错误

#### 9. AI 模块过度耦合到 localStorage
- **现状**：`src/ai/config/store.ts` 使用 localStorage 存储 AI 配置
- **风险**：SSR 环境下会崩溃；企业客户可能希望用其他存储方式
- **待办**：
  - [ ] 抽象 `StorageAdapter` 接口（default: localStorageImpl）
  - [ ] 提供 SSR 安全检测（`typeof window !== 'undefined'`）
  - [ ] 允许消费者注入自定义 storage

#### 10. 样式交付方式不合理
- **现状**：所有 CSS 通过 `import 'tiptap-ui-kit/style.css'` 交付单个文件，无法按需加载
- **风险**：客户即使只用了部分功能也会加载全部样式
- **待办**：
  - [ ] 研究 CSS chunks 按功能域拆分（如 `style/basic.css`、`style/advanced.css`、`style/ai.css`）
  - [ ] 或在文档中明确说明需要全局引入

### P2 - 体验改进

#### 11. 缺少 Storybook 或可视化的组件文档
- **现状**：只有 Vite Demo 站，无独立组件浏览
- **待办**：
  - [ ] 引入 Storybook 或构建独立组件展示
  - [ ] 每个组件至少有一个 demo 示例

#### 12. `src/tools/collaboration` 被 tsconfig 排除
- **现状**：`tsconfig.json` 中 `src/tools/collaboration` 在 `exclude` 列表中
- **风险**：该目录下的代码没有类型检查，容易引入类型错误
- **待办**：
  - [ ] 将 collaboration 模块纳入 tsconfig
  - [ ] 修复任何现存的类型错误

#### 13. 事件定义不严格
- **现状**：`update: [content: any]`、`collaboratorsChange: [count: number]` 等事件使用了 `any` 类型
- **待办**：
  - [ ] 使用 `JSONContent` 类型替代 `any`
  - [ ] 在 `editorTypes.ts` 中集中定义所有事件类型

#### 14. 缺少性能监控
- **现状**：无性能指标收集
- **待办**：
  - [ ] 添加编辑器初始化时间指标
  - [ ] 添加 AI 请求耗时指标
  - [ ] 大文档滚动性能监控
  - [ ] 提供 `performance` prop 关闭非必要动画

#### 15. 无障碍性（a11y）缺失
- **现状**：未见 ARIA 属性、键盘导航、屏幕阅读器支持
- **待办**：
  - [ ] 为 Toolbar 按钮添加 `aria-label`
  - [ ] 为 Dropdown 添加角色和键盘导航
  - [ ] 确保颜色对比度符合 WCAG AA
  - [ ] 为 AI 输出添加 `aria-live` 区域

#### 16. 依赖管理优化
- **现状**：
  - `ant-design-vue` 是 optional peer dependency，但大量组件直接使用 `<a-menu>`、`<a-button>` 等
  - `docx`、`mammoth` 是 runtime dependency 但只有 Word 功能用到
- **待办**：
  - [ ] 将 `docx`、`mammoth` 改为 optional peer dependency（Word 功能按需加载）
  - [ ] 动态 import 大型依赖（`docx`、`mammoth`、`katex`）
  - [ ] 文档中明确说明 optional peer dependencies

---

## 三、架构风险总结

| 风险 | 影响 | 优先级 |
|------|------|--------|
| 测试覆盖率 ~0% | 重构安全、客户信任 | P0 |
| 版本区分未实现 | API 误导、后续扩展困难 | P0 |
| God Component (570行) | 维护成本指数增长 | P0 |
| console.* 泛滥 | 信息泄露、性能损耗 | P0 |
| `as any` 滥用 | TypeScript 类型安全名存实亡 | P1 |
| 无 CHANGELOG | 客户无法跟踪变更 | P1 |
| CI 不完整 | 类型错误可能发布 | P1 |
| 空 catch 块 | 错误被静默吞掉 | P1 |
| collaboration 被排除 tsconfig | 类型错误风险 | P2 |
| 无障碍性缺失 | 企业客户合规问题 | P2 |
