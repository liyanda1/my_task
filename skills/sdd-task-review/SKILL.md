---
name: sdd-task-review
description: "Use when all tasks in tasks.md are passing - run spec and design compliance review before ST acceptance testing"
---

# SDD 规范性 / 合规性检查 — 代码审查

在所有任务完成、进入 ST 之前，运行一次全面的合规性检查，验证代码实现与 srs.md、design.md 的符合程度。

**核心原则：** 审查运行在独立子 Agent 中；主 Agent 只传递文件路径，不读取文件内容。

**可选：多模型审查。** 若 `opencode.json` 中配置了 `review.models`（多个模型），则多模型并行审查，任一模型 FAIL 则整体 FAIL；未配置则使用当前主模型单模型审查。

<HARD-GATE>
任何审查项 FAIL 时，必须先修复再继续 ST。不得跳过审查，不得对「简单」AR 豁免。
</HARD-GATE>

## Checklist

你必须为以下每个步骤创建 TodoWrite 任务，并按顺序完成：

1. **收集路径参数** — 收集所有相关文件路径
2. **检查多模型配置** — 读取 opencode.json，判断单模型 or 多模型
3. **派发子 Agent** — 使用内置审查提示模板，填充路径参数启动审查 Agent（单模型 1 个 / 多模型 N 个并行）
4. **解析审查结果** — 单模型直接判定；多模型汇总，任一 NO 即 FAIL
5. **修复 + 重审**（如 FAIL）— 修复问题，重新派发子 Agent
6. **记录审查结果** — 在 tasks.md 中记录
7. **移交 ST 阶段** — 调用 `sdd-router:sdd-task-st`

**终态是调用 sdd-task-st。**

---

## Step 1：收集路径参数

收集以下路径（不读取文件内容，只收集路径 — **`tasks_file` 除外**，需读取其进度记录获取 base_sha）：

| 参数 | 路径 | 说明 |
|------|------|------|
| `ar_dir` | `specs/changes/ARxxx-topic/` | AR 工作目录 |
| `srs_file` | `specs/changes/ARxxx-topic/srs.md` | 需求设计说明书 |
| `design_file` | `specs/changes/ARxxx-topic/design.md` | AR 详细设计文档 |
| `tasks_file` | `specs/changes/ARxxx-topic/tasks.md` | 任务状态文件 |
| `spec_file` | `specs/component-detail-design/组件_spec.md` | 组件详细设计 |
| `changed_headers` | `include/xxx.h` 等 | 本次 AR 修改的头文件列表 |
| `changed_sources` | `src/xxx.cpp` 等 | 本次 AR 修改的源文件列表 |
| `changed_tests` | `tests/xxx_test.cpp` 等 | 本次 AR 新增/修改的测试文件列表 |
| `base_sha` | `git rev-parse HEAD~N` | AR 开始前的 git SHA（用于 diff）|

获取 base_sha（**优先 tasks.md，git log 兜底**）：
1. 读取 `tasks_file`（tasks.md）的「进度记录」节，找到第一条记录中的 commit SHA → 即为 base_sha
2. 若 tasks.md 中无 commit 记录，则通过 `git log --oneline -20` 查找 AR 开始前的 SHA 作为兜底

---

## Step 2：检查多模型配置

读取工程根目录的 `opencode.json`，检查是否存在 `review.models` 配置：

```json
{
  "review": {
    "models": [
      { "id": "primary", "name": "claude-sonnet-4-20250514" },
      { "id": "secondary", "name": "gpt-4o" }
    ]
  }
}
```

**判断分支：**

| 条件 | 模式 | 后续行为 |
|------|------|---------|
| `review.models` 存在且长度 ≥ 2 | **多模型审查** | Step 3 为每个模型派发独立子 Agent，Step 4 汇总多模型结论 |
| `review.models` 不存在或长度 < 2 | **单模型审查** | Step 3 派发 1 个子 Agent（使用当前主模型），Step 4 直接判定 |

将判断结果存为变量：
- `multi_model = true/false`
- `review_models = [...]`（多模型时为配置列表，单模型时为 `[{ id: "default", name: "当前主模型" }]`）

---

## Step 3：派发子 Agent

根据 Step 2 的判断结果，选择派发方式。

### 单模型模式（`multi_model = false`）

派发 **1 个**子 Agent，使用当前主模型：

