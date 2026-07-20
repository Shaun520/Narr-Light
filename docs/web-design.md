<!--
  文档: 叙光 Web 端设计
  作用: 阐明 apps/web 子工程的定位、技术栈、路由结构、模块功能、数据流、状态管理与关键约定
  受众: 项目开发与产品人员
  约束: 本文档面向创作者/玩家使用的 Web 端，不涉及 admin 后台与 mini/mobile 子工程
  更新: 2026-07-20
-->

# 叙光 Web 端设计

## 一、系统定位

`apps/web` 是叙光平台面向**创作者与玩家**的主入口 Web 应用，承载 AI 剧本生成、剧本编辑、逻辑校验、线索卡管理、人物关系可视化、插画生成、社区互动与设置等全部 C 端能力。

部署域名：`narrlight.app`（默认）。

### 1.1 用户角色

| 角色 | 使用场景 |
|---|---|
| 创作者 | AI 生成剧本、编辑打磨、逻辑校验、插画生成、社区发布 |
| 玩家 | 浏览社区、拼车、查看测评、关注作者 |

### 1.2 与其他子工程边界

| 子工程 | 职责 | 部署 |
|---|---|---|
| `apps/web` | 创作者/玩家 Web 端 | `narrlight.app` |
| `apps/admin` | 内部运营后台 | `admin.narrlight.app` |
| `apps/mini` | 店家/DM 小程序 | 微信小程序 |
| `apps/mobile` | 玩家 App | iOS / Android |

---

## 二、技术栈

```jsonc
// apps/web/package.json 关键依赖
{
  "next": "latest",                 // Next.js 16+ App Router
  "react": "^19.0.0",
  "react-dom": "^19.0.0",
  "antd": "^6.4.5",                 // Ant Design 6 作为主 UI 库
  "@ant-design/icons": "^6.2.5",
  "@supabase/ssr": "latest",        // Supabase SSR 客户端
  "@supabase/supabase-js": "latest",
  "zustand": "^5.0.14",             // 客户端状态管理
  "next-themes": "^0.4.6",          // 暗色模式
  "lucide-react": "^0.511.0",       // 侧边栏图标
  "@antv/g6": "^5.1.1",             // 关系图谱可视化
  "d3": "^7.9.0",                   // 时间线轴
  "@react-pdf/renderer": "^4.5.1",  // PDF 导出
  "html-to-image": "^1.11.13",      // 图片导出
  "jszip": "^3.10.1",               // 批量打包下载
  "tailwindcss": "^3.4.1",
  "tailwindcss-animate": "^1.0.7",
  "typescript": "^5",
  "vitest": "^4.1.9",               // 单元测试
  "@playwright/test": "^1.61.0",    // E2E 测试
  "eslint": "^9",
  "eslint-config-next": "15.3.1"
}
```

关键决策：

- **Next.js App Router**：全栈一体，Server Components 优先，Route Handlers 承接 API。
- **Ant Design 6**：主 UI 库，主题色对齐原型朱砂红 `#8a1c1c`。
- **Tailwind + 自定义 CSS**：Tailwind 处理原子类，复杂场景（卷轴、3D 翻页、关系图）用 CSS 文件。
- **Supabase SSR**：服务端通过 `cookies()` 拿会话，不持久化全局 client（Fluid compute 兼容）。
- **Zustand**：客户端状态（编辑器节点、生成进度、UI 抽屉），避免 Context 嵌套。

---

## 三、应用骨架与路由结构

### 3.1 路由组

