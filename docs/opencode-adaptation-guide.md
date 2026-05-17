# 增量修改指南

> 本文档记录 SDD 流程的增量修改内容，用于在公司内网环境中按图索骥地同步修改。

---

## 第一部分：设计阶段新增"刷新组件详设"步骤

> **背景**：设计阶段完成（design.md 确认）后、进入编码阶段前，需要将本次 AR 引入的接口/架构变化同步回组件整体设计文档（`specs/component-detail-design/组件_spec.md`），避免 AR 实现与组件详设脱节。
>
> **目标文件**：`skills/sdd-task-design/SKILL.md`
>
> **修改数量**：4 处，全部在同一个文件内

---

## 修改 1：Checklist 步骤数 7→8

**找到**（`## Checklist` 节末尾）：

```
6. **更新 tasks.md** — 确认任务分解与设计一致
7. **移交开发阶段** — 调用 `sdd-router:sdd-task-develop`

**终态是调用 sdd-task-develop。** 不要调用其他 skill。
```

**替换为**：

```
6. **更新 tasks.md** — 确认任务分解与设计一致
7. **刷新组件详细设计** — 分析 AR 对组件详设的影响，按需更新组件_spec.md
8. **移交开发阶段** — 调用 `sdd-router:sdd-task-develop`

**终态是调用 sdd-task-develop。** 不要调用其他 skill。
```

---

## 修改 2：在 Step 6 之后插入 Step 7 新增整节

**找到**（Step 6 正文末尾 + 原 Step 7 标题）：

```
如果 tasks.md 的任务分解需要调整，更新 tasks.md（可增加任务，调整描述，但不改变已有 passing 任务）。

---

## Step 7：移交开发阶段
```

**替换为**：

```
如果 tasks.md 的任务分解需要调整，更新 tasks.md（可增加任务，调整描述，但不改变已有 passing 任务）。

---

## Step 7：刷新组件详细设计

> AR 的实现可能引入新接口、新数据结构或架构调整，这些变化需要同步反映到组件整体设计文档中，以保持文档与实现的一致性。

### 7a. 影响分析

对比 design.md 与 `specs/component-detail-design/` 下的组件详设文件，识别本次 AR 是否导致以下变化：

| 变化类型 | 判断依据 | 需更新组件详设？ |
|---------|---------|--------------|
| 新增对外接口 | design.md §3 有新增的公开函数/类 | **是** |
| 接口签名变更 | design.md §3 修改了已有接口的参数或返回值 | **是** |
| 新增数据结构/枚举 | design.md 引入了新的公开数据类型 | **是** |
| 模块新增或重组 | design.md §2 的模块影响分析涉及新文件或模块拆分 | **是** |
| 架构约束或原则变化 | 本 AR 建立了新的设计模式或约束 | **是** |
| 仅修改私有实现 | 无公开接口或结构变化，仅修改 .cpp 内部逻辑 | **否** |
| 仅修改测试代码 | 不涉及接口和结构 | **否** |

### 7b. 执行更新（如有变化）

若 7a 判断需要更新，**将 design.md 中已确认的设计决策同步到组件详设**：

- 在组件详设对应章节追加或修改接口描述、数据类型、模块说明
- 保持组件详设的原有结构和风格，勿重写无关内容
- 在变更处标注 AR 来源，例如：`<!-- 引入自 AR-2026-0417：add-priority-support -->`
- 若组件详设不存在对应章节，可新增章节并说明来源

**写入格式遵循组件详设现有风格**（有代码块用代码块，有表格用表格）。

### 7c. 无需更新时

若本次 AR 仅修改内部实现，向用户说明：

```
组件详细设计无需更新。
本次 AR 修改范围：[一句话描述]
不影响组件对外接口和整体架构。
```

### 7d. 用户确认

将更新内容（或"无需更新"结论）呈现给用户确认，再进入 Step 8。

---

## Step 8：移交开发阶段
```

---

## 修改 3：Step 8 正文（原 Step 7 扩充移交摘要）

**找到**（紧接在 `## Step 8：移交开发阶段` 标题之后）：

```
design.md 和更新后的 tasks.md 保存完成后：

1. 输出移交摘要：
   - AR 编号与主题
   - 选定的设计方案
   - 受影响的文件清单
   - 任务数量与开发顺序建议
   - 注意事项（特殊约束、已知风险）
```

**替换为**：

```
design.md、tasks.md 和组件详设（如有更新）保存完成后：

1. 输出移交摘要：
   - AR 编号与主题
   - 选定的设计方案
   - 受影响的文件清单
   - 任务数量与开发顺序建议
   - 组件详设更新情况（已更新哪些章节 / 无需更新及原因）
   - 注意事项（特殊约束、已知风险）
```

