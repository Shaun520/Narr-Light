# 叙光（NarrLight）Mock 静态页面路径索引

> 本文档汇总项目中所有可在开发期直接访问的 Mock 静态展示页面。
>
> - **Mock 页面**：页面数据全部来自组件内联常量或 Service 层 Mock 数据，不依赖后端数据库与 AI Provider，无需配置环境变量即可预览完整 UI。
> - **访问前提**：本地开发服务器已启动（`npm run dev`）；受保护路由需登录态（未配置 Supabase 时会被 proxy 重定向到登录页，可通过 `/auth/login` 任意手机号 + 验证码登录进入）。
> - **Demo 模式**：编辑器子页面（时间线/逻辑/线索卡/关系图/插画）在无剧本时统一使用 `/editor/demo` 作为 scriptId，所有 Mock 内容均可直接展示。
>
> 基础地址：`http://localhost:3000`

---

## 一、营销与认证页（公开访问，无需登录）

| 路径 | 页面名称 | Mock 内容 | 说明 |
|------|---------|-----------|------|
| `/` | 推广落地页 | 单屏沉浸式海报 + 滚动动效 | 严格还原 `docs/prototype/promo-v1.html` |
| `/auth/login` | 登录页 | 手机号 + 验证码表单 | 开发期任意输入即可登录 |
| `/auth/sign-up` | 注册页 | 手机号 + 验证码注册表单 | 同上 |
| `/auth/forgot-password` | 忘记密码 | 手机号重置表单 | — |
| `/auth/update-password` | 重置密码 | 新密码表单 | — |
| `/auth/sign-up-success` | 注册成功 | 成功提示页 | — |
| `/auth/error` | 认证错误 | 错误提示页 | — |

---

## 二、工作台核心页面（需登录）

### 2.1 概览与剧本管理

| 路径 | 页面名称 | Mock 内容 | 说明 |
|------|---------|-----------|------|
| `/dashboard` | 工作台概览 | 环形进度 + 4 张统计卡 + 工作流列表 + 待办/活动流 + 5 个快捷入口 | 无剧本时 `overview-service` 返回 `MOCK_DATA`（古镇迷案样例） |
| `/scripts` | 剧本列表 | 卡片网格 + 状态/进度展示 | 无剧本时显示空状态引导 |
| `/scripts/new` | 新建剧本 | 双栏布局 + 创建方式选择 + 9 字段表单 + 参数预览 | 表单提交需登录态；UI 可直接预览 |
| `/generate` | 剧本 AI 生成 | 参数表单 + 流式生成面板 | Mock 流式输出（`MOCK_LINES` 逐行推送） |
| `/community` | 创作社区 | 7 分类 tab + 瀑布流 + 侧栏榜单 + 脉搏统计 | `community-service` 返回 `MOCK_POSTS`/`MOCK_TOPICS` 等 |

### 2.2 编辑器主页面

| 路径 | 页面名称 | Mock 内容 | 说明 |
|------|---------|-----------|------|
| `/editor` | 编辑器入口 | 自动重定向 | 有剧本 → `/editor/[最近scriptId]`；无剧本 → `/editor/demo` |
| `/editor/demo` | 编辑器（Demo 模式） | 三栏布局：章节树 + 古风长卷 + 版本/AI 面板 | `SCRIPT_DATA` 内联 Mock，6 人物 × 3 幕 + 4 手册 + 真相 |

---

## 三、编辑器子页面（Demo 模式，5 个校验与物料视图）

> 访问方式：将路径中的 `[scriptId]` 替换为 `demo` 即可查看 Mock 展示。
>
> 例如：`http://localhost:3000/editor/demo/timeline`

### 3.1 时间线校验

| 路径 | 页面名称 |
|------|---------|
| `/editor/demo/timeline` | 时间线校验 |

**Mock 内容**：
- 6 角色轨道（沈墨白 / 沈墨尘 / 柳如烟 / 周半仙等），朱砂/金色/墨绿/紫色配色
- 18:00 - 次日 01:00 时间刻度表头，可横滚（min-width 760px）
- 19 条时间线事件（按角色分组，含起止时间与名称）
- 冲突事件朱砂红描边 + 脉冲动画
- 角色筛选 chip、幕次筛选、仅看冲突开关
- 冲突列表含"前往修正"按钮（跳转编辑器高亮）
- 重新校验 Mock 延迟 2 秒

### 3.2 逻辑闭环校验