```
apps/web/app/
├── (marketing)/               # 营销落地页（路由组，不进入 URL）
│   ├── layout.tsx
│   └── page.tsx               # URL: /
├── (dashboard)/               # 主工作区（路由组，需登录）
│   ├── layout.tsx             # 三宫格布局：sidebar + topbar + main
│   ├── dashboard/page.tsx     # URL: /dashboard  概览
│   ├── generate/page.tsx      # URL: /generate   剧本生成
│   ├── editor/
│   │   ├── page.tsx           # URL: /editor     重定向到最近剧本或 /generate
│   │   └── [scriptId]/
│   │       ├── page.tsx       # URL: /editor/[id]         剧本编辑
│   │       ├── clues/         # URL: /editor/[id]/clues   线索卡管理
│   │       ├── relations/     # URL: /editor/[id]/relations 人物关系
│   │       ├── timeline/      # URL: /editor/[id]/timeline 时间线校验
│   │       ├── validation/    # URL: /editor/[id]/validation 逻辑校验
│   │       └── illustrations/ # URL: /editor/[id]/illustrations 插画生成
│   ├── scripts/page.tsx       # URL: /scripts    剧本列表
│   ├── community/page.tsx     # URL: /community   创作社区
│   ├── notifications/page.tsx # URL: /notifications 通知中心
│   ├── settings/
│   │   ├── page.tsx           # URL: /settings    设置首页
│   │   └── quota/page.tsx     # URL: /settings/quota 额度管理
│   ├── dashboard.css
│   └── responsive.css
├── (blank)/                   # 极简布局（无侧栏，用于沉浸式子页）
│   └── editor/[scriptId]/illustrations/market/page.tsx
├── auth/                      # 认证页面（独立布局，不属任何路由组）
│   ├── login/
│   ├── sign-up/
│   ├── forgot-password/
│   ├── update-password/
│   ├── sign-up-success/
│   ├── confirm/route.ts       # 邮箱确认回调
│   ├── error/page.tsx
│   └── auth.css
├── api/                       # Route Handlers
│   ├── editor/[scriptId]/...  # 编辑器 save / polish / rollback / versions
│   ├── generate/[phase]/route.ts  # 分阶段生成 SSE
│   ├── illustrations/tasks/[taskId]/run/route.ts
│   ├── timeline/regenerate/route.ts
│   └── validate/route.ts      # 替代 Supabase Edge Function 的本地校验
├── layout.tsx                 # 根布局：ThemeProvider + AntdProvider + ConfigProvider
├── globals.css
├── favicon.ico
├── opengraph-image.png
└── twitter-image.png
```

### 3.2 路由组职责

| 路由组 | 布局特征 | 鉴权 |
|---|---|---|
| `(marketing)` | 全屏营销页，无侧栏顶栏 | 公开 |
| `(dashboard)` | CSS Grid 三宫格（248px 侧栏 + 56px 顶栏 + main） | 需登录 |
| `(blank)` | 仅内容区，用于沉浸式预览 | 需登录 |
| `auth/*` | 独立居中卡片布局 | 公开 |

### 3.3 鉴权与中间件

鉴权通过 `lib/supabase/middleware.ts` 中的 `proxy()` 函数实现（Next.js 16 起 middleware 约定更名为 proxy）：

- **公开路由**：`/`、`/auth/*`
- **受保护路由**：`/dashboard`、`/generate`、`/editor`、`/scripts`、`/community`、`/settings`（及子路径）
- **跳转规则**：
  - 未登录访问受保护路由 → `/auth/login`
  - 已登录访问 `/` → `/dashboard`
  - 已登录访问 `/auth/*` → `/dashboard`
- **会话刷新**：每次请求都调用 `supabase.auth.getUser()` 刷新过期 Token；网络异常时降级为未登录。

### 3.4 编辑器路由约定

- `/editor`（无 scriptId）：**重定向逻辑** —— 用户有剧本则跳最近剧本 `/editor/<recentId>`；无剧本则跳 `/generate`。
- `/editor/[scriptId]`：剧本编辑主界面。
- 子页（clues/relations/timeline/validation/illustrations）：通过侧栏 `navHref(sub)` 跳转，**无剧本时统一指向 `/generate`**。
- ScriptSwitcher 使用 `router.push('/editor/${id}')` 真实导航，不使用 `router.refresh()`。
- 编辑器通过 `useSearchParams` 读取 `act/char/highlight` 参数，调用 `consumeHighlight` 切换场景/人物并滚动到高亮，3 秒后 `clearHighlight`。

---

## 四、布局与视觉规范

### 4.1 全局主题

```ts
// app/layout.tsx
const antdTheme = {
  token: {
    colorPrimary: "#8a1c1c",     // 朱砂红，对齐原型
    borderRadius: 4,
    fontFamily: 'var(--font-noto-serif-sc), "Noto Serif SC", serif',
  },
};
```

