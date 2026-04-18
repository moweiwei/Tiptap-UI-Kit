# Tiptap UI Kit - Cloud Architecture Document

> Last updated: 2026-04-05

## 1. Project Overview

| Attribute | Value |
|---|---|
| **Name** | `tiptap-ui-kit` |
| **Version** | `0.1.0` |
| **Type** | Distributable npm library (not a standalone app) |
| **License** | MIT |
| **Author** | benngaihk |
| **Repository** | <https://github.com/benngaihk/Tiptap-UI-Kit> |
| **Live Demo** | <https://tiptap-ui-kit.vercel.app> |

### What is it

A production-ready rich text editor UI kit built on **Tiptap 3 + Vue 3 + TypeScript + ProseMirror**. Ships as an npm package that host applications can drop in as a ready-made editor component with themes, AI, collaboration, and i18n — all pre-built.

### Target Use Cases

- CMS / Content Management Systems
- Knowledge Base / Wiki platforms
- Document Editors (A4 pagination mode)
- Blog Platforms
- Note-taking Applications
- SaaS embedded rich text editing
- Educational platforms (math support)

---

## 2. Technology Stack

| Layer | Technology |
|---|---|
| **Framework** | Vue 3.5 (Composition API) + TypeScript 5.7 |
| **Editor Core** | Tiptap 3 (ProseMirror-based, headless) |
| **UI Components** | Ant Design Vue 4 (optional) + Lucide Vue Next |
| **Build** | Vite 6 (library target ES+CJS) |
| **Package Manager** | pnpm >= 8.0.0 |
| **Runtime** | Node.js >= 18.0.0 |
| **Testing** | Vitest + happy-dom (v8 coverage) |
| **Real-time Collaboration** | Yjs + y-websocket |
| **AI Integration** | OpenAI-compatible streaming API |
| **Math Rendering** | KaTeX |
| **Word Import/Export** | mammoth (import) + docx (export) |
| **Syntax Highlighting** | lowlight |

### Dependencies Summary

| Category | Packages |
|---|---|
| **Peer (host provides)** | `vue ^3.4.0`, `@tiptap/core ^3.0.0`, `@tiptap/pm ^3.0.0`, `@tiptap/starter-kit ^3.0.0`, `@tiptap/vue-3 ^3.0.0` |
| **Bundled (runtime)** | `docx ^9.5.1`, `file-saver ^2.0.5`, `katex ^0.16.28`, `mammoth ^1.11.0` |
| **Dev (build/test only)** | 50+ packages including Tiptap extensions, Vite plugins, Vitest, vue-tsc, terser, sass-embedded |

---

## 3. Build & Deployment

### Library Build (`vite.config.ts`)

```
Input:  src/index.ts
Output: dist/index.js       (CJS)
        dist/index.esm.js   (ESM)
        dist/index.d.ts     (TypeScript declarations)
        dist/style.css      (All styles, single file)
Target: ES2022 (Chrome 105+, Safari 16+, Firefox 110+, Edge 105+)
```

- **Externals** (not bundled): `vue`, all `@tiptap/*`, `ant-design-vue`, `yjs`, `y-websocket`, `lowlight`, all `prosemirror-*`
- **Minification**: Terser in production (drops console/debugger)
- **Code protection**: rollup-plugin-obfuscator in production
- **Type generation**: `vite-plugin-dts` — rolls up into single `index.d.ts`

### Demo Build (`vite.config.demo.ts`)

Multi-entry SPA: `index.html` (main demo) + `sponsor.html` (sponsorship page). Deployed to Vercel with SPA rewrites and 1-year static asset caching.

### Key Scripts

| Command | Purpose |
|---|---|
| `pnpm dev` | Start dev server at localhost:5173 |
| `pnpm build` | Build library to `dist/` |
| `pnpm build:demo` | Build demo app for Vercel |
| `pnpm build:types` | Generate TypeScript declarations |
| `pnpm typecheck` | `vue-tsc --noEmit` strict type check |
| `pnpm test` | Run Vitest |
| `pnpm test:coverage` | Run tests with v8 coverage report |
| `pnpm lint` | ESLint check |
| `pnpm prepublishOnly` | Auto-build before npm publish |

### npm Package Exports

```json
{
  ".": {
    "types": "./dist/index.d.ts",
    "import": "./dist/index.esm.js",
    "require": "./dist/index.js"
  },
  "./style.css": "./dist/style.css"
}
```

