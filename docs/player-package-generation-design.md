# 玩家资料包生成结构设计方案

## 背景

当前生成链路里的“玩家剧本”更接近一段角色视角正文，结构通常是“每幕正文 + 场景正文 + 个人线”。但真实可开本材料并不只是长文本，而是由玩家可读内容、阶段任务、信息投放和主持人发放节点共同组成。

因此后续生成目标应从“生成角色剧本正文”升级为“生成可开本的玩家资料包”。

## 设计目标

- 支持序幕、章节页、每幕任务、等待提示、可说/不可说信息、阶段补充剧本等真实剧本杀材料结构。
- 所有高级模块均为可选，不强制每个剧本、每名玩家、每一幕都生成全部字段。
- 避免 AI 为了填字段而编造隐藏身份、禁言规则、误导信息或补充剧本。
- 支持“一个玩家多个资料包、多阶段身份或记忆补充”的信息发放方式。
- 支持后续编辑器按玩家、分册、幕次和模块编辑。

## 核心概念

### 玩家资料包

玩家资料包是某个玩家在某个阶段拿到的一份材料容器。

它可以包含序幕、公开身份、私人背景、全局目标、每幕材料、补充身份说明、结局前提示等内容，但不是所有字段都必须存在。

最低要求：

- 玩家席位或玩家名
- 当前身份
- 阅读顺序
- 至少一个正文模块或任务模块

可选模块：

- 封面信息
- 序幕
- 公开身份
- 私人背景
- 已知关系
- 隐藏秘密
- 全局目标
- 每幕正文
- 每幕目标
- 每幕可说信息
- 每幕不可说信息
- 每幕可误导信息
- 幕间等待提示
- 补充身份说明
- 结局前行动提示

### 每幕材料

每幕材料是玩家资料包里的阶段内容。它描述玩家在某一幕读到什么、知道什么、该做什么、不能说什么。

最低要求：

- 幕标题
- 本幕剧情正文或本幕任务，至少有一个

可选模块：

- 幕前引导
- 本幕剧情正文
- 你此时知道的信息
- 你此时的误解
- 你可以公开说的信息
- 你必须隐瞒的信息
- 你本幕要做的事
- 你可触发的互动
- 本幕结束等待语

### 分阶段补充剧本

分阶段补充剧本是特定节点追加发放的资料，不是所有剧本都需要。

适用场景：

- 某一幕后玩家身份变化
- 玩家恢复记忆
- 搜证后解锁新目标
- 某玩家拿到独有信息
- 情感本或还原本需要逐步揭示过去
- 机制本需要阶段性指令

最低要求：

- 第几幕发放
- 发给谁
- 补充内容

可选模块：

- 发放条件
- 新增身份
- 新增记忆
- 新增目标
- 新增禁言规则

## 推荐数据结构

### PlayerPackage

```ts
interface PlayerPackage {
  id: string;
  scriptId: string;
  playerSeatId: string;
  identityAssignmentId?: string;
  packageOrder: number;
  packageTitle: string;
  currentIdentity: string;
  readOrder: number;
  packageType: 'initial' | 'act' | 'supplement' | 'ending';
  contentJson: PlayerPackageContent;
  wordCount: number;
  generationStatus: 'pending' | 'running' | 'completed' | 'failed';
}
```

### PlayerPackageContent

```ts
interface PlayerPackageContent {
  cover?: {
    title: string;
    subtitle?: string;
  };
  prologue?: string;
  publicIdentity?: string;
  privateBackground?: string;
  knownRelations?: string[];
  hiddenSecrets?: string[];
  globalObjectives?: string[];
  actMaterials?: ActMaterial[];
  supplementPackages?: SupplementPackage[];
  endingPrompt?: string;
}
```

### ActMaterial

```ts
interface ActMaterial {
  actOrder: number;
  actTitle: string;
  preActIntro?: string;
  mainText?: string;
  knownFacts?: string[];
  misunderstandings?: string[];
  sayableInfo?: string[];
  forbiddenInfo?: string[];
  objectives?: string[];
  interactionPrompts?: string[];
  pauseInstruction?: string;
}
```

### SupplementPackage

```ts
interface SupplementPackage {
  releaseAct: number;
  releaseCondition?: string;
  receiverPlayerSeatId: string;
  receiverName: string;
  title?: string;
  newIdentity?: string;
  newMemory?: string;
  newObjectives?: string[];
  newSpeechRestrictions?: string[];
  content?: string;
}
```

## 示例

