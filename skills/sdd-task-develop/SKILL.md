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

1. **确认模式选择（Confirm Mode）** — 首次运行时询问用户确认粒度
2. **定向（Orient）** — 读取 tasks.md、design.md，选取当前任务
3. **启动（Bootstrap）** — 确认开发环境，读取组件规范，检测测试命令可用性
4. **TDD 循环** — 3a Red（子 Agent 写测试）→ 3b Green（主 Agent 写实现）→ 3c Refactor
5. **质量门禁** — 覆盖率验证（自动化或降级）
6. **持久化（Persist）** — 更新 tasks.md，提交代码
7. **结束会话** — 输出完成摘要

---

## Step 0：确认模式选择（新增）

在首次运行 sdd-task-develop 时（Step 1 之前），通过 AskUserQuestion 询问用户确认粒度：

**问题**：「TDD 开发流程中，你希望如何确认进度？」

| 选项 | 标签 | 说明 |
|------|------|------|
| 模式 1 | 全自动模式 | 自动走完所有 task，不管 TDD 失败或缺少编译命令，最后统一确认 |
| 模式 2 | 按 task 确认（推荐） | 每个 task 的 Red+Green+Refactor 完成后，确认一次再进入下一 task |
| 模式 3 | 按阶段确认 | 每个 task 的 Red、Green、Refactor 每个阶段都确认 |

- 默认推荐**模式 2**（按 task 确认）
- 用户选择后，记录到变量 `{confirm_mode}`：
  - `auto`：全自动模式
  - `per-task`：按 task 确认
  - `per-stage`：按阶段确认
- 不需要持久化到文件，单次会话有效

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
- `{confirm_mode}` — 用户选择的确认模式（`auto` / `per-task` / `per-stage`）

---

## Step 2：启动（Bootstrap）

### 2a. 开发环境检查

确认：
- 编译工具链可用（如 cmake / make / gcc / clang）
- 测试框架已安装（如 gtest/gmock）
- 如有 `init.sh` / `init.ps1`，且环境未就绪，执行一次

### 2b. 确认测试命令（关键：检测可用性）

确认以下命令可用（从 AGENTS.md 或 CMakeLists.txt 读取）：
- 编译命令
- 测试执行命令
- 覆盖率生成命令（如使用 gcov/lcov）

**记录这些命令，并判断可用性：**

1. **读取 AGENTS.md**（如存在）：提取测试编译命令和测试执行命令
2. **读取 CMakeLists.txt**（如存在）：提取测试目标名称
3. **判断**：
   - **有命令且可用** → 设置 `{test_available} = true`，走**自动化流程**
   - **无命令或不可用** → 设置 `{test_available} = false`，走**降级流程**

记录 `{test_available}` 和具体的编译/测试命令，后续 Step 3a/3b/4a 直接使用。

### 2c. 冒烟测试

运行现有测试，确认之前已通过的任务没有回归。任何失败 → **停止**，先修复再继续。

---

## Step 3：TDD 循环（3a Red → 3b Green → 3c Refactor）

严格按照 design.md 中的 `{design_section}` 实现，不得自行发明接口或逻辑。

### 3a. Red — 派发测试编写 Agent（独立子 Agent）

**主 Agent 行为**：准备上下文 + 派发子 Agent，不自己写测试。

#### 3a.1 收集测试编写上下文（主 Agent 做）

- `{design_section}`：design.md 对应节（§3 接口、§5 边界条件、§7 测试设计）
- `{srs_section}`：srs.md 对应功能需求的 Given/When/Then
- `{task}`：当前任务 ID 和描述
- `AGENTS.md`（如存在）：提取测试框架、命名规范
- `CMakeLists.txt`（如存在）：提取测试目标名称

#### 3a.2 派发 TDD-Test 子 Agent（主 Agent 做）

**子 Agent 职责**：
- 子 Agent **只写测试文件**，严格按 `{design_section}` + `{srs_section}`
- 子 Agent **不得写任何实现代码**（实现文件即使有 stub 也要删除或留空）
- 子 Agent 在测试写完后输出：修改的文件列表、测试函数清单