Consumption:

```vue
import { TiptapProEditor } from 'tiptap-ui-kit'
import 'tiptap-ui-kit/style.css'
```

---

## 4. Architecture

### 4.1 High-Level Component Architecture

```
TiptapProEditor.vue (composition root, v-model binding)
├── EditorToolbar.vue / ToolbarNav.vue          # Top toolbar
│   ├── Basic features group (text-format, list, heading, color, align, image)
│   ├── Advanced features group (font, code, link, table, math, word, template, gallery)
│   ├── AI menu button
│   └── Undo/redo, format clear, zoom
│
├── Editor Content Area (A4-page container with zoom scaling)
│   ├── Tiptap Editor Instance
│   ├── LinkBubbleMenu.vue                       # Bubble menu on link selection
│   ├── TableToolbar.vue                         # Contextual toolbar inside tables
│   ├── ImageToolbar.vue                         # Contextual toolbar on image selection
│   ├── FloatingMenu.vue                         # Block picker on empty lines
│   ├── SlashCommandMenu.vue                     # "/" command block picker
│   ├── DragHandleMenu.vue                       # Per-block six-dot handle menu
│   └── DeviceFrame / DeviceSwitcher             # PC/Pad/Mobile preview frames
│
├── FooterNav.vue                                 # Bottom bar: zoom, character count, pages
├── CollaborationToggle.vue                       # Real-time collaboration UI
├── VersionHistoryPanel.vue                       # Version management panel
└── PreviewMode.vue                               # Read-only preview
```

### 4.2 Directory Architecture