| 路径 | 页面名称 |
|------|---------|
| `/editor/demo/validation` | 逻辑闭环校验 |

**Mock 内容**：
- 4 级漏洞 tab（严重缺陷 / 局部警告 / 优化提示 / 叙诡识别），带计数
- `MOCK_ISSUES`：朱砂私章未回收、乌头碱手法硬伤、沈墨尘时序倒置、祠堂祭器等样例漏洞
- 每条漏洞含类型、标题、描述、位置、修复建议
- 一键修复、跳转原文高亮、标记叙诡操作
- 难度评估卡：等级 + 评分 + 5 维度进度条（线索数量/干扰项占比/诡计复杂度/沉浸门槛/逻辑闭环度）
- 叙诡识别：时间叙诡 / 身份叙诡 / 视角叙诡
- 增量复检 Mock 延迟 1.5 秒，全量校验 Mock 延迟 3 秒
- 跨模块变更提示 banner（StaleValidationBanner）

### 3.3 线索卡管理

| 路径 | 页面名称 |
|------|---------|
| `/editor/demo/clues` | 线索卡管理 |

**Mock 内容**：
- 两行联动标签栏：幕次行（全部/第一幕/第二幕/第三幕/真相复盘）+ 环节行（全部/公共/角色私有/关键证据/干扰线索）
- 标签栏计数实时更新，act 与 phase 双向联动
- `DEFAULT_CLUES`：8 张示例线索卡
- 4 种视觉风格：ink 水墨 / film 胶片 / hand 手写 / mini 极简
- 每张卡含 corner 序号 + tag + title + text + foot 编号位置
- 干扰项 / 关键线索标记
- 深入 / 隐藏线索解锁层级展示
- 线索与复盘双向跳转
- 批量重绘 Mock（每张 1.5 秒，随机追加重绘戳记）
- 批量导出 PDF / PNG ZIP 打包

### 3.4 人物关系图谱

| 路径 | 页面名称 |
|------|---------|
| `/editor/demo/relations` | 人物关系图谱 |

**Mock 内容**：
- `DEFAULT_RELATION_GRAPH`：9 节点（沈墨白/沈墨尘/柳如烟/周半仙等）+ 关系边
- 3 种布局：力导向 / 环形 / 层级（AntV G6 实现）
- 明线实线金色，暗线虚线朱砂
- VIEW 模式 5 tab：全景 / 明线 / 暗线 / 阵营 / 亲密度
- FILTER 筛选 chips：沈家 / 外人 / 死者相关 / 凶手相关 / 医者相关
- 明暗线 / 标签三个开关
- 节点详情面板：头像 + 姓名 + 角色 + 简介 + 关联关系列表 + AI 调整快捷指令
- 双击连线弹出关系编辑面板（新增/删除/修改关系类型与标签）
- 节点拖拽与画布缩放平移
- 图谱导出 PNG / PDF（分辨率可选 1080p/2K/4K）

### 3.5 插画生成

| 路径 | 页面名称 |
|------|---------|
| `/editor/demo/illustrations` | 插画生成 |

**Mock 内容**：
- 6 类 tab：封面 / 场景 / 线索卡 / 公共线 / 人物立绘 / 海报（含计数）
- `DEFAULT_ILLUST_ASSETS`：19 项资产
- 资产列表含缩略图 + 标题 + 状态 + 类型 badge，支持类型筛选与计数
- 生成主区：多模型对比卡（DeepSeek-V4 / GLM-5.1 / 多模态融合）
- 生成卡含图片 + 模型 + seed + 采用/重绘/放大操作
- prompt-box：模型 / 比例 / 张数选择 + AUTO-INJECT 视觉基调提示
- 新建任务抽屉（4 步表单：基础 / Prompt / 参数 / 确认）
  - 类型卡单选、模型卡多选、比例/张数 chip、采样步数/CFG/风格强度滑块
  - 引用资产多选、高级折叠
  - 朱砂左边框 + "拟"字印章装饰
- 定稿保护、批量导出

---

## 四、设置与通知页（需登录）

| 路径 | 页面名称 | Mock 内容 | 说明 |
|------|---------|-----------|------|
| `/settings` | 账号设置 | 昵称/手机号/邮箱展示 + 编辑表单 | 开发期 Mock 保存（标注"开发期 mock"） |
| `/settings/quota` | 额度管理 | 免费额度进度 + 套餐对比 + 升级表单 | 标注"开发期 mock" |
| `/notifications` | 通知列表 | 5 个筛选 tab + 通知项列表 | `notification-service` 返回 Mock 通知（校验/生成/版本/社区） |