---

## 修改 4：集成说明（文件末尾）

**找到**（`## 集成说明` 节）：

```
**调用方：** sdd-router（srs.md 存在，design.md 缺失时）
**链接到：** sdd-task-develop（Step 7，设计确认后）
**产出：** `specs/changes/ARxxx-topic/design.md`（更新 `tasks.md`）
**读取：** `specs/component-detail-design/组件_spec.md`、`specs/changes/ARxxx-topic/srs.md`、`include/`、`src/`
```

**替换为**：

```
**调用方：** sdd-router（srs.md 存在，design.md 缺失时）
**链接到：** sdd-task-develop（Step 8，设计确认后）
**产出：** `specs/changes/ARxxx-topic/design.md`（更新 `tasks.md`）；如有接口/架构变化，同步更新 `specs/component-detail-design/组件_spec.md`
**读取：** `specs/component-detail-design/组件_spec.md`、`specs/changes/ARxxx-topic/srs.md`、`include/`、`src/`
```

---

## 验证

修改完成后执行：

```bash
grep -n "刷新组件详细设计" skills/sdd-task-design/SKILL.md
grep -n "## Step 7：刷新" skills/sdd-task-design/SKILL.md
grep -n "## Step 8：移交" skills/sdd-task-design/SKILL.md
grep -n "Step 8，设计确认后" skills/sdd-task-design/SKILL.md
```

4 条命令均有输出则修改正确。

---

## 第二部分：审查阶段新增"可选多模型审核"机制

> **背景**：原有审查阶段只使用单一模型做合规性审查，不同模型对同一代码可能有不同判断。引入可选的多模型并行审查，配置后自动启用。
>
> **目标文件**：`skills/sdd-task-review/SKILL.md`
>
> **核心思路**：整个文件改为"单模型/多模型"双分支。`opencode.json` 配置了 `review.models`（≥2 个模型）则多模型，否则走原流程。
>
> **建议**：由于改动涉及 8 处且 Step 3/Step 4 整节重写，建议直接从本工程复制 `skills/sdd-task-review/SKILL.md` 整文件替换。以下列出关键改动点供参考审查。

---

### 修改 R1：核心原则

在原文 `**核心原则：**` 之后，追加一行：

```
**可选：多模型审查。** 若 `opencode.json` 中配置了 `review.models`（多个模型），则多模型并行审查，任一模型 FAIL 则整体 FAIL；未配置则使用当前主模型单模型审查。
```

---

### 修改 R2：Checklist

原 7 步改为 8 步，新增 Step 1.5，Step 3/4/5 描述更新：

```
1. **收集路径参数** — 收集所有相关文件路径
1.5. **检查多模型配置** — 读取 opencode.json，判断单模型 or 多模型
2. **构建子 Agent 提示** — 读取审查提示模板，填充路径参数
3. **派发子 Agent** — 启动审查 Agent（单模型 1 个 / 多模型 N 个并行）
4. **解析审查结果** — 单模型直接判定；多模型汇总，任一 NO 即 FAIL
5. **修复 + 重审**（如 FAIL）— 修复问题，重新派发子 Agent
6. **记录审查结果** — 在 tasks.md 中记录
7. **移交 ST 阶段** — 调用 `sdd-router:sdd-task-st`
```

---

### 修改 R3：新增 Step 1.5（在 Step 1 和 Step 2 之间插入）

插入以下整节，读取 `opencode.json` 判断模式：

```
## Step 1.5：检查多模型配置

读取工程根目录的 `opencode.json`，检查是否存在 `review.models` 配置：

{
  "review": {
    "models": [
      { "id": "primary", "name": "claude-sonnet-4-20250514" },
      { "id": "secondary", "name": "gpt-4o" }
    ]
  }
}

判断分支：
- review.models 存在且长度 >= 2 → multi_model = true
- review.models 不存在或长度 < 2 → multi_model = false（单模型模式）
```

---

### 修改 R4-R6：Step 2/3/4 整节重写

这三节改为双分支结构：

- **Step 2**：多模型时额外填充 `{model_id}` / `{model_name}`
- **Step 3**：分"单模型模式"和"多模型模式"两个子节，多模型时并行派发多个 Agent 并在 prompt 中标注模型标识
- **Step 4**：分"单模型模式"（直接判定）和"多模型模式"（逐项合并 + 汇总报告），多模型报告包含各模型独立结论和分歧标注