```
src/
├── index.ts                 # Library public entry (all exports)
│
├── core/                    # Core editor components
│   ├── TiptapProEditor.vue  # Main editor (composition root)
│   ├── TiptapEditor.vue     # Alternative editor variant
│   ├── editorConfig.ts      # Preset configs: minimal/basic/advanced/full/notion
│   ├── editorTypes.ts        # FeatureConfig, VersionConfig, Props definitions
│   ├── types.ts              # Core TypeScript types
│   └── toolbarConfig.ts      # Toolbar feature keys (ToolbarFeature union type)
│
├── extensions/              # Custom Tiptap extensions
│   ├── coreExtensions.ts    # Dynamic extension registration by version tier
│   ├── fontSize.ts          # Font size mark extension
│   ├── lineHeight.ts        # Line height attribute extension
│   ├── listShortcuts.ts     # List keyboard shortcuts
│   ├── pasteImage.ts        # Clipboard image paste
│   ├── pasteTable.ts        # Clipboard table paste
│   ├── pasteWord.ts         # Microsoft Word paste cleanup
│   ├── video.ts             # Video node extension
│   ├── formatPainter.ts     # Format painter extension
│   ├── pageConstants.ts     # A4 page constants (794x1123px)
│   └── math/                # KaTeX math formula extension
│       ├── MathExtension.ts
│       ├── MathNodeView.vue
│       └── types.ts
│
├── features/                # Toolbar feature modules
│   ├── basic/               # Basic tier: text-format, list, color, heading, align, image
│   └── advanced/            # Advanced tier: undo-redo, font, code-block, link, sub-superscript,
│                            #                format-clear, format-painter, table, zoom, math,
│                            #                word, template, gallery
│
├── ai/                      # AI writing assistance
│   ├── types.ts             # Adapter interface, message types, callbacks
│   ├── factory.ts           # Provider adapter factory
│   ├── prompts.ts           # System prompts (i18n: CN/EN)
│   ├── useAi.ts             # Vue composable for AI features
│   ├── AiMenuButton.vue     # Toolbar AI entry button
│   ├── adapters/            # Provider-specific API adapters
│   │   ├── openai.ts        # OpenAI-compatible SSE streaming
│   │   ├── aliyun.ts        # Aliyun DashScope (HMAC-SHA256 signing)
│   │   └── ollama.ts        # Ollama local API
│   ├── config/              # User AI configuration (localStorage)
│   │   ├── types.ts         # AiProvider, AiUserConfig, AI_PROVIDERS
│   │   ├── store.ts         # localStorage persistence (base64 key obfuscation)
│   │   └── useAiConfig.ts   # Vue composable + connection testing
│   ├── components/          # AI UI components
│   │   ├── AiToolbarMenu.vue
│   │   └── AiSettingsModal.vue
│   ├── custom-ai/           # User-defined AI commands
│   ├── continue-writing/    # AI continue from cursor
│   ├── polish/              # Text polish selected text
│   ├── summarize/           # Content summarization
│   ├── translation/         # 15-language translation
│   │   └── languageCodes.ts # ISO language code definitions
│   └── shared/              # Shared utilities
│       ├── AiHighlightMark.ts  # Tiptap mark for AI suggestions
│       ├── aiSuggestionManager.ts # Singleton: suggestion lifecycle
│       ├── ai-highlight.css     # Pulse animation for AI highlights
│       ├── CustomAiPopover.vue  # Custom prompt input popover
│       └── AiSuggestionPopover.vue # Accept/Reject UI
│
├── locales/                 # i18n system (zero external dependencies)
│   ├── types.ts             # TiptapLocale interface (~435 keys, 11 sections)
│   ├── manager.ts           # createI18n(), useI18n(), t(key) with {param} interpolation
│   ├── en-US.ts             # English
│   ├── zh-CN.ts             # Simplified Chinese
│   └── zh-TW.ts             # Traditional Chinese
│
├── themes/                  # Theme presets
│   ├── index.ts             # setTheme(), toggleThemeMode(), watchSystemTheme(), setDeviceView()
│   ├── variables.css        # 20+ --tiptap-* CSS variables + dark mode overrides
│   └── presets/
│       ├── word.css         # Microsoft Word: Calibri, 11pt, A4 paper, sticky toolbar
│       ├── notion.css       # Notion: full-width, minimal, 28px padding, no shadow
│       ├── github.css       # GitHub: 980px, bordered paper, MD headings, code blocks
│       └── typora.css       # Typora: transparent toolbar (fade), PT Serif serif, centered H1
│
├── tools/                   # Overlay/menus/bars (augmenting core editor)
│   ├── header-nav/          # ToolbarNav + BASIC/ADVANCED_toolbar configs
│   ├── footer-nav/          # Bottom bar + footer-nav.css
│   ├── link-bubble/         # Link bubble on selection
│   ├── table-toolbar/       # Contextual table toolbar
│   ├── image-toolbar/       # Contextual image toolbar
│   ├── floating-menu/       # Block picker on empty lines
│   ├── drag-handle-menu/    # Six-dot block handle + delete/duplicate/copy menu
│   ├── slash-command/       # "/" command picker extension
│   ├── collaboration/       # Real-time collab: useCollaboration, types, util, css
│   ├── device-switcher/     # PC/Pad/Mobile frame previews
│   ├── version-history/     # Save/restore/compare document versions + diff view
│   └── preview-mode/        # Read-only preview mode
│
├── styles/                  # Global CSS stylesheet
│   ├── index.css            # Master stylesheet import
│   ├── variables.css        # Global CSS variables
│   ├── base.css             # Base reset
│   ├── word-mode.css        # Word mode specific styles
│   ├── toolbar.css          # Toolbar styles
│   ├── zoom-toolbar.css     # Zoom bar styles
│   ├── device-responsive.css # Device switcher responsive
│   ├── floating-menu.css / floating-menu-toolbar.css
│   ├── slash-command.css
│   ├── drag-handle.css / drag-handle-with-menu.css
│   ├── image-toolbar.css / image-resize.css
│   ├── bubble-menu.css
│   ├── table.css / table-bubble-menu.css / table-insert-plus.css
│   └── collaboration.css
│
├── ui/                      # Reusable primitive components
│   ├── ToolbarButton.vue    # Standard toolbar button
│   ├── ToolbarDivider.vue   # Toolbar divider
│   ├── ToolbarDropdownButton.vue # Dropdown-based toolbar button
│   ├── ToolbarGroup.vue     # Toolbar grouping container
│   ├── ColorPicker.vue      # Color selection component
│   └── BaseTooltip.vue      # Tooltip wrapper
│
├── configs/                 # Shared configuration objects
│   ├── editorConstants.ts   # Global editor constants
│   ├── toolbar.ts           # Toolbar defaults
│   └── toolbar-configs.ts    # Named toolbar configurations
│
├── adapters/                # Compatibility layer (external dependency abstraction)
│   ├── user.ts              # useUserStore(), setUserInfo()
│   ├── notification.ts      # notify.info/success/error/warning() + ant-design-vue adapter
│   ├── preferences.ts       # usePreferences(), initTheme()
│   └── icons.ts             # Icon abstraction layer
│
├── api/                     # API client layer
│   ├── ai.ts               # AI streaming service (OpenAI SSE, demo fallback)
│   └── websocket.ts        # Collaboration WebSocket URL provider
│
└── utils/                   # Shared utilities
    ├── index.ts             # Re-exports all util
    ├── prosemirrorUtils.ts  # ProseMirror node/content helper
    ├── editorState.ts       # Editor state inspection helper
    ├── editorCommands.ts    # Editor command helper
    └── clipboard.ts         # Clipboard operations helper
```