- `ThemeProvider`（next-themes）：attribute="class"，defaultTheme="system"，支持暗色模式。
- `ConfigProvider locale={zhCN}`：AntD 中文化。
- 字体：Noto Serif SC（思源宋体），强调中文阅读感。

### 4.2 主工作区布局

`apps/web/app/(dashboard)/layout.tsx` 实现 CSS Grid 三宫格：

```
┌──────────┬─────────────────────────────────────┐
│          │  Topbar (56px)                      │
│ Sidebar  ├─────────────────────────────────────┤
│ (248px)  │                                     │
│          │  Main (.main, z-index: 3)           │
│          │  └─ .view.active > {children}       │
│          │                                     │
└──────────┴─────────────────────────────────────┘
```

**侧栏（Sidebar）结构**：

- 品牌区（叙光 Logo + 副标题 NARRLIGHT · STUDIO）
- ScriptSwitcher（剧本切换器，下拉展示用户全部剧本）
- 导航分组：
  - **创作**：概览、剧本生成、剧本编辑
  - **校验**：时间线校验、逻辑校验（无剧本时禁用）
  - **物料**：线索卡管理、人物关系、插画生成（无剧本时禁用）
  - **社区**：创作社区
- 底部用户区：头像、昵称、剩余额度（点击跳 `/settings/quota`）、退出登录按钮

**顶栏（Topbar）结构**：

- 移动端菜单切换按钮（label + checkbox hack，详见 responsive.css）
- 面包屑（首页 / 当前剧本标题）
- 全局搜索（GlobalSearch，基于真实剧本列表搜索）
- 系统状态点（"系统就绪"）
- 通知面板（NotificationPanel）
- 设置菜单（SettingsMenu）

**关键 CSS 约定**：

- 页面根元素**禁止使用 `.view` 类**，避免与布局容器 `display: none` 冲突。
- `.main` 使用 `z-index: 3`，Topbar `z-index: 4`；Modal/Drawer 必须作为 `.main` 的兄弟节点，不要嵌套在内部。
- `.editor-content` 必须含 `min-height: 0` 确保 flex 高度分配。
- `.editor-main` 使用 `align-self: stretch` + `min-height: 0` 占满 grid 行高。
- `#editorBody` 必须含 `min-height: 0` 启用 flex 收缩。

### 4.3 数据 Context

`DashboardContext`（`lib/contexts/dashboard-context.tsx`）由 layout 注入，子页面通过 `useDashboard()` 消费 user/profile/scripts，**避免子页面重复查询 DB**。

```ts
interface DashboardContextValue {
  user: User;
  profile: DashboardProfile | null;
  scripts: Script[];
}
```

---

## 五、功能模块

### 模块 1：营销落地页（`/`）

- 严格还原 `docs/prototype/promo-v1.html`。
- 鼠标视差动效（指纹、血迹、涂抹氛围层）。
- 已登录用户访问 `/` 自动跳转 `/dashboard`。

### 模块 2：概览（`/dashboard`）

- 核心指标卡片：在创剧本数、剩余额度、本周生成次数、待办校验数。
- Resume Hero：恢复最近编辑的剧本，一键跳回编辑器。
- 活动流（ActivityStream）：最近生成任务、版本保存、校验报告事件。
- 快速操作（QuickActions）：新建剧本、生成插画、查看社区。
- 待办面板（TodoPanel）：未完成的校验项、失败的生成任务。
- 工作流列表（WorkflowList）：分阶段生成进度可视化。
- 数据来源：`lib/queries/dashboard-queries.ts`，使用 React `cache()` 在同一次请求内共享。

### 模块 3：剧本生成（`/generate`）

- **分阶段生成流程**（8 阶段）：
  1. `story_bible` 设定本（凶手、手法、核心诡计、动机链、人物骨架、时间线大纲）
  2. `character_profiles` 人物档案（确认设定本后启动）
  3. `act_structure` 幕次结构（与 4 并行）
  4. `character_script` 角色剧本（N 个角色分批并行，每批 4 个）
  5. `clues` 线索卡（与 6/7 并行）
  6. `organizer_manual` 组织者手册
  7. `truth_review` 真相复盘
  8. `timeline_structure` 时间线结构（自动触发）