```
Agent(
  description = "AR [ARxxx] 合规性审查",
  prompt = """
你是一名代码合规性审查专家，请按以下规则审查。

== 审查目标文件（路径）==
- srs.md: {srs_file}
- design.md: {design_file}
- 修改的头文件: {changed_headers}
- 修改的源文件: {changed_sources}
- 修改的测试文件: {changed_tests}
- 组件详设: {spec_file}

== 使用工具读取上述文件内容，然后执行以下所有审查维度 ==

## 审查维度 S — 需求符合性（Spec Compliance）

| ID | 审查项 | 判断标准 |
|----|-------|---------|
| S1 | srs.md 中所有功能需求均有对应测试 | 每个 §3.x 需求的验收标准（Given/When/Then）都有对应的测试函数 |
| S2 | 测试验证行为，而不是实现细节 | 测试断言基于函数输入/输出，不直接访问私有成员或内部状态（除非设计明确要求）|
| S3 | 无未文档化的副作用 | 实现代码的行为与 srs.md 描述的一致，没有额外改动未提及的系统状态 |
| S4 | 边界条件覆盖 | design.md 边界条件矩阵（§5）中的每一行都有对应测试 |
| S5 | 错误处理覆盖 | design.md 错误处理表（§6）中的每种错误类型都有对应测试 |

## 审查维度 D — 设计符合性（Design Compliance）

| ID | 审查项 | 判断标准 |
|----|-------|---------|
| D1 | 接口签名符合设计 | `include/` 中的函数签名与 design.md §3 的接口设计完全一致（名称、参数类型、返回类型）|
| D2 | 算法逻辑符合设计 | 核心实现逻辑与 design.md §4 的伪代码/流程图一致，关键控制流不偏离设计 |
| D3 | 模块影响范围符合设计 | 修改的文件集合与 design.md §2 的「模块影响分析」表一致，无意外修改其他文件 |
| D4 | 无未授权的设计偏离 | 所有与 design.md 的偏离必须有代码注释记录，说明原因（自适应修改是允许的，但必须有记录）|

## 审查维度 C — 组件规范符合性（Component Compliance）

| ID | 审查项 | 判断标准 |
|----|-------|---------|
| C1 | 不破坏现有对外接口 | `include/` 中已有的公共接口签名未被修改（新增接口不算破坏）|
| C2 | 符合组件架构原则 | 代码组织方式与组件详设（spec.md）的架构原则一致（如分层约束、模块边界）|
| C3 | 代码风格符合规范 | 命名规范、注释风格符合 AGENTS.md 的要求（如有）|

## 输出格式

请以下面的格式输出审查结论：

```markdown
## 审查结论

**总体判断：** PASS / FAIL

### S — 需求符合性
| S1 | YES/NO | [说明] |
| S2 | YES/NO | [说明] |
| S3 | YES/NO | [说明] |
| S4 | YES/NO | [说明] |
| S5 | YES/NO | [说明] |

### D — 设计符合性
| D1 | YES/NO | [说明] |
| D2 | YES/NO | [说明] |
| D3 | YES/NO | [说明] |
| D4 | YES/NO | [说明] |

### C — 组件规范符合性
| C1 | YES/NO | [说明] |
| C2 | YES/NO | [说明] |
| C3 | YES/NO | [说明] |

### 问题列表（仅 NO 项）
| 严重性 | 维度 | 问题描述 | 修复建议 |
|-------|------|---------|---------|
| Critical/Important/Minor | Sxx/Dxx/Cxx | [描述] | [建议] |
```
  """
)
```

### 多模型模式（`multi_model = true`）

为 `review_models` 中的**每个模型**分别启动一个独立审查子 Agent，所有子 Agent **并行执行**。

```
Agent(
  description = "AR [ARxxx] 合规性审查 — {model_id} ({model_name})",
  model = "{model_name}",
  prompt = """
你是一名代码合规性审查专家，当前审查模型为 {model_id}（{model_name}）。
请按以下规则独立审查，给出你的专业判断。

== 审查目标文件（路径）==
- srs.md: {srs_file}
- design.md: {design_file}
- 修改的头文件: {changed_headers}
- 修改的源文件: {changed_sources}
- 修改的测试文件: {changed_tests}
- 组件详设: {spec_file}

== 使用工具读取上述文件内容，然后执行以下所有审查维度 ==

[审查维度 S/D/C 的内容与单模型模式完全一致，此处省略]

## 输出格式

请以下面的格式输出审查结论（注意在标题中标注你的模型标识）：

```markdown
## 审查结论 [{model_id}]

**审查模型：** {model_name}
**总体判断：** PASS / FAIL

### S — 需求符合性
| S1 | YES/NO | [说明] |
...

### D — 设计符合性
| D1 | YES/NO | [说明] |
...

### C — 组件规范符合性
| C1 | YES/NO | [说明] |
...

### 问题列表（仅 NO 项）
| 严重性 | 维度 | 问题描述 | 修复建议 |
|-------|------|---------|---------|
```
  """
)
```

**并行策略：** 所有模型的子 Agent 同时派发，不串行等待；每个子 Agent 在独立上下文中读取文件、独立判断。

---

## Step 4：解析审查结果

根据 Step 2 的模式，选择解析方式。

### 单模型模式（`multi_model = false`）

直接读取子 Agent 的输出，判定 PASS / FAIL：

**PASS（所有 S1-S5、D1-D4、C1-C3 均为 YES）：**
1. 进入 Step 6（记录审查结果）

**FAIL（任何维度为 NO）：**
1. 读取问题列表
2. 对 Critical / Important 问题，进入 Step 5（修复循环）
3. 对 Minor 问题，可选择立即修复或记录为待办（通过 AskUserQuestion 与用户确认）

### 多模型模式（`multi_model = true`）

收集所有子 Agent 的输出，按以下规则汇总：