```json
{
  "playerSeat": 1,
  "playerName": "楚云歌",
  "currentIdentity": "北城女校学生",
  "readOrder": 1,
  "cover": {
    "title": "第一本 · 惊蛰",
    "subtitle": "入校前"
  },
  "prologue": "你抵达学校时，天边泛起鱼肚白。那封匿名信被你攥在掌心，纸角已经被汗水浸软。",
  "publicIdentity": "你是北城女校学生，暑假结束后回到学校。",
  "privateBackground": "你并不是第一次收到匿名信。上一封信让你想起了十年前失踪的姐姐。",
  "knownRelations": [
    "你认识陆辞泽，他曾在去年冬天帮你隐瞒过一次逃课。"
  ],
  "hiddenSecrets": [
    "你其实收到过死者寄来的旧照片。"
  ],
  "globalObjectives": [
    "查清姐姐当年离校的真相。",
    "不要让别人知道你见过那封信。"
  ],
  "actMaterials": [
    {
      "actOrder": 1,
      "actTitle": "第一幕 · 惊蛰",
      "mainText": "你站在校门口，听见钟声从旧楼方向传来。陆辞泽远远看见你，却像没看见一样移开了眼。",
      "knownFacts": [
        "你知道陆辞泽昨晚没有回宿舍。"
      ],
      "misunderstandings": [
        "你以为钟声是在八点后响起的。"
      ],
      "sayableInfo": [
        "你可以说你在校门口见过陆辞泽。"
      ],
      "forbiddenInfo": [
        "不要主动承认你收到过匿名信。"
      ],
      "objectives": [
        "询问大家暑假去了哪里。",
        "试探谁知道旧校舍钥匙。"
      ],
      "interactionPrompts": [
        "如果有人提到旧校舍，你可以追问他为什么知道那里。"
      ],
      "pauseInstruction": "云歌，先在这里等一等吧。"
    }
  ],
  "supplementPackages": [
    {
      "releaseAct": 2,
      "releaseCondition": "第一轮搜证后，由主持人单独发放。",
      "receiverPlayerSeatId": "seat-1",
      "receiverName": "楚云歌",
      "newMemory": "你终于想起，十年前带你离开学校的人并不是父亲。",
      "newObjectives": [
        "找到旧校舍档案袋。",
        "判断是否公开你十年前在场。"
      ],
      "newSpeechRestrictions": [
        "第三幕前不要直接说出你见过死者。"
      ]
    }
  ],
  "endingPrompt": "结局前，你需要决定是否公开姐姐留下的最后一封信。"
}
```

## 资料包复杂度

建议增加“资料包复杂度”配置，避免所有剧本都被迫生成复杂结构。

### 简洁

适合新手本、短时长本。

推荐模块：

- 序幕
- 每幕正文
- 每幕目标
- 等待提示

### 标准

适合常规盒装、城限体验。

推荐模块：

- 序幕
- 公开身份
- 私人背景
- 已知关系
- 隐藏秘密
- 全局目标
- 每幕正文
- 每幕目标
- 可说信息
- 不可说信息
- 等待提示

### 复杂

适合还原本、硬核本、机制本、长时长城限。

推荐模块：

- 标准内容
- 每幕误导信息
- 互动触发
- 分阶段补充剧本
- 新增记忆
- 新增身份
- 禁言规则

## 生成流程建议

建议从当前流程升级为：

```text
1. 设定本
2. 人物 / 玩家席位 / 身份分配
3. 分幕结构
4. 玩家资料包规划
5. 玩家资料包生成
6. 线索卡
7. 主持人手册
8. 真相复盘
```

新增的“玩家资料包规划”阶段负责决定每个玩家需要哪些模块，而不是直接写正文。

示例：

```json
{
  "playerSeat": 1,
  "playerName": "楚云歌",
  "packages": [
    {
      "packageType": "initial",
      "modules": [
        "cover",
        "prologue",
        "publicIdentity",
        "privateBackground",
        "globalObjectives",
        "actMaterials"
      ]
    },
    {
      "packageType": "supplement",
      "releaseAct": 2,
      "modules": [
        "newMemory",
        "newObjectives"
      ]
    }
  ]
}
```

## Prompt 约束

玩家资料包生成 prompt 应明确：

```text
以下模块都是可选模块，不要为了填字段而编造不必要内容。
只有当该模块服务于玩法、信息投放、情绪推进或主持人发放节点时才生成。
如果当前剧本不需要隐藏身份、禁言规则或补充剧本，可以省略。
```

同时设置最低约束：

```text
每名玩家必须至少包含：
1. 当前身份
2. 可读正文
3. 至少一个目标或行动提示
4. 阅读顺序
```

## Admin 配置建议

可新增“玩家资料包规格”配置页。

建议配置项：

- 默认资料包复杂度
- 是否允许补充剧本
- 是否允许新增身份
- 是否允许新增记忆
- 是否生成每幕等待提示
- 是否生成可说 / 不可说信息
- 是否生成误导信息
- 每名玩家最少目标数
- 每幕最少目标数
- 每包最低字数
- 补充剧本最大数量

## 前端编辑器展示建议

编辑器应按以下层级展示：

```text
玩家资料包
  玩家 1 · 楚云歌
    第一本 · 惊蛰
      封面
      序幕
      公开身份
      私人背景
      第一幕材料
      第二幕材料
    第二本 · 补充记忆
      发放条件
      新增记忆
      新目标
```

不要只展示整块 JSON 或一整篇正文。

## 落地顺序

### 第一阶段：结构升级

- 新增 `player_packages` 表。
- 保留旧 `character_scripts` 兼容。
- 定义 `PlayerPackage`、`ActMaterial`、`SupplementPackage` 类型。

### 第二阶段：生成升级

- 新增“玩家资料包规划”阶段。
- 按规划生成玩家资料包。
- 低复杂度剧本只生成必要模块，高复杂度剧本允许补充材料和多阶段发放。

### 第三阶段：编辑器升级

- 按玩家、分册、幕次、模块展示和编辑。
- 支持后续导出 PDF / 打印材料。

## 结论

后续优化重点不是单纯让 AI 写更多字，而是让 AI 生成“可执行的玩家资料包”。真正可开本的材料核心是信息投放、任务驱动、主持人节点和玩家阅读节奏，而不是只有连续正文。