- **确认门闸**：阶段 0 完成后暂停，等待用户确认设定本后再进入阶段 1。
- **中断与重试**：AbortController 终止 SSE 流；单阶段失败可重试。
- **断点恢复**：`resumeFromScript(scriptId)` 扫描 7 表完成状态，恢复到对应阶段。
- **进度回传**：每阶段 chunk/progress/completed/error 事件透传 UI。
- 实现位于 `lib/hooks/use-phased-generation.ts`，调用 `/api/generate/[phase]` SSE 接口。

### 模块 4：剧本编辑（`/editor/[scriptId]`）

- 章节树（ChapterTree）：按幕次/场景/人物分组导航。
- 编辑器内容（EditorContent）：角色剧本使用 `.act-section` 场景分隔，传统中式卷轴排版（朱砂题签、❖ 分隔符、首字下沉）。
- 编辑器工具栏（EditorToolbar）：保存、撤销、重做、AI 润色、版本对比。
- AI 调整面板（AiAdjustPanel）：定向调整单人物剧情、增加反转、补全动机、优化叙诡、替换诡计。
- 版本历史（VersionHistory）：
  - 保存时落 `version_snapshots` 表（含 `snapshot_data` JSONB + `change_summary`）。
  - 版本对比（VersionDiff）：word-level 差异，插入绿色背景+下划线，删除浅红背景+删除线。
  - 沉浸式全屏预览：包含左侧章节树导航、"上一处/下一处变更"按钮 + 计数器。
  - 回滚：`POST /api/editor/[scriptId]/rollback`，回滚后清除脏快照防止内容回退。
- 编辑器状态：`useEditorStore` 维护 currentNodeId / currentActIdx / isEditing / isDirty。

### 模块 5：线索卡管理（`/editor/[id]/clues`）

- 自动归类：按类型（物证/口供/深入线索/隐藏线索）、所属章节、搜证地点分类。
- 关联标注：自动关联人物、地点、真相，支持手动标记"干扰项""关键线索"。
- 数据属性分类：`data-act`（act1/act2/act3/truth）、`data-phase`（public/private/key/trap）。
- 导出：一键生成可打印线索卡 PDF / 图片，支持自定义尺寸与版式模板。
- 复用 `lib/services/clue-service.ts` 与 `lib/export/clue-*-export.tsx`。

### 模块 6：人物关系（`/editor/[id]/relations`）

- 关系图谱：AntV G6 渲染节点/边，支持拖拽、缩放、布局切换。
- 节点：人物（含头像、身份、是否凶手标记）。
- 边：明线关系（family/friend/lover/enemy/colleague/conspiracy/other）+ 暗线关系（hidden_label）。
- 关系编辑器（RelationEditor）：手动新增/修改/删除关系，支持显隐切换。
- 关系详情面板（RelationDetailPanel）：点击边展示完整关系描述。
- 关系图导出：PNG / SVG，复用 `lib/export/relation-graph-export.ts`。

### 模块 7：时间线校验（`/editor/[id]/timeline`）

- 时间线抽取：`TimelineExtractor.extract()` 优先读 `timeline_events` 表，表空时降级扫描 acts/scenes 文本。
- 时间线图表（TimelineChart）：
  - 自适应时间轴，跨天剧本含日期分隔线。
  - 多维切换：按人物 / 按地点 / 按幕次。
- 冲突检测（ConflictDetector）：
  - 时间冲突（同一人物同时出现在两地）
  - 地点冲突（location_conflict）
  - 因果断裂（causality_break）
  - 覆盖警告（coverage_warning）
- 冲突列表（TimelineConflictList）：分类展示，点击跳转编辑器对应位置。
- `timeline_events` 表扩展字段：day、event_type、participants、thread、causes。
- 重生成：`POST /api/timeline/regenerate`。

### 模块 8：逻辑校验（`/editor/[id]/validation`）

- 校验类型：TIMELINE / LOGIC / DIFFICULTY / FULL。
- 思维链 + 多轮自检架构：LLM 扮演专业测本员逐条核对逻辑链。
- 检测维度：
  - 伏笔回收、人物动机合理性、线索与真相对应、凶案手法可行性。
  - 叙述性诡计识别（NarrativeTrickDetector）：避免把叙诡误判为 bug。
  - 隐性逻辑校验（IssueClassifier）：人物行为是否符合人设。