**派发方式**：使用 Agent 工具，内嵌以下 prompt 模板（不新建 `.opencode/agents/` 文件）：

```
Agent(
  description = "TDD-Red: 任务 [{task_id}] 编写测试",
  prompt = """
你是一名 TDD 测试工程师。请严格按照以下输入编写单元测试，**不得编写任何实现代码**。

== 任务信息 ==
- AR 编号：{ar_id}
- 任务 ID：{task_id}
- 任务描述：{task_description}

== 设计输入 ==
{design_section}

== 需求输入 ==
{srs_section}

== 测试规范 ==
- 测试框架：{test_framework}
- 测试文件命名：{test_file_naming}
- 测试函数命名：TEST(ClassName, DescribesWhat)
- 每个测试必须在注释中标注关联的需求（如 // Covers: srs.md §3.x 验收标准 N）
- 只写测试，**不要写任何实现代码**（include 头文件可以有，但不能有函数体实现）

== 你的输出 ==
1. 列出所有修改/新增的测试文件路径
2. 列出所有编写的测试函数及其对应的需求覆盖
3. 确认测试中没有任何实现代码
"""
)
```

#### 3a.3 根据 `{test_available}` 和 `{confirm_mode}` 决定后续行为

**自动化流程（有测试命令，`{test_available} = true`）**：

```
派发 TDD-Test Agent
  → Agent 写测试文件
  → 主 Agent 运行测试（编译+执行）
  → 确认 Red（失败）
  → 根据 {confirm_mode} 决定是否询问用户确认：
     - 模式 3（per-stage）：AskUserQuestion："Red 阶段完成，测试已写好。确认无误后进入 Green 阶段？"
     - 模式 1/2：自动进入 Step 3b
  → 进入 Step 3b
```

**降级流程（无测试命令，`{test_available} = false`）**：

```
派发 TDD-Test Agent
  → Agent 写测试文件
  → 主 Agent 根据 {confirm_mode} 决定行为：
     - 模式 1（auto）：提示用户"测试已写好，请手动验证"，但继续进入 Green
     - 模式 2/3（per-task/per-stage）：询问用户：
       "测试文件已写好，但无法自动编译运行。
        请你手动运行测试，确认测试失败（Red 状态）后回复「确认 Red」。
        如果你希望我尝试其他编译方式，也可以告诉我。"
  → 用户确认 Red 后（模式 2/3）或直接进入（模式 1）
  → 进入 Step 3b
```

### 3b. Green — 主 Agent 编写实现

收到 Step 3a 的输出后：

1. 读取 TDD-Test Agent 生成的测试文件，理解测试意图
2. 按 design.md `{design_section}` 写最少实现代码让测试通过
3. **自动化流程（`{test_available} = true`）**：
   - 运行测试确认 Green
   - 根据 `{confirm_mode}` 决定是否询问用户确认：
     - 模式 2/3：AskUserQuestion："Green 阶段完成，实现代码已写好。确认无误后进入 Refactor？"
     - 模式 1：自动进入 Step 3c
4. **降级流程（`{test_available} = false`）**：
   - 告知用户测试文件路径，请用户自行验证
   - 根据 `{confirm_mode}` 决定是否询问用户确认：
     - 模式 2/3：等待用户确认 Green
     - 模式 1：提示用户但继续进入 Refactor

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

根据 `{confirm_mode}` 决定是否询问用户确认：
- 模式 2/3：AskUserQuestion："Refactor 完成。确认后进入下一 task？"
- 模式 1：自动进入下一 task

---

## Step 4：质量门禁

### 4a. 测试覆盖率

**自动化流程（`{test_available} = true`）**：
- 运行覆盖率工具，检查当前任务涉及的代码
- 语句覆盖率 >= design.md §7.2 中指定的目标（无指定则 >= 80%）
- 分支覆盖率 >= design.md §7.2 中指定的目标（无指定则 >= 70%）
- 未达标时：
  - 识别未覆盖的行/分支
  - 检查是否是 design.md 中的边界条件矩阵（§5）没有写对应测试 → 补写测试
  - 不得通过注释掉代码或降低标准来通过覆盖率检查

