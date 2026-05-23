# SDD 上下文压缩插件（sdd-compaction.js）

## 1. 背景与痛点

SDD 框架是一个多阶段长流程开发范式，覆盖：

```
requirements → design → develop → review → ST
```

每个阶段都会产生大量对话上下文：
- 每个 skill 指令本身 140～440 行
- `srs.md` / `design.md` / `tasks.md` 等产出物内容被 Agent 反复读取
- develop 阶段的 TDD 循环会产生多轮测试失败 → 修复的调试记录

当模型 context window 有限时，**上下文超限触发 compaction（压缩）**，OpenCode 会把历史对话压缩成一段通用摘要（Goal / Progress / Next Steps 等）。

**问题**：默认压缩不理解 SDD 领域，压缩后 Agent "失忆"：
- 不知道当前在做哪个 AR
- 不知道 `tasks.md` 里哪些 task 已完成、哪些失败
- 不知道 `design.md` 里定义了哪些接口签名
- 可能忘记阶段关键决策，导致重复询问或做出矛盾决策

---

## 2. 插件作用

`plugins/sdd-compaction.js` 是一个 **OpenCode 插件**，在 compaction 触发时，**向压缩提示词注入 SDD 领域感知的上下文**，使压缩后的 Agent 仍然"记得"当前开发状态。

```
压缩前（上下文已满）:
  [400 轮对话，包含 T001 实现过程、多次调试记录...]
  ↓ 触发 compaction
  默认压缩结果:
  [Goal: 实现 retry 机制]
  [Progress: 进行了一些开发]
  [Next Steps: 继续开发]
  ↓ Agent 恢复后：不知道做到哪了

压缩后（本插件注入）:
  [OpenCode 默认摘要]
  +
  [插件追加:
   AR=AR001, Phase=develop,
   tasks.md 进度表,
   当前 task=T002,
   design.md 接口签名]
  ↓ Agent 恢复后：精确知道状态，无需重新询问
```

---

## 3. 注入内容详解

插件根据不同阶段，注入不同的核心上下文：

### 通用信息（所有阶段都注入）

| 字段 | 来源 | 说明 |
|------|------|------|
| AR 名称 | `specs/changes/` 目录名（最近修改的） | 当前正在做的 AR |
| 当前阶段 | 根据文件存在性自动检测 | requirements / design / develop / review / st |
| 关键文件状态 | `srs.md` / `design.md` / `tasks.md` / `st-cases.md` 是否存在 | 快速判断阶段进度 |
| Task 进度表 | 解析 `tasks.md` 中的 Markdown 表格 | 每个 task 的 ID + 描述 + 状态 |

### 阶段专属上下文

| 阶段 | 注入内容 | 来源文件 |
|------|---------|---------|
| requirements | 功能需求列表（§3.x 小节标题） | `srs.md` |
| design | 设计概述（§1）+ 模块影响分析表格（§2） | `design.md` |
| develop | 当前/下一个 task + 已完成的 task ID 列表 + 接口签名（§3 代码块） | `tasks.md` + `design.md` |
| review | 最近 3 条进度记录（会话记录/审查记录） | `tasks.md` |
| ST | 测试用例 ID 列表 + 执行摘要表格 | `st-cases.md` |
| archived | `(AR is archived — no active context)` | — |

### 关键决策

扫描 `tasks.md` 进度记录中含有关键词（`决策` / `选择` / `方案` / `选定` / `decision` / `approach`）的条目，提取最近 5 条。

---

## 4. 工作原理

### 4.1 OpenCode 插件钩子

插件使用 `experimental.session.compacting` 钩子，这是 OpenCode 提供的 compaction 注入点：

```javascript
export const SddCompactionPlugin = async ({ directory }) => {
  return {
    'experimental.session.compacting': async (_input, output) => {
      const context = buildSddContext(directory);
      if (context) {
        (output.context ||= []).push(context);
      }
    },
  };
};
```

- `output.context.push(...)`：**追加模式**，在默认压缩提示词基础上补充 SDD 上下文
- 如果改为 `output.prompt = ...`：替换模式，完全控制压缩提示词（当前未采用）

### 4.2 执行流程

```
compaction 触发（自动或 /compact）
  ↓
OpenCode 调用所有插件的 experimental.session.compacting 钩子
  ↓
sdd-compaction.js:
  1. 检查 specs/changes/ 目录是否存在
     └─ 不存在 → 返回 null（非 SDD 项目，完全透明）
  2. 找到最近修改的 AR 目录
  3. 根据文件存在性检测当前阶段
  4. 读取 srs.md / design.md / tasks.md / st-cases.md
  5. 提取结构化上下文
  6. output.context.push(context)
  ↓
OpenCode compaction agent 基于 [默认提示词 + SDD 上下文] 生成压缩摘要
  ↓
历史消息被压缩，摘要 + 最近 2 轮原始消息保留在上下文中
```

### 4.3 阶段检测逻辑

```javascript
const detectSddPhase = (arDir) => {
  const hasSrs     = existsSync('srs.md');
  const hasDesign  = existsSync('design.md');
  const hasTasks   = existsSync('tasks.md');

  if (!hasSrs || !hasTasks) return 'requirements';
  if (!hasDesign)             return 'design';

  // 检查 tasks.md 中是否有 pending/in_progress 的 task
  if (hasPendingTask)         return 'develop';

  // 检查是否有审查记录且结果为 PASS
  if (!hasReviewPass)         return 'review';

  // 检查是否有 ST 记录且结果为 PASS/Go
  if (!hasSTPass)             return 'st';

  return 'archived';
};
```