- 难度评估（DifficultyAssessor）：基于线索数量、干扰项占比、诡计复杂度标定难度等级（easy/normal/hard/extreme）。
- 校验报告：severe/warning/hint 三级问题列表，支持跳转编辑器修复。
- 自动修复（AutoFixService）：常见问题一键修复建议。
- 增量校验（IncrementalValidationService）：编辑后只校验受影响片段。
- 报告导出：PDF，复用 `lib/export/validation-report-pdf.tsx`。
- 本地校验接口：`/api/validate` 替代 Supabase Edge Function `/functions/validate`，避免本地开发 404。

### 模块 9：插画生成（`/editor/[id]/illustrations`）

- 插画类型：封面 / 场景 / 线索卡 / 公共线 / 人物 / 海报。
- 类型 Tab：含颜色指示、数量统计、进度跟踪（已完成/总数）。
- 资产列表（AssetList）：按类型 `.scene-group-head` 分组，动态数量更新。
- 风格档案（IllustrationStyleProfile）：锁定全本美术风格（水墨古风/民国旧纸/赛博等）。
- 任务模型选择：openai / seedream / glm，支持 16:9 / 4:3 / 1:1 等比例。
- 质量检查（IllustrationQuality）：unchecked / passed / warning 三态，warning 自动提示重生成。
- 新任务抽屉（NewTaskDrawer）：暖纸色背景 + 朱砂强调 + 印章装饰，保持传统中式风格。
- 任务执行：`POST /api/illustrations/tasks/[taskId]/run`，SSE 流式回传进度。
- 市场素材页（`/editor/[id]/illustrations/market`）：使用 `(blank)` 布局，沉浸式选模板。

### 模块 10：创作社区（`/community`）

- 视角切换：创作者 / 玩家。
- 分类：推荐 / 拼车 / 测评 / 攻略 / 杂谈 / 求助 / 关注。
- 内容卡片：瀑布流，支持封面渐变变体（c1~c8）、高度档位（tall/mid/short）。
- 卡片类型：carpool / review / guide / rec / ask / talk。
- 互动：点赞、评论、收藏、加入拼车、关注作者。
- 侧栏组件：社区脉搏统计、热门话题、推荐作者、热门剧本榜。
- 发布弹窗（PublishModal）：选择分类、上传封面、添加标签。
- 当前数据为 Mock（`lib/services/community-service.ts`），后续接入真实数据库。

### 模块 11：通知中心（`/notifications`）

- 通知类型：生成任务完成/失败、校验报告出炉、社区互动、系统公告。
- 已读/未读筛选，批量标记已读。

### 模块 12：设置与额度

- `/settings`：账号信息、手机号修改、密码修改、偏好设置。
- `/settings/quota`：
  - 当前套餐（free / pro）、已用/剩余额度。
  - 套餐升级入口（接入支付后）。
  - 额度使用历史（来自 generation_tasks 表）。

---

## 六、数据流与状态管理

### 6.1 Supabase 客户端

| 客户端 | 位置 | 用途 |
|---|---|---|
| SSR Server Client | `lib/supabase/server.ts` | Server Components / Server Actions / Route Handlers，每次新建实例 |
| SSR Browser Client | `lib/supabase/client.ts` | Client Components 数据查询与认证读取 |
| Service Role Admin | `lib/supabase/admin.ts` | 服务端绕过 RLS（仅限敏感操作，如 timeline_events 服务端抽取） |
| Middleware Client | `lib/supabase/middleware.ts` | 路由守卫与会话刷新 |

**关键约束**：

- Server Client **禁止缓存为全局变量**（Fluid compute 兼容）。
- Browser Client 环境变量未配置时返回占位 client，避免 fetch failed 噪音。
- Service Role Key 校验：必须是 `eyJ` 开头且全 ASCII，否则抛错。

### 6.2 数据查询优化

- **Dashboard 查询并行化**：`Promise.all([getCachedProfile, getCachedScripts])`。
- **React cache() 共享**：`getCachedUser` / `getCachedProfile` / `getCachedScripts` 在同一次请求内复用，子页面调用命中缓存。
- **Client Components** 通过 `DashboardContext` 拿 user/profile/scripts，不再重复查询。

### 6.3 状态管理（Zustand）