---

## 5. Core Architecture Details

### 5.1 Version Tier System

The editor supports **version tiers** that gate features by complexity:

```typescript
type Version = 'basic' | 'advanced' | 'premium'
```

Each tier controls:
- Which toolbar features are shown
- Which Tiptap extensions are registered
- Overall editor complexity

`getExtensionsByVersion(version, options)` in `coreExtensions.ts` returns the appropriate extension set. Currently all versions share the same extension set, but the architecture allows differentiation.

### 5.2 Editor Lifecycle

1. `TiptapProEditor` mounts → `initEditor()` creates Tiptap Editor instance
2. Extensions assembled via `getExtensionsByVersion()` (includes AI, math, tables, etc.)
3. Toolbar config computed from `toolbarConfig.ts` based on version
4. i18n initialized via `createI18n()` with host locale mapped to en-US/zh-CN/zh-TW
5. Collaboration checked if enabled → y-doc sync via WebSocket
6. On destroy → editor destroyed, collaboration cleaned up

### 5.3 Collaboration Mode

When collaboration is active:
- `History` extension (undo/redo) is disabled to avoid conflicts
- y-websocket connects to configured WebSocket server
- Collaboration cursors rendered via `@tiptap/extension-collaboration-cursor`
- Undo/redo and format painter buttons are disabled when 2+ collaborators are connected

### 5.4 Page Layout System

Word mode renders content inside **A4 page simulation**:
- Page: **794 x 1123px** (96 DPI equivalents)
- Padding: 96px on content area
- Calculated via `calculatePages()` in response to content changes
- Zoom scaling: 50% - 200%
- Portrait/Landscape orientation support

### 5.5 AI Architecture

```
User Action → Extension/Component → useAi() composable
                                          ↓
                                    AiAdapterFactory (openai | aliyun | ollama)
                                          ↓
                                    Provider Adapter (chat() | chatStream())
                                          ↓
                                    aiApiService (src/api/ai.ts)
                                    fetch SSE streaming → callbacks
                                          ↓
                                    AiSuggestionManager
                                    (create → show Accept/Reject → accept or reject)
```

**Config priority**: User localStorage config > Environment variables > Default demo responses

**Supported AI Providers**: OpenAI, DeepSeek, Anthropic, Aliyun DashScope, Ollama, Any OpenAI-compatible API

### 5.6 AI Feature Matrix

| Feature | Input | Output | Sync | Streaming |
|---|---|---|---|---|
| Continue Writing | Cursor context | Full paragraph | Yes | Yes |
| Polish | Selected text | Improved version | Yes | Yes |
| Summarize | Selected text | Summary with replace | Yes | Yes |
| Translate | Selected text + target lang | Translated text | Yes | Yes |
| Custom AI | User prompt | Custom result | Yes | Yes |

**Supported AI Adapters**:
- **OpenAI** — Standard `POST /v1/chat/completions`, SSE streaming, `Authorization: Bearer`
- **Aliyun DashScope** — HMAC-SHA256 request signing, required `apiSecret`, model mapping (`qwen-turbo`, `qwen-plus`, `qwen-max`)
- **Ollama** — Local API, no key needed, `POST /v1/chat/completions`

---

## 6. Feature Inventory

### 6.1 Theme Presets (5 total)