---

## 5. 使用方式

### 5.1 部署

将插件文件复制到目标组件工程的 `.opencode/plugins/` 目录：

```bash
# 从 SDD 框架工程复制
cp plugins/sdd-compaction.js <目标组件工程>/.opencode/plugins/

# 确认目录结构
# <目标组件工程>/
#   .opencode/
#     plugins/
#       sdd-compaction.js    ← 部署在这里
#     commands/              ← 其他 SDD 适配文件
#     agents/
```

OpenCode 启动时自动加载 `.opencode/plugins/` 下的所有 `.js` 插件。

### 5.2 触发方式

插件**被动触发**，不需要手动调用：

| 触发方式 | 操作 | 说明 |
|---------|------|------|
| 自动触发 | context 达到窗口上限时 OpenCode 自动触发 | 最常用 |
| 手动触发 | 在 OpenCode 对话中输入 `/compact` | 阶段切换前手动压缩 |
| 快捷键 | `Ctrl+X C`（Windows/Linux）| 同 `/compact` |

触发后插件自动注入 SDD 上下文，无需任何额外操作。

### 5.3 验证插件是否生效

触发 compaction 后，查看压缩摘要中是否包含 `## SDD Project State` 段落：

```
## SDD Project State (Auto-extracted, DO NOT modify)

**AR:** AR001-add-retry-mechanism
**Current Phase:** develop

### Key Files Status
- srs.md: exists
- design.md: exists
- tasks.md: exists

### Task Progress
| ID   | Description         | Status      |
|------|---------------------|-------------|
| T001 | Implement config    | passing     |
| T002 | Add retry logic     | in_progress |
| T003 | Add unit tests      | pending     |
...
```

---

## 6. 设计决策

### 6.1 追加模式 vs 替换模式

| 方案 | 做法 | 优点 | 缺点 |
|------|------|------|------|
| 追加模式（已采用） | `output.context.push(context)` | 不丢失默认压缩能力；实现简单 | SDD 上下文可能和默认摘要重复 |
| 替换模式 | `output.prompt = customPrompt` | 精确控制摘要格式；无重复 | 需要完全重新实现压缩提示词 |

**选择追加模式的原因**：默认压缩摘要（Goal / Constraints / Progress / Next Steps）本身有价值，不需要替换；SDD 上下文作为补充信息即可。

### 6.2 非 SDD 项目的处理

插件首先检查 `specs/changes/` 目录是否存在：

```javascript
const changesDir = path.join(directory, 'specs', 'changes');
if (!fs.existsSync(changesDir)) return null;
```

- 返回 `null` → OpenCode 跳过此插件，使用默认 compaction
- **对 non-SDD 项目完全透明，零影响**

### 6.3 错误处理

所有文件读取都通过 `safeRead()` 包装，任何错误返回 `null` 而不是抛出异常：

```javascript
const safeRead = (filePath) => {
  try {
    return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
  } catch {
    return null;
  }
};
```

主钩子也有 try-catch，确保插件错误**永远不会导致 compaction 失败**。

---

## 7. 与 SDD Skill 框架的关系

本插件是 SDD Skill 框架的**补充**，不是替代：

```
┌─────────────────────────────────────────────────────┐
│              SDD Skill 框架                          │
│  sdd-router → requirements → design → develop → ... │
│  每个 skill 读取 srs.md / design.md / tasks.md      │
└──────────────────────┬──────────────────────────────┘
                       │ 上下文超限时
                       ↓
┌─────────────────────────────────────────────────────┐
│         sdd-compaction.js（本插件）                  │
│  在 compaction 时注入 SDD 领域上下文                 │
│  使压缩后的 Agent 仍然"记得"开发状态                 │
└─────────────────────────────────────────────────────┘
```

**分工**：
- SDD Skill：驱动开发流程，读写 `specs/changes/ARxxx/` 下的文件
- sdd-compaction.js：在压缩时读取这些文件，提取核心信息注入上下文

**二者协同**：Skill 产生的文件，正是插件读取的数据源。

---

## 8. 限制与注意事项

1. **只读 `specs/changes/` 下最近修改的 AR 目录**：如果同时有多个 AR 在进行，只会注入最近修改的那个。如需支持多 AR 并行，需要扩写 `findCurrentAR()` 逻辑。

2. **上下文注入长度有限**：插件对提取内容做了截断（`truncate(text, maxLen)`），避免注入内容本身过长导致新的上下文压力。

3. **依赖于 Markdown 文件格式**：`tasks.md` 的进度表格、`design.md` 的章节编号（§1、§2、§3...）需要符合 SDD 规范，否则提取可能不准确。

4. **OpenCode 版本依赖**：使用 `experimental.session.compacting` 钩子，这是 experimental API，未来 OpenCode 版本可能会有变动。

---

## 9. 文件位置

| 文件 | 路径 | 说明 |
|------|------|------|
| 插件源码 | `plugins/sdd-compaction.js` | 框架工程内位置 |
| 部署位置 | `<组件工程>/.opencode/plugins/sdd-compaction.js` | 目标组件工程内位置 |
| 本文档 | `docs/sdd-compaction-plugin.md` | 说明文档 |