---

## 五、Demo 模式访问说明

### 5.1 无剧本时的自动跳转

1. 用户登录后访问 `/editor`（侧栏「剧本编辑」）
2. `/editor/page.tsx` 查询用户剧本列表
3. **有剧本** → 重定向到 `/editor/[最近scriptId]`
4. **无剧本** → 重定向到 `/editor/demo`（Demo 模式）

### 5.2 侧栏导航行为

- **有剧本时**：侧栏的「时间线校验/逻辑校验/线索卡管理/人物关系/插画生成」链接指向 `/editor/[scriptId]/[子页面]`
- **无剧本时**：侧栏链接统一指向 `/editor/demo/[子页面]`，所有 Mock 内容均可直接展示

### 5.3 直接访问 Demo 子页面

在浏览器地址栏直接输入以下路径即可查看对应 Mock 展示：

```
http://localhost:3000/editor/demo/timeline
http://localhost:3000/editor/demo/validation
http://localhost:3000/editor/demo/clues
http://localhost:3000/editor/demo/relations
http://localhost:3000/editor/demo/illustrations
```

---

## 六、Mock 数据来源索引

| 页面 | Mock 数据定义位置 | 主要常量 |
|------|------------------|----------|
| 推广页 | `app/(marketing)/page.tsx` + `components/marketing/promo-props.tsx` | — |
| 概览页 | `lib/services/overview-service.ts` | `MOCK_DATA` |
| 编辑器 | `components/editor/script-data.ts` | `SCRIPT_DATA` / `DEFAULT_NODE_ID` / `DEFAULT_VERSIONS` |
| 时间线 | `app/(dashboard)/editor/[scriptId]/timeline/page.tsx` | 内联 `TIMELINE_EVENTS`（19 条事件） |
| 逻辑校验 | `app/(dashboard)/editor/[scriptId]/validation/page.tsx` | `MOCK_ISSUES` / `MOCK_TRICKS` / `MOCK_SCRIPT` |
| 线索卡 | `components/clue-card/clue-card.tsx` | `DEFAULT_CLUES`（8 张）/ `STYLE_CHIPS`（4 种风格） |
| 人物关系 | `lib/services/relation-extractor.ts` | `DEFAULT_RELATION_GRAPH`（9 节点） |
| 插画生成 | `components/illust/asset-list.tsx` | `DEFAULT_ILLUST_ASSETS`（19 项）/ `ASSET_TYPE_TABS`（6 类） |
| 生成页 | `app/(dashboard)/generate/page.tsx` | `DEFAULT_PARAMS` / `MOCK_LINES` |
| 社区 | `lib/services/community-service.ts` | `MOCK_POSTS` / `MOCK_TOPICS` / `MOCK_AUTHORS` / `MOCK_RANK` / `MOCK_PULSE` |
| 通知 | `lib/services/notification-service.ts` | 内联 Mock 通知列表 |
| 账号设置 | `app/(dashboard)/settings/page.tsx` | 开发期 Mock 保存 |
| 额度管理 | `app/(dashboard)/settings/quota/page.tsx` | 开发期 Mock 套餐数据 |

---

## 七、快速预览清单（按推荐顺序）

1. `/` — 推广落地页（首屏视觉冲击）
2. `/dashboard` — 工作台概览（Mock 数据完整展示）
3. `/editor/demo` — 编辑器主页面（古风长卷阅读体验）
4. `/editor/demo/timeline` — 时间线校验（可视化时间轴）
5. `/editor/demo/validation` — 逻辑闭环校验（漏洞分级 + 难度评估）
6. `/editor/demo/clues` — 线索卡管理（4 种风格 + 联动筛选）
7. `/editor/demo/relations` — 人物关系图谱（G6 关系图 + 3 种布局）
8. `/editor/demo/illustrations` — 插画生成（多模型对比 + 任务抽屉）
9. `/generate` — 剧本 AI 生成（流式输出演示）
10. `/community` — 创作社区（瀑布流 + 双视角切换）
11. `/scripts/new` — 新建剧本（双栏布局 + 创建方式选择）
12. `/notifications` — 通知列表（5 类筛选）
13. `/settings` — 账号设置
14. `/settings/quota` — 额度管理
