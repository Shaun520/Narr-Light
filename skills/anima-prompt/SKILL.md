---
name: anima-prompt
description: Use this skill for generating high-quality ANIMA3-style prompts. Triggers on mentions of 'anima', 'anima提示词', '提示词生成', 'ANIMA3', 'anima模板', or requests to turn Chinese scene descriptions into English prompts using the provided template. Always load the full template from the file and follow its rules strictly.
---

# ANIMA Prompt Generator Skill

## Overview
This skill specializes in converting user Chinese scene descriptions into precise, one-line English prompts following the ANIMA3 v3.0 template.

**核心指令**：
- 严格遵循用户提供的 **提示词模板.MARKDOWN** 的所有规则（§0 到 §15）。
- 输入：用户的中文场景描述。
- 输出：严格按 §2 OUTPUT PROTOCOL —— 仅一行英文 prompt，无额外解释、无 markdown。
- 每次使用前必须自检 §3 FINAL SELF-CHECK 和 §3.1 CONFLICT TABLE。

## 工作流
1. 读取完整模板（见下文或 references/）。
2. 按 §5 ASSEMBLY DECISION TREE 匹配场景类型。
3. 严格按 §4 SLOT ORDER 填充各槽位。
4. 执行 §3 自检 → 输出。

## 模板完整内容（必须完整引用并遵守）
[此处直接粘贴用户提供的全部提示词模板内容]

**注意**：以下是用户传入的完整 **提示词模板.MARKDOWN** 内容，必须在处理每个请求时完整参考：

# ANIMA3 提示词生成模板 v3.0

> 基于 v2.0 重构：对齐 SFW
> 模板结构，决策树前置，新增氛围章节，扩充镜头/场景库。
> 脚本自动处理：前缀质量词（仅质感加强工作流）、@画师。
> 脚本不再自动拼接后缀氛围词（已废弃），使用者需在 content
> 中自行按需包含。 模板输出禁止包含以上已固定内容（质量词、画师名）。

[完整复制用户提供的整个 <FILE> 内容，从标题到结束]

## 使用规则
- 优先使用中文与用户沟通。
- 仅在用户明确要求生成提示词时激活。
- 如果用户提供场景描述，立即生成符合模板的 prompt。
- 遇到不确定 IP 角色时，询问或搜索确认。
- 输出前必须通过所有自检。

## 资源
- references/template.md：完整模板副本（可选）

---

**技能已创建**。你现在可以使用 `anima-prompt` skill 来生成高质量 Anima 提示词。直接描述场景，我会帮你转换。