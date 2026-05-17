---
name: sdd-task-develop
description: "Use when design.md exists and tasks.md has pending tasks - implement code following TDD discipline, one task per cycle"
---

# SDD 代码开发 — 按任务 TDD 实现

基于已批准的 design.md 和 tasks.md，通过 TDD 方式逐任务实现代码。

**核心原则：** 一个开发会话只完成一个任务；每个任务严格按照 design.md 实现；质量门禁不可绕过。

<HARD-GATE>
不得跳过任何任务，不得在测试未通过的情况下标记任务完成，不得绕过质量门禁。
</HARD-GATE>

## Checklist

你必须为以下每个步骤创建 TodoWrite 任务，并按顺序完成：

1. **定向（Orient）** — 读取 tasks.md、design.md，选取当前任务
2. **启动（Bootstrap）** — 确认开发环境，读取组件规范
3. **TDD 循环** — Red → Green → Refactor
4. **质量门禁** — 覆盖率验证
5. **持久化（Persist）** — 更新 tasks.md，提交代码
6. **结束会话** — 输出完成摘要

---

## Step 1：定向（Orient）

### 1a. 读取当前状态

读取 `specs/changes/ARxxx-topic/tasks.md`：
- 找到所有 `status: pending` 的任务
- 按依赖关系和 ID 顺序，选取可执行的第一个任务（所有前置依赖均为 `passing`）
- 如果没有满足依赖的任务，报告循环依赖并请用户决定

记录选定的任务 ID（如 T002）。

### 1b. 读取设计文档

读取 `specs/changes/ARxxx-topic/design.md`，找到对应的设计节：
- 接口设计（§3）
- 算法/流程（§4）
- 边界条件矩阵（§5）
- 错误处理（§6）
- 测试设计（§7）

将对应的设计内容记录为 `{design_section}`，供后续 TDD 使用。

### 1c. 读取 srs.md 对应需求

读取 `specs/changes/ARxxx-topic/srs.md`，找到与当前任务关联的功能需求，提取验收标准（Given/When/Then）记录为 `{srs_section}`。

### 1d. 读取 AGENTS.md（如存在）

读取组件根目录的 AGENTS.md，确认：
- 代码风格要求
- 测试框架（如 gtest/gmock）
- 构建方式
- 其他开发约束

### 1e. 扫描相关代码

读取将要修改的现有源文件（`include/`、`src/`），理解当前实现。

**文档查找协议（Document Lookup Protocol）：**

定向完成后，手头应有：
- `{task}` — 当前任务对象（ID、描述、依赖）
- `{design_section}` — design.md 中对应的设计节全文
- `{srs_section}` — srs.md 中对应的功能需求全文

---

## Step 2：启动（Bootstrap）

### 2a. 开发环境检查

确认：
- 编译工具链可用（如 cmake / make / gcc / clang）
- 测试框架已安装（如 gtest/gmock）
- 如有 `init.sh` / `init.ps1`，且环境未就绪，执行一次

### 2b. 确认测试命令

确认以下命令可用（从 AGENTS.md 或 `long-task-guide.md` 或 `CMakeLists.txt` 读取）：
- 编译命令
- 测试执行命令
- 覆盖率生成命令（如使用 gcov/lcov）

记录这些命令，后续直接使用（不写包装脚本）。

### 2c. 冒烟测试

运行现有测试，确认之前已通过的任务没有回归。任何失败 → **停止**，先修复再继续。

---

## Step 3：TDD 循环（Red → Green → Refactor）

严格按照 design.md 中的 `{design_section}` 实现，不得自行发明接口或逻辑。

### 3a. Red — 先写测试

根据以下输入编写测试：
- `{design_section}` 中的接口设计（§3）和边界条件矩阵（§5）
- `{srs_section}` 中的验收标准（Given/When/Then）
- `{design_section}` 中的测试设计（§7）