| Store | 职责 |
|---|---|
| `editor-store.ts` | 当前节点、幕次索引、编辑模式、isDirty 脏标记 |
| `generation-store.ts` | 分阶段生成进度、当前阶段、错误信息 |
| `script-store.ts` | 当前剧本元信息、剧本列表缓存 |
| `ui-store.ts` | 抽屉开关、面板折叠、全局搜索状态 |

### 6.4 服务层（`lib/services/`）

| 服务 | 职责 |
|---|---|
| `script-service.ts` | 剧本 CRUD + 状态机（draft→generating→completed→archived） |
| `clue-service.ts` / `clue-extractor.ts` | 线索卡 CRUD 与自动抽取 |
| `relation-extractor.ts` | 人物关系 NER 抽取 |
| `quota-service.ts` | 免费额度检查与扣减，pro 套餐无限 |
| `version-service.ts` | 版本快照、对比、回滚 |
| `notification-service.ts` | 通知 CRUD |
| `overview-service.ts` | 概览页聚合数据 |
| `generation-task-service.ts` | 生成任务状态管理 |
| `generation-resume-service.ts` | 断点恢复 |
| `illustration-service.ts` / `illustration-generate-service.ts` / `illustration-workflow-service.ts` / `illustration-quality.ts` | 插画全流程 |
| `community-service.ts` | 社区内容（当前 Mock） |
| `auto-fix-service.ts` | 校验问题自动修复 |
| `incremental-validation-service.ts` | 增量校验 |
| `script-import-service.ts` | 外部剧本导入 |

### 6.5 AI 引擎（`lib/ai/`）

- **Providers**（`providers/`）：base-provider 抽象 + deepseek / glm / openai-image / seedream 具体实现 + fetch-with-proxy 代理支持。
- **Prompts**（`prompts/`）：act-structure / character-profiles / character-script / clues / illustration-* / logic-validation / organizer-manual / script-adjust / script-generation / story-bible / timeline-structure / truth-review。
- **Stream**（`stream/sse-handler.ts`）：SSE 流式响应统一处理。

### 6.6 校验引擎（`lib/validation/`）

- `difficulty/assessor.ts`：难度评估。
- `logic/issue-classifier.ts`：问题分类。
- `logic/narrative-trick-detector.ts`：叙诡识别。
- `timeline/conflict-detector.ts`：冲突检测（时间/地点/因果/覆盖）。
- `timeline/extractor.ts`：时间线抽取。
- `timeline/time-window.ts`：时间窗口计算。

---

## 七、API 路由

### 7.1 编辑器 API

```ts
// GET  /api/editor/[scriptId]                  读取剧本全量数据
// POST /api/editor/[scriptId]/save             保存剧本（落 version_snapshots）
// POST /api/editor/[scriptId]/polish           AI 润色
// POST /api/editor/[scriptId]/rollback         版本回滚
// GET  /api/editor/[scriptId]/versions         版本列表
// GET  /api/editor/[scriptId]/versions/[n]     单版本详情
```

### 7.2 生成 API

```ts
// POST /api/generate/[phase]                   分阶段生成（SSE）
//   phase: story_bible | character_profiles | act_structure |
//          character_script | clues | organizer_manual |
//          truth_review | timeline_structure
```

### 7.3 校验 API

```ts
// POST /api/validate                           逻辑校验（替代 Edge Function）
// POST /api/timeline/regenerate                时间线重生成
```

### 7.4 插画 API

```ts
// POST /api/illustrations/tasks/[taskId]/run   执行插画任务（SSE）
```

### 7.5 响应格式

统一复用 `lib/api/response.ts`：

```ts
// 成功：{ data: T }
// 失败：{ error: { code: string, message: string } }，HTTP 状态码对齐
// 自定义 ApiError 类，支持 QUOTA_EXCEEDED(429) / NOT_FOUND(404) / DB_QUERY_ERROR(500) 等
```

---

## 八、数据库与 RLS

### 8.1 数据表清单