**降级流程（`{test_available} = false`）**：
- 覆盖率验证延后，用户在验证 Green 时一并确认
- 代码规范自查仍由主 Agent 做

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
- 测试覆盖率：语句 XX%，分支 XX%（自动化流程）/ 未自动验证（降级流程）
- Red Agent：TDD-Test 子 Agent
- Green Agent：主 Agent
- 备注：[如有]
```

### 5b. 提交代码

```
git add [修改的文件]
git commit -m "feat(ARxxx): [任务描述简短标题]

- Implements: T002
- Related: srs.md §3.x
- Coverage: branch XX%, stmt XX% (自动化流程) / 未自动验证 (降级流程)"
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

覆盖率：语句 XX%，分支 XX%（自动化流程） / 未自动验证（降级流程）

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
- **Red/Green 分离** — Red（写测试）和 Green（写实现）由不同 Agent 执行，防止自我验证
- **质量门禁是硬性要求** — 不得以任何理由跳过
- **发现 design.md 有歧义 → 停止，问用户** — 不得自行猜测；若设计本身有误，通知用户执行 `/sdd-design` 返工
- **发现 srs.md 验收标准不可测/需求有误 → 通过 AskUserQuestion 上报，用户确认后执行 `/sdd-req` 返工**
- **测试命令不可用 → 进入降级流程** — 让用户手动验证 Red/Green

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
| "这个很简单，直接写实现" | 先写测试（Red 阶段，由 TDD-Test 子 Agent 执行）|
| "design.md 有点不清楚，我来补充一下" | 停止，通知用户，执行 /sdd-design 修改后再继续 |
| "需求描述有点问题，先跳过" | 停止，通知用户，执行 /sdd-req 修改后再继续 |
| "覆盖率差一点，应该没问题" | 覆盖率是硬性门禁 |
| "先完成这个任务再说下一个" | 一个会话只做一个任务 |
| "test 写了太多，我少写几个" | 测试数量由边界条件矩阵决定 |
| "这次修改同时做了 T002 和 T003" | 任务拆分是有意义的，一次只做一个 |
| "没有测试命令，我跳过 TDD" | 进入降级流程，让用户手动验证 |
| "Red 和 Green 都由我做，更高效" | Red/Green 分离是为了防止自我验证，必须遵守 |

## 集成说明

**调用方：** sdd-router（design.md 存在，tasks.md 有 pending 任务时）
**链接到：** sdd-task-review（所有任务 passing 后，由 sdd-router 路由）
**读取：** `specs/changes/ARxxx-topic/design.md`、`specs/changes/ARxxx-topic/srs.md`、`specs/changes/ARxxx-topic/tasks.md`、`AGENTS.md`、`include/`、`src/`
**产出：** 修改后的源文件和测试文件；更新后的 `tasks.md`

## 降级流程的边界条件

| 场景 | 行为 |
|------|------|
| AGENTS.md 不存在 | 进入降级流程 |
| AGENTS.md 存在但无测试编译命令 | 进入降级流程 |
| CMakeLists.txt 存在，能找到测试目标 | 自动化流程 |
| 用户确认 Red 后，Green 前，用户无法跑测试 | **AskUserQuestion**：提供选项：① 我手动跑，确认 Green 后再回复 / ② 请你（Agent）基于分析直接进入 Green（记录为「未自动验证」） / ③ 跳过当前任务，标记 in_progress |
| 用户拒绝手动运行测试 | 询问：是跳过该任务 / 记录为 in_progress 待后续处理 / 其他方案 |

> **设计原则**：降级流程的核心价值是"测试不由写实现的人验证"。如果用户也无法跑测试，至少有两次用户参与（Red 确认 + Green 确认），仍然大幅降低了自欺风险。完全跳过验证是最后兜底选项。