> **建议直接复制本工程 `skills/sdd-task-review/SKILL.md` 的 Step 2/3/4 完整内容。**

---

### 修改 R7：Step 5 重审逻辑

将原来的：
```
4. 重新派发子 Agent（只审查修改过的维度）
```

替换为：
```
4. 按 Step 1.5 的模式重新派发子 Agent（多模型时派发所有模型，单模型时派发 1 个），审查全部维度
```

---

### 修改 R8：Step 6 / 反模式 / 集成说明

**Step 6**：审查记录增加"审查模式"和"参与模型"两行。

**反模式**：追加一条——`多模型时只重审修复的维度 → 重审必须全维度`。

**集成说明**：更新为——`模型配置：从 opencode.json 的 review.models 读取（可选，未配置则单模型）`。

---

### opencode.json 配置示例（在目标组件工程中添加）

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

不配置此节 = 原流程不变（单模型审查）。

---

### 验证

```bash
grep -n "multi_model" skills/sdd-task-review/SKILL.md
grep -n "Step 1.5" skills/sdd-task-review/SKILL.md
grep -n "opencode.json" skills/sdd-task-review/SKILL.md
grep -n "单模型模式" skills/sdd-task-review/SKILL.md
grep -n "多模型模式" skills/sdd-task-review/SKILL.md
```

5 条命令均有输出则修改正确。

---

## 第三部分：新增"已归档 AR 返工"入口

> **背景**：AR 完成并归档到 `specs/archive/` 后，如果后续发现设计或代码存在问题需要修改，目前流程没有回退入口。
>
> **新增文件**：`.opencode/commands/sdd-reactivate.md`
>
> **修改文件**：`skills/sdd-router/SKILL.md`（1 处）
>
> **修改数量**：共 2 处（1 个新文件 + 1 处修改）

---

### 新增：`.opencode/commands/sdd-reactivate.md`

在 `.opencode/commands/` 目录下创建新文件 `sdd-reactivate.md`，内容如下：

```markdown
---
description: "重新激活已归档的 AR，从指定阶段开始返工"
---

你是 SDD 流程的 AR 重新激活助手。

## 输入解析

用户输入格式：/sdd-reactivate <AR编号> <返工说明>

- AR 编号：specs/archive/ 下的目录名，如 AR123-fix-bug（必填）
- 返工说明：一句话描述要改什么（必填）

## 执行步骤

### 1. 验证 AR 存在

检查 specs/archive/ 下是否存在用户指定的 AR 目录。

### 2. 移动目录

mv specs/archive/ARxxx-topic/ specs/changes/ARxxx-topic/

### 3. 解析返工意图，确定重置阶段

| 返工说明关键词 | 重置阶段 | 需要删除/重置的文件 |
|--------------|---------|-------------------|
| 涉及需求描述、功能变更 | requirements | 重置 tasks.md 中相关任务为 pending |
| 涉及设计文档、接口变更 | design | 删除 design.md；重置 tasks.md 中相关任务为 pending |
| 仅涉及代码实现、bug 修复 | develop | 重置 tasks.md 中相关任务为 pending |
| 涉及测试场景、ST 遗漏 | st | 清除 tasks.md 中的 review 和 ST 通过记录 |
| 无法判断 | 询问用户 | — |

### 4. 执行重置

- requirements/design 阶段：删除 design.md（如需）；tasks.md 任务重置为 pending；清除 review/ST 记录
- develop 阶段：tasks.md 相关任务重置为 pending；清除 review/ST 记录；保留 srs.md 和 design.md
- st 阶段：仅清除 review/ST 记录

### 5. 路由到对应阶段

调用对应的阶段 skill（requirements/design/develop/st）。

注意：涉及多阶段修改时，以最早阶段为准（如 design），后续阶段在流程中自然触发。
```

> **完整内容请直接从本工程复制 `.opencode/commands/sdd-reactivate.md`。**

---

### 修改 M1：router 末尾增加归档 AR 返工提示

**目标文件**：`skills/sdd-router/SKILL.md`

**找到**（检测规则表末尾，`## 目录结构参考` 之前）：

```markdown
   | ST 已通过，AR 目录在 `specs/changes/` 下 | 提示用户：归档 AR 到 `specs/archive/ARxxx-topic/`，或开启新 AR |

## 目录结构参考
```

**替换为**：

```markdown
   | ST 已通过，AR 目录在 `specs/changes/` 下 | 提示用户：归档 AR 到 `specs/archive/ARxxx-topic/`，或使用 `/sdd-reactivate` 对已归档 AR 进行返工 |

## 归档 AR 返工

当 `specs/changes/` 为空但 `specs/archive/` 下有已归档 AR 时：

1. 开启新 AR — 直接描述新需求，将启动需求澄清阶段
2. 返工已归档 AR — 使用 /sdd-reactivate <AR编号> <返工说明>

## 目录结构参考
```