#### 4a. 逐项合并

对每个审查项（S1-S5、D1-D4、C1-C3），比较所有模型的结论：

| 合并规则 | 说明 |
|---------|------|
| 所有模型均为 YES → **YES** | 无异议，通过 |
| 任一模型为 NO → **NO** | 保守策略：一票否决 |
| 模型结论有分歧 → **NO + 分歧标注** | 标注哪些模型判 YES、哪些判 NO |

#### 4b. 生成汇总报告

```markdown
## 多模型审查汇总报告

**AR：** ARxxx-topic
**审查时间：** YYYY-MM-DD
**参与模型：** N 个

---

### 模型审查结论

| 模型 | 模型名称 | 总体判断 |
|------|---------|---------|
| primary | xxx | PASS / FAIL |
| secondary | xxx | PASS / FAIL |

---

### 汇总结论

| 维度 | 审查项 | 汇总结果 | 分歧说明 |
|------|--------|---------|---------|
| S | S1 | YES/NO | [如有分歧，列出各模型结论] |

### 问题列表（所有 NO 项 + 严重性）

| 严重性 | 维度 | 审查项 | 判定 NO 的模型 | 问题描述 | 修复建议 |
|-------|------|--------|-------------|---------|---------|

---

### 总体判断

**判断：PASS / FAIL**

**PASS 条件：** 所有审查项汇总结果均为 YES。
**FAIL 条件：** 任一审查项汇总结果为 NO（任一模型判 NO 即触发）。
```

#### 4c. 判定后续流程

**PASS（所有审查项汇总均为 YES）：** 进入 Step 6

**FAIL（任一审查项汇总为 NO）：**
1. 读取问题列表
2. 对 Critical / Important 问题，进入 Step 5
3. 对 Minor 问题，通过 AskUserQuestion 与用户确认

---

## Step 5：修复 + 重审（最多 3 轮）

### 修复循环

1. 按问题列表，逐一修复 Critical 和 Important 问题：
   - 修复代码偏离 design.md 的问题（D 维度）→ 按设计修改实现
   - 修复测试覆盖缺失（S 维度）→ 补写测试用例
   - 修复规范违规（C 维度）→ 按规范调整代码
2. 如果修复需要修改 design.md（发现设计有误）→ 通过 AskUserQuestion 报告给用户，等待确认后再修复
3. 修复完成后重新运行测试，确认 Green
4. 按 Step 2 的模式重新派发子 Agent（多模型时派发所有模型，单模型时派发 1 个），**审查全部维度**
5. 最多 3 轮修复 + 重审

**超过 3 轮仍有 FAIL：**
通过 AskUserQuestion 向用户上报，列出：
- 失败的审查项
- 已尝试的修复
- 请用户决定：强制通过 / 修改设计 / 调整需求

---

## Step 6：记录审查结果

在 `specs/changes/ARxxx-topic/tasks.md` 中的「进度记录」节追加：

```markdown
### YYYY-MM-DD 审查记录

- 审查结果：PASS（第 N 轮）
- 审查模式：单模型 / 多模型
- 参与模型：[模型名称列表]
- S 维度：全部通过
- D 维度：全部通过
- C 维度：全部通过
- 修复的问题：[如有，列出 D2、S4 等已修复项]
```

---

## Step 7：移交 ST 阶段

审查 PASS 后：

1. 输出审查完成摘要：
   - AR 编号与主题
   - 审查轮次
   - 修复的问题数量
   - 代码质量总评

2. **必须调用：** 调用 `sdd-router:sdd-task-st` 开始 ST 验收测试

---

## 严重性定义

| 严重性 | 定义 | 是否阻塞 |
|-------|------|---------|
| Critical | 接口签名错误、需求未实现、破坏现有接口 | 是，必须修复 |
| Important | 测试覆盖不足、算法偏离、代码规范违规 | 是，修复后可进 ST |
| Minor | 注释缺失、命名不理想、非必要重复 | 否，可记录后处理 |

## 反模式警告

| 反模式 | 正确做法 |
|-------|---------|
| 主 Agent 自己读文件做审查 | 必须派发子 Agent，独立上下文读取文件 |
| 跳过「简单」AR 的审查 | 每个 AR 必须完整审查 |
| 把多个问题合并为一个发现 | 每个问题单独列出 |
| "代码看起来对" | PASS 必须有具体的 YES 证据 |
| 修改 srs.md / design.md 来规避问题 | 先问用户，经批准才能修改 |
| 多模型时只重审修复的维度 | 重审必须全维度（不同模型可能发现新问题）|

## 集成说明

**调用方：** sdd-router（所有任务 passing，review 未完成时）
**链接到：** sdd-task-st（Step 7，审查 PASS 后）
**派发：** 审查子 Agent（独立上下文）；多模型时并行派发多个，单模型时派发 1 个
**模型配置：** 从 `opencode.json` 的 `review.models` 读取（可选，未配置则单模型）
**读取（仅路径）：** srs.md、design.md、tasks.md、组件详设、修改的代码文件
**产出：** 更新后的 tasks.md（含审查记录）；多模型时含汇总审查报告