| 表 | 用途 |
|---|---|
| `users` | 用户档案（手机号、昵称、配额、套餐） |
| `scripts` | 剧本元信息 |
| `characters` | 人物 |
| `acts` | 幕次 |
| `scenes` | 场景 |
| `clues` | 线索卡 |
| `character_relations` | 人物关系 |
| `timeline_events` | 时间线事件（含 day/event_type/participants/thread/causes 扩展字段） |
| `version_snapshots` | 版本快照 |
| `generation_tasks` | AI 生成任务（task_type 含 14 种枚举） |
| `validation_reports` | 校验报告 |
| `difficulty_assessments` | 难度评估 |
| `story_bibles` | 设定本 |
| `character_scripts` | 角色剧本 |
| `organizer_manuals` | 组织者手册 |
| `truth_reviews` | 真相复盘 |
| `illustration_market_items` | 插画市场素材 |
| `illustration_style_profiles` | 插画风格档案 |
| `illustration_tasks` | 插画任务（含 quality_status） |
| `illustration_assets` | 插画资产 |

### 8.2 RLS 策略

- **users**：只能查看/修改自己数据。
- **scripts**：作者可管理自己的剧本（`FOR ALL USING (auth.uid() = author_id)`）。
- **子表**（characters/acts/scenes/clues/character_relations/timeline_events/version_snapshots/generation_tasks/validation_reports/difficulty_assessments/story_bibles/character_scripts/organizer_manuals/truth_reviews/illustration_*）：通过 `script_id IN (SELECT id FROM scripts WHERE author_id = auth.uid())` 子查询授权。
- **scenes**：通过 `act_id → acts.script_id → scripts.author_id` 三层联表。
- **已知限制**：`timeline_events` 的 RLS 子查询策略不生效，服务端抽取必须用 service role admin client。

### 8.3 关键约束

- `scripts.author_id` 必须是 `auth.users.id`（不是 `users.id`）。
- `scripts.difficulty` 必须用 `beginner/intermediate/advanced` 三值（DB CHECK）。
- `scripts.genre` 必须用 `hardcore/emotion/horror/funny/mechanism`。
- `generation_tasks.task_type` 含 14 种枚举：FULL_SCRIPT / CHARACTER_ADJUST / CLUE_MODIFY / TRICK_REPLACE / STYLE_CHANGE / COMPRESS / COMPLIANCE / ILLUSTRATION / STORY_BIBLE / CHARACTER_PROFILES / ACT_STRUCTURE / CHARACTER_SCRIPT / CLUES / ORGANIZER_MANUAL / TRUTH_REVIEW / TIMELINE_STRUCTURE。
- 前端枚举（`types/index.ts`）`ScriptDifficulty` 含 `expert` 四档，与 DB 不一致 —— 落库时需映射。

---

## 九、导出能力

| 模块 | 文件 | 输出格式 |
|---|---|---|
| 线索卡 | `clue-card-templates.ts` / `clue-image-export.ts` / `clue-pdf-export.tsx` | PDF / 图片 / ZIP 批量 |
| 编辑器 | `editor-pdf-export.ts` | PDF（保留朱砂题签、场景分隔、段落缩进） |
| 关系图 | `relation-graph-export.ts` | PNG / SVG |
| 时间线 | `timeline-report-pdf.ts` | PDF |
| 校验报告 | `validation-report-pdf.tsx` | PDF |

---

## 十、组件库结构

```
apps/web/components/
├── common/                    # 通用组件
│   ├── antd-provider.tsx      # AntD 主题与消息封装
│   ├── badge.tsx / button.tsx / card.tsx / input.tsx / modal.tsx
│   ├── empty.tsx              # 空状态
│   ├── loading.tsx / loading-skeleton.tsx  # 加载态
│   ├── content-blocked-modal.tsx  # 内容拦截（额度不足/违规）
│   ├── global-search.tsx      # 全局搜索（基于真实剧本列表）
│   ├── nav-item.tsx           # 侧栏导航项（支持 disabled）
│   ├── notification-panel.tsx # 通知面板
│   ├── script-switcher.tsx    # 剧本切换器
│   ├── settings-menu.tsx      # 设置下拉菜单
│   ├── stale-validation-banner.tsx  # 校验过期横幅
│   └── state-views.tsx        # 状态视图（loading/error/empty）
├── clue-card/                 # 线索卡组件群
├── community/                 # 社区组件群
├── editor/                    # 编辑器组件群
├── generate/                  # 生成组件群
├── illust/                    # 插画组件群
├── overview/                  # 概览组件群
├── validation/                # 校验组件群
├── visualization/             # 可视化组件群（关系图 + 时间线）
├── ui/                        # Radix UI 基础组件（checkbox/dropdown-menu/label）
├── marketing/                 # 营销页组件
└── auth-*.tsx                 # 认证相关表单组件
```