---

### 验证

```bash
# 验证新 command 文件存在
ls .opencode/commands/sdd-reactivate.md

# 验证 router 中有返工提示
grep -n "sdd-reactivate" skills/sdd-router/SKILL.md
grep -n "归档 AR 返工" skills/sdd-router/SKILL.md
```

3 条命令均有输出则修改正确。

---

## 第四部分：新增工程质量测试集（eval.json）

> **背景**：当前工程没有测试用例，需要一个轻量级测试集来验证 SDD 流程各 skill/command 的核心行为是否符合预期。
>
> **新增文件**：`tests/eval.json`
>
> **测试范围**：不端到端执行，覆盖每个组件的基本功能验证

---

### 测试集概览

| 类别 | 数量 | 覆盖内容 |
|------|------|---------|
| router | 8 个 | 空工程、各阶段状态检测、归档提示、reactivation 提示 |
| sdd-task-requirements | 3 个 | 领域知识前置、验收标准完整性、HARD-GATE |
| sdd-task-design | 3 个 | 基于 srs.md 生成、组件详设刷新（不需要/需要） |
| sdd-task-develop | 4 个 | 单任务约束、TDD 顺序、依赖检查、质量门禁 |
| sdd-task-review | 5 个 | 子 Agent 审查、三维完整性、单/多模型模式、FAIL 修复 |
| sdd-task-st | 3 个 | 黑盒验证、Go/No-Go 条件、归档内容 |
| reactivate | 6 个 | 目录移动、阶段路由（develop/design/requirements/st）、错误处理、多阶段取最早 |
| **合计** | **32 个** | |

---

### 使用方式

**方式一：手动验证**

选择测试用例，在 OpenCode 中模拟对应的目录状态，执行对应 command，验证行为是否符合 `expected`。

**方式二：逐类批量验证**

按类别分组执行：

```bash
# 验证 router（8 个用例）
# R001-R008：设置不同 specs/changes/ 和 specs/archive/ 目录状态，执行 /sdd，验证路由结果

# 验证 requirements（3 个用例）
# REQ001-REQ003：执行 /sdd-req，验证领域知识读取顺序、srs.md 格式、HARD-GATE

# 验证 design（3 个用例）
# DES001-DES003：执行 /sdd-design，验证 design.md 内容、组件详设刷新判断

# 验证 develop（4 个用例）
# DEV001-DEV004：执行 /sdd-dev，验证单任务、TDD 顺序、依赖、质量门禁

# 验证 review（5 个用例）
# REV001-REV005：执行 /sdd-review，验证子 Agent 派发、审查维度、单/多模型、FAIL 处理

# 验证 ST（3 个用例）
# ST001-ST003：执行 /sdd-st，验证就绪检查、Go/No-Go、归档内容

# 验证 reactivation（6 个用例）
# REACT001-REACT006：执行 /sdd-reactivate，验证目录移动、阶段重置、错误处理
```

---

### 新增：`tests/eval.json`

在 `tests/` 目录下创建 `eval.json`，完整内容请直接从本工程复制。

关键测试用例摘要：

| ID | 名称 | 验证要点 |
|----|------|---------|
| R001 | 空工程路由 | → requirements |
| R004 | pending 任务路由 | → develop |
| R005 | review 路由 | → review |
| R007 | 归档提示 | 提示归档或 reactivation |
| DEV001 | 单任务约束 | 一次只做一个任务 |
| REV003 | 单模型模式 | 无配置 → 1 个子 Agent |
| REV004 | 多模型模式 | 配置 2+ 模型 → 并行审查 |
| REACT003 | 设计返工 | 删 design.md → 路由 design |
| REACT006 | 多阶段返工 | design+develop → 以 design 为准 |

---

### 验证

```bash
# 验证测试集文件存在且为合法 JSON
cat tests/eval.json | python -m json.tool > /dev/null && echo "JSON 格式正确"

# 验证测试用例数量
python -c "import json; d=json.load(open('tests/eval.json')); print(f'测试用例总数: {len(d[\"test_cases\"])}')"

# 按类别统计
python -c "
import json
d = json.load(open('tests/eval.json'))
cats = {}
for t in d['test_cases']:
    cats[t['category']] = cats.get(t['category'], 0) + 1
for k, v in sorted(cats.items()):
    print(f'  {k}: {v}')
"
```