**测试规则：**
- 测试文件命名：`tests/<module>_test.cpp`（或 AGENTS.md 中指定的命名）
- 每个测试函数对应一个明确的行为点
- 测试命名模式：`TEST(ClassName, DescribesWhatItTests)`
- 每个测试必须在注释中标注关联的需求（如 `// Covers: srs.md §3.1 验收标准 1`）
- 先写测试，确认测试因「目标代码不存在/不完整」而编译失败或运行失败（Red 状态）
- 不写测试实现之外的代码

运行测试，确认 Red。

### 3b. Green — 写最少代码让测试通过

在 `include/` 或 `src/` 中编写实现代码：
- 严格按照 `{design_section}` 的接口设计（函数签名、参数、返回值）
- 严格按照算法/流程设计（§4 的伪代码和流程图）
- 实现错误处理（§6 的错误处理表）
- 只写让当前任务测试通过的最少代码，不做额外优化或扩展

运行测试，确认全部通过（Green）。

**如果测试失败超过 3 次：**
1. 收集错误信息
2. 对照 design.md 检查是否有理解偏差
3. 如果是 design.md 有歧义 → 通过 AskUserQuestion 请用户澄清，不得自行猜测
4. 记录调试过程

### 3c. Refactor — 重构提升质量

在测试仍然全部通过的前提下：
- 消除重复代码
- 改善变量/函数命名（符合 AGENTS.md 规范）
- 拆分过长函数（单一职责）
- 添加必要注释（不解释显而易见的代码，解释「为什么」）
- 不改变接口签名（design.md 已定义）

每次小重构后重新运行测试，保持 Green。

---

## Step 4：质量门禁

### 4a. 测试覆盖率

运行覆盖率工具，检查当前任务涉及的代码：
- 语句覆盖率 >= design.md §7.2 中指定的目标（无指定则 >= 80%）
- 分支覆盖率 >= design.md §7.2 中指定的目标（无指定则 >= 70%）

**未达标时：**
- 识别未覆盖的行/分支
- 检查是否是 design.md 中的边界条件矩阵（§5）没有写对应测试 → 补写测试
- 不得通过注释掉代码或降低标准来通过覆盖率检查

### 4b. 编译警告

确认无新增的编译警告（原有的忽略，新引入的必须解决）。

### 4c. 代码规范

对照 AGENTS.md 的代码规范做自查：
- 命名规范符合要求
- 文件头注释格式（如有要求）
- 包含守卫（头文件）

---

## Step 5：持久化（Persist）

### 5a. 更新 tasks.md

将当前任务状态更新为 `passing`：

```markdown
| T002 | [任务描述] | T001 | passing | YYYY-MM-DD 完成 |
```

在 tasks.md 末尾「进度记录」节追加本会话记录：

```markdown
### YYYY-MM-DD 会话记录

- 完成任务：T002 [任务描述]
- 修改文件：[列表]
- 测试覆盖率：语句 XX%，分支 XX%
- 备注：[如有]
```

### 5b. 提交代码

```
git add [修改的文件]
git commit -m "feat(ARxxx): [任务描述简短标题]

- Implements: T002
- Related: srs.md §3.x
- Coverage: branch XX%, stmt XX%"
```

---

## Step 6：结束会话

输出本次会话完成摘要：

```
任务 T002 ([任务描述]) — 完成

修改文件：
  - include/xxx.h（新增接口）
  - src/xxx.cpp（实现）
  - tests/xxx_test.cpp（X 个测试用例）

覆盖率：语句 XX%，分支 XX%

下一步：
  - [下一个 pending 任务 ID 和描述]
  - [若所有任务 passing] → 运行 sdd-task-review 进行合规性检查
```

**一个会话只完成一个任务。** 多任务自动化由外部循环脚本处理（如适用）。

若所有任务均为 `passing`，输出：
> 所有 AR 任务已完成 — 下一步进入合规性检查（sdd-task-review）。

---

## 调试规范（On Error）

遇到编译错误或测试失败时，**不得猜测式修改**：

1. 收集完整错误信息（错误消息、行号、调用栈）
2. 复现问题（确认是稳定失败还是偶发）
3. 对照 design.md 检查接口合约和算法逻辑
4. 进行单一针对性修改，再运行测试
5. 3 次尝试仍失败 → 通过 AskUserQuestion 向用户上报