---

## 十一、加载态与骨架屏

| 场景 | 骨架屏 |
|---|---|
| Dashboard layout 级 | `loading.tsx` 顶级骨架 |
| 概览页 | `ContentSkeleton` |
| 剧本列表 | `scripts/loading.tsx` |
| 编辑器 | `editor/loading.tsx` |
| 额度页 | `settings/quota/loading.tsx` |
| 通用 | `LoadingSkeleton` + `Loading` |

---

## 十二、关键工程约定

### 12.1 文件头注释

每个 `.ts` / `.tsx` 文件顶部必须有注释说明文件用途。

### 12.2 命名约定

- **数据库字段**：snake_case（`author_id` / `created_at`）。
- **TypeScript 接口**：camelCase（`authorId` / `createdAt`），由 service 层 `mapRow` 做映射。
- **CSS 类**：kebab-case（`.editor-content` / `.scene-group-head`）。
- **路由**：kebab-case（`/auth/forgot-password`）。

### 12.3 提交信息

中文 conventional commits，例如：

```
fix(editor): 编辑保存后清除脏快照防止内容回退
feat(generate): 新增时间线结构阶段自动触发
```

### 12.4 验证要求

- 修改 TypeScript/React/Next.js/共享库 → `pnpm lint`。
- 修改行为或校验逻辑 → 运行相关 Vitest 测试。
- 修改路由/服务端客户端边界/配置/生产行为 → `pnpm build`。
- 命令无法运行时说明原因与剩余风险。

### 12.5 UI 一致性

- 保持与现有仪表盘和组件约定一致。
- 保留现有中文产品文案与领域术语。
- 角色剧本使用 `.act-section` 场景分隔，传统中式卷轴排版。
- 所有可编辑内容（角色剧本、组织者手册）使用统一 `editor-content` 容器，`overflow-y: auto`。
- 阅读区域（角色剧本、组织者手册、真相复盘）必须高度一致 + 滚动容器。

---

## 十三、环境变量

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...     # 仅服务端使用

# AI Providers（按需配置）
DEEPSEEK_API_KEY=...
GLM_API_KEY=...
OPENAI_API_KEY=...
SEEDREAM_API_KEY=...

# 代理（可选）
HTTPS_PROXY=...
```

环境变量校验逻辑见 `lib/supabase/admin.ts`：service role key 必须以 `eyJ` 开头且全 ASCII。

---

## 十四、本地开发

```bash
# 安装依赖
pnpm install

# 启动开发服务器（含 Supabase 代理）
pnpm dev:web

# 原始 Next.js dev（不走代理）
pnpm --dir apps/web dev:raw

# 构建
pnpm build:web

# Lint
pnpm lint:web
```

`apps/web/scripts/dev.mjs` 提供本地开发代理，处理 Supabase Auth 回调与 Edge Function 替换。

---

## 十五、关键风险与对策

| 风险 | 对策 |
|---|---|
| Supabase Edge Function 本地不可用 | 用 Next.js Route Handler 替代（`/api/validate` 替代 `/functions/validate`） |
| timeline_events RLS 子查询不生效 | 服务端抽取改用 service role admin client |
| 长 SSE 流被中间网关截断 | 客户端 AbortController + 断点恢复 |
| 浏览器 cookie 与 DB user.id 不同步 | 插入 scripts 时 `author_id` 必须取 `auth.users.id` |
| CHECK 约束违反被误判为外键错误 | 前端错误处理细化区分约束类型 |
| 时间线抽取失败（acts/scenes 缺 HH:MM） | AI 后处理结构化自然语言时间描述 |
| 前端 `ScriptDifficulty.expert` 与 DB 不一致 | 落库前映射回 `advanced` |
| 3D 翻页被 `overflow: hidden` 破坏 | `.char-pages` 禁用 overflow hidden，保留 `transform-style: preserve-3d` |
| Modal 嵌套在 `.main` 内被 z-index 遮挡 | Modal 作为 `.main` 兄弟节点，挂载到 `#editor-portal-root` |