| Theme | Font | Layout | Key Characteristics |
|---|---|---|---|
| **Default** | System sans-serif, 16px | Full-width | Clean, blue accent (#3b82f6) |
| **Word** | Calibri, 11pt | A4 pages with shadow | Sticky gradient toolbar, blue section headings |
| **Notion** | System sans-serif | Full-width, 28px padding | No paper shadow, minimal toolbar, blue links |
| **GitHub** | System mono for code | 980px container | MD headings with underlines, bordered code blocks |
| **Typora** | PT Serif headings | Transparent | Fade toolbar on hover, centered H1, 1.8 line-height |

All themes support both **light** and **dark** modes with system preference detection.

### 6.2 i18n System

Zero external dependencies. Custom `t()` function with dot-key resolution and `{param}` interpolation.

- **en-US** — English (~435 keys)
- **zh-CN** — Simplified Chinese (~435 keys)
- **zh-TW** — Traditional Chinese (~435 keys)
- **11 translation sections**: toolbar, table, bubbleMenu, dragMenu, codeBlock, stats, placeholder, messages, editor, versionHistory, slashCommand, aiSettings

### 6.3 Text Formatting Features

| Feature | Description |
|---|---|
| Bold / Italic / Underline / Strikethrough / Code | Rich text formatting |
| Headings H1-H6 | With theme-specific styles |
| Lists | Bullet, ordered, task lists with nested support |
| Text Alignment | Left, center, right, justify |
| Text Color / Background Color | Color picker with preset palette |
| Font Family | Configurable font families (FONT_FAMILIES) |
| Font Size | Configurable sizes (FONT_SIZES) |
| Line Height | Configurable line heights (LINE_HEIGHTS) |
| Subscript / Superscript | Character positioning |
| Highlight | Multi-color highlight marks |

### 6.4 Advanced Features

| Feature | Description |
|---|---|
| Undo / Redo | History extension (disabled in collab mode) |
| Link | Smart link editing with preview bubble |
| Image | Upload, resize, drag-to-adjust |
| Video | Video node support |
| Tables | Merge, split, header toggle, contextual toolbar |
| Code Block | Syntax highlighting via lowlight, language dropdown |
| Math (KaTeX) | Inline and block LaTeX formulas |
| Format Painter | Copy formatting across content |
| Word Import | mammoth-based DOCX to HTML conversion |
| Word Export | docx library-based HTML to DOCX generation |
| Templates | Built-in: Meeting Minutes, Weekly Report, Daily Report, Project Plan, Product Requirements |
| Gallery | Image gallery from document content |
| Zoom | 50% - 200% zoom control |
| Clear Format | Remove all formatting from selection |

### 6.5 UI/UX Features

| Feature | Description |
|---|---|
| Floating Menu | Block-type picker appears on empty lines |
| Slash Command | Type `/` to insert blocks |
| Drag Handle Menu | Six-dot handle per block with delete/duplicate/copy |
| Link Bubble Menu | Inline editing on link selection |
| Table Contextual Toolbar | Table manipulation toolbar |
| Image Contextual Toolbar | Image manipulation toolbar |
| Device Switcher | PC/Pad/Mobile preview frames |
| Preview Mode | Read-only document preview |
| Version History | Save/restore/compare document versions with diff view |

### 6.6 Smart Paste

| Source | Handler |
|---|---|
| Images from clipboard | `pasteImage.ts` |
| Tables from clipboard | `pasteTable.ts` |
| Microsoft Word | `pasteWord.ts` (HTML cleanup) |

### 6.7 Real-time Collaboration

- **Transport**: y-websocket via configurable WebSocket endpoint
- **Sync**: Document state via Yjs CRDT
- **Cursors**: Remote cursors with user colors
- **Presence**: Online user counting
- **Safety**: History extension disabled; undo/redo via server-side state

---

## 7. Configuration System

### 7.1 Environment Variables

| Variable | Purpose |
|---|---|
| `VITE_AI_PROVIDER` | AI provider: openai/aliyun/ollama/deepseek/anthropic/custom |
| `VITE_AI_API_KEY` | Default AI API key |
| `VITE_AI_BASE_URL` | Custom API endpoint |
| `VITE_AI_MODEL` | Default model name |
| `VITE_COLLABORATION_WS_URL` | WebSocket endpoint for collaboration |

### 7.2 Runtime Configuration

Users can configure AI via the **AI Settings modal** in the toolbar:
- Provider selection (6 options)
- API key input (base64 obfuscated in localStorage)
- Custom endpoint URL
- Model selection per provider

### 7.3 AI Provider Metadata

The `AI_PROVIDERS` array defines 6 providers with display names, icons, default models, and endpoint URLs. Connection testing is built-in for all providers.

---

## 8. Testing Strategy

- **Framework**: Vitest with happy-dom environment
- **Coverage Reporter**: v8
- **Scope**: `src/**/*.{test,spec}.{ts,tsx}` (excludes node_modules, dist, demo, configs, index files)
- **UI Mode**: `pnpm test:ui` for interactive test explorer
- **Current State**: Minimal test coverage (example.spec.ts in `src/__tests__/`)

---

## 9. CI/CD Pipeline

### GitHub Workflow (`ci.yml`)
- Runs on pushes and PRs
- Install → typecheck → lint → build → test
- Node.js 18+

### Release Process (`release.yml`)
- Triggered on version tag
- Builds library + types
- Publishes to npm registry

### Vercel Deployment
- SPA rewrites for demo routing
- Multi-entry: index.html + sponsor.html
- 1-year immutable cache for static assets

---

## 10. Public API

### Main Exports (from `src/index.ts`)

| Category | Exports |
|---|---|
| **Editor** | `TiptapProEditor`, `TiptapEditor`, `TiptapProEditorStyle` |
| **Extensions** | All custom Tiptap extensions |
| **AI** | `useAi`, `AiAdapterFactory`, adapter implementations, AI config composables |
| **Features** | All toolbar feature components (basic + advanced) |
| **Themes** | `setTheme`, `getTheme`, `toggleThemeMode`, `registerTheme`, `watchSystemTheme`, `setDeviceView`, `getDeviceView`, `setOrientation`, `getOrientation` |
| **i18n** | `createI18n`, `useI18n`, locale types |
| **Tools** | Collaboration, devices, version history, preview mode |
| **Config** | Toolbar configs, editor constants |
| **Types** | All TypeScript interfaces |

### Component Props (TiptapProEditor)

| Prop | Type | Default | Description |
|---|---|---|---|
| `modelValue` | string | `''` | Editor content (v-model) |
| `version` | `'basic' \| 'advanced' \| 'premium'` | `'advanced'` | Feature tier |
| `versionConfig` | `VersionConfig` | — | Custom tier configuration |
| `theme` | string | `'default'` | Theme preset name |
| `locale` | string | `'en-US'` | Language code |
| `placeholder` | string | — | Editor placeholder text |
| `showToolbar` | boolean | `true` | Show/hide toolbar |
| `showFooter` | boolean | `true` | Show/hide footer |
| `readonly` | boolean | `false` | Read-only mode |
| `wordMode` | boolean | `false` | A4 page layout |
| `darkMode` | boolean | `false` | Dark theme |
| `aiConfig` | `AiUserConfig` | — | Pre-configured AI settings |
| `collaborationEnabled` | boolean | `false` | Toggle collaboration |

---

## 11. Key Architectural Patterns

### Extension Factory Pattern

Custom Tiptap extensions follow:
```typescript
import { Extension } from '@tiptap/core'

export const MyExtension = Extension.create({
  name: 'myExtension',
  addCommands() { ... },
  addKeyboardShortcuts() { ... },
})
```

### AI Adapter Pattern

Provider adapters implement:
```typescript
interface AiAdapter {
  chat(request: AiRequest): Promise<AiResponse>
  chatStream(request: AiRequest, callbacks: AiStreamCallbacks): AbortController
}
```

### Vue Composable Pattern

Stateful logic extracted:
```typescript
export function useMyFeature(editor: Ref<Editor | null>) {
  const state = ref(...)
  return { state, ...methods }
}
```

### AI Streaming Pattern

Consumers use streaming with callbacks:
```typescript
aiApiService.continueWriting(content, prompt, {
  onStart: () => { ... },
  onMessage: ({ content }) => { ... },
  onStop: () => { ... },
  onError: (error) => { ... },
})
```

---

## 12. Deployment Considerations

### For Host Applications

1. Install: `pnpm add tiptap-ui-kit` (peer deps: Tiptap + Vue 3)
2. Import component and CSS
3. Configure theme/locale/version via props
4. Optional: Configure AI via props or let users set via settings modal
5. Optional: Configure WebSocket URL for collaboration

### Performance

- Tree-shakeable exports
- External Tiptap/ProseMirror (host can share versions)
- Optional Ant Design Vue (not bundled)
- Production minification + code obfuscation
- CSS: Single file (no code splitting to avoid FOUC)

### Security

- API keys stored base64-obfuscated in localStorage
- Never hardcoded in production builds
- AbortController for API request timeout control
- Input validation on AI prompts
- Demo fallback responses when no API key configured