---

## 关键规则

- **一个会话只完成一个任务** — 不要在一个会话中完成多个任务
- **严格按 design.md 实现** — 不得自行改变接口签名或算法
- **先测试后实现** — TDD Red-Green-Refactor 顺序不可颠倒
- **质量门禁是硬性要求** — 不得以任何理由跳过
- **发现 design.md 有歧义 → 停止，问用户** — 不得自行猜测；若设计本身有误，通知用户执行 `/sdd-design` 返工
- **发现 srs.md 验收标准不可测/需求有误 → 通过 AskUserQuestion 上报，用户确认后执行 `/sdd-req` 返工**

## 开发中途返工流程

当在开发过程中发现问题需要返回上游阶段时，按以下规则处理：

### 情况 A：发现代码实现有问题

无需返工，在当前 TDD 循环中直接修复：
- 测试失败 → 修改实现 → 重新运行测试（Step 3 循环内解决）
- 失败超过 3 次 → AskUserQuestion 上报用户

### 情况 B：发现 design.md 有问题（设计有误，不只是歧义）

1. **停止当前任务**：将任务状态保持为 `in_progress`（不标记 passing）
2. **通知用户**：明确说明发现了什么设计问题（接口错误/逻辑错误/遗漏场景等）
3. **AskUserQuestion 确认**：选项为"确认返工到设计阶段 / 忽略，自行处理 / 跳过当前任务 / 其他（自行补充）"。用户也可在对话中直接输入自定义内容，Agent 正常接受。
4. **设计修改完成后**：tasks.md 中受影响的任务重置为 `pending`，重新开始 TDD 循环
5. **开始新会话**：设计修改会引入大量新上下文，建议新开会话执行 `/sdd-dev` 继续开发

> **注意**：`/sdd-design` 即使 design.md 已存在也可执行，会进入"修改现有设计"模式。

### 情况 C：发现 srs.md 需求描述有问题

1. **停止当前任务**：将任务状态保持为 `in_progress`
2. **通知用户**：说明需求哪里有问题（描述不清/逻辑矛盾/遗漏约束等）
3. **AskUserQuestion 确认**：选项为"确认返工到需求阶段 / 忽略，自行处理 / 跳过当前任务 / 其他（自行补充）"。用户也可在对话中直接输入自定义内容，Agent 正常接受。
4. **需求和设计均需更新**：srs.md 修改后，design.md 大概率也需要重新审视（由 sdd-design 处理）
5. **影响的任务重置为 `pending`**，重新开始开发流程

### 返工后状态重置原则

| 返回到 | 需要重置的内容 |
|--------|--------------|
| design 阶段 | 受影响任务 → `pending`；清除 review/ST 记录 |
| requirements 阶段 | design.md → 删除或标注待修改；所有任务 → `pending`；清除 review/ST 记录 |

---

## 红旗警告

| 这种想法 | 正确做法 |
|---------|---------|
| "这个很简单，直接写实现" | 先写测试（Red 阶段）|
| "design.md 有点不清楚，我来补充一下" | 停止，通知用户，执行 /sdd-design 修改后再继续 |
| "需求描述有点问题，先跳过" | 停止，通知用户，执行 /sdd-req 修改后再继续 |
| "覆盖率差一点，应该没问题" | 覆盖率是硬性门禁 |
| "先完成这个任务再说下一个" | 一个会话只做一个任务 |
| "test 写了太多，我少写几个" | 测试数量由边界条件矩阵决定 |
| "这次修改同时做了 T002 和 T003" | 任务拆分是有意义的，一次只做一个 |

## 集成说明

**调用方：** sdd-router（design.md 存在，tasks.md 有 pending 任务时）
**链接到：** sdd-task-review（所有任务 passing 后，由 sdd-router 路由）
**读取：** `specs/changes/ARxxx-topic/design.md`、`specs/changes/ARxxx-topic/srs.md`、`specs/changes/ARxxx-topic/tasks.md`、`AGENTS.md`、`include/`、`src/`
**产出：** 修改后的源文件和测试文件；更新后的 `tasks.md`
