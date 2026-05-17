---
name: sdd-task-st
description: "Use when review has passed - run ST acceptance testing for the AR, generate test cases, execute tests, and archive the AR on success"
---

# SDD ST 验收测试 — 系统测试执行与归档

在合规性检查通过后，执行 AR 级别的 ST 验收测试，验证所有需求的端到端正确性，并在通过后归档 AR。

**核心原则：** ST 测试基于 srs.md 的验收标准（黑盒视角），独立于实现细节；所有测试必须有执行记录；通过后归档 AR。

<HARD-GATE>
不得在任何 Critical/Major 缺陷未修复的情况下给出通过（Go）判定。不得跳过 ST 直接归档。
</HARD-GATE>

## Checklist

你必须为以下每个步骤创建 TodoWrite 任务，并按顺序完成：

1. **ST 就绪检查** — 确认前置条件满足
2. **生成 ST 测试用例** — 基于 srs.md 生成验收测试用例文档
3. **执行 ST 测试** — 运行自动化测试 + 手工/集成测试
4. **缺陷处理** — 分类、修复 Critical/Major 缺陷
5. **生成 ST 报告** — 记录测试结果
6. **Go/No-Go 决策** — 向用户呈现结果
7. **归档 AR** — 将 AR 目录从 changes/ 移至 archive/

---

## Step 1：ST 就绪检查

确认以下条件全部满足（任何条件不满足则停止）：

| 条件 | 检查方法 |
|------|---------|
| 所有任务 `status: passing` | 读取 tasks.md，所有任务行均为 `passing` |
| Review 已 PASS | tasks.md 中存在「Review 记录 — PASS」条目 |
| 编译成功，所有单元测试通过 | 运行编译命令 + 测试命令 |
| srs.md 存在且有完整的验收标准 | 每个 §3.x 功能需求都有 Given/When/Then |

就绪确认后，读取以下文件建立测试上下文：
- `specs/changes/ARxxx-topic/srs.md` — 提取所有功能需求和验收标准
- `specs/changes/ARxxx-topic/design.md` — 了解接口和错误处理
- `specs/component-detail-design/组件_spec.md` — 了解系统级集成约束

---

## Step 2：生成 ST 测试用例文档

基于 srs.md 的验收标准，生成 ST 测试用例文档。

**输出文件路径：** `specs/changes/ARxxx-topic/st-cases.md`

**测试用例生成规则：**
- 每个 srs.md §3.x 功能需求至少生成 1 个正常路径测试用例
- 每个验收标准（Given/When/Then）对应 1 个测试用例
- design.md 边界条件矩阵（§5）中的每行生成 1 个边界测试用例
- design.md 错误处理表（§6）中的每种错误生成 1 个异常测试用例

**st-cases.md 格式：**

```markdown
# [ARxxx] ST 验收测试用例

| 字段 | 内容 |
|------|------|
| AR 编号 | ARxxx |
| 关联 srs.md | ./srs.md |
| 生成日期 | YYYY-MM-DD |

## 测试用例列表

### ST-001：[测试名称]

**关联需求：** srs.md §3.x [需求名]
**测试类型：** 正常路径 / 边界条件 / 异常处理
**优先级：** High / Medium / Low

**前置条件：**
- [Given 条件]

**测试步骤：**
1. [操作步骤]

**期望结果：**
- [Then 结论]

**实际结果：** [待填写]

**状态：** PASS / FAIL / BLOCKED

---

### ST-002：[测试名称]
...

## 执行摘要

| 总计 | 通过 | 失败 | 阻塞 |
|------|------|------|------|
| X | X | X | X |
```

---

## Step 3：执行 ST 测试

### 3a. 自动化验收测试

对于每个 ST 用例：
1. 按测试步骤执行（通过直接调用接口/API 或集成测试框架）
2. 记录实际结果
3. 与期望结果对比，判断 PASS / FAIL
4. 在 st-cases.md 中填写「实际结果」和「状态」

**优先使用自动化测试：**
- 单元测试中已有的测试函数可直接复用（引用）
- 需要集成才能验证的场景，在 `tests/st/` 或 `tests/integration/` 中编写集成测试
- 无法自动化的测试（如需要特定硬件/外部系统），标记为 MANUAL，记录手工执行结果

### 3b. 覆盖率验证

运行测试并生成覆盖率报告，确认：
- 所有 ST 测试用例执行后，整体覆盖率不低于 design.md §7.2 的目标
- 无新增覆盖率回退

### 3c. 与现有功能的集成验证

运行完整的组件测试套件（包括其他模块的已有测试），确认：
- 本次 AR 未引入回归
- 修改的头文件未破坏其他模块（如有其他模块依赖）

记录：总测试数、通过数、失败数、执行时间。

---

## Step 4：缺陷处理

如果有 FAIL 的测试用例：

| 严重性 | 定义 | 处理方式 |
|-------|------|---------|
| Critical | 核心功能无法工作、接口 Crash、数据损坏 | 必须修复，重新执行全部 ST |
| Major | 主要功能偏离需求、NFR 未达标 | 必须修复，重新执行受影响的用例 |
| Minor | 非核心功能问题，有绕过方式 | 记录，与用户确认是否立即修复 |
| Cosmetic | 日志格式、注释错别字等 | 记录，延后修复 |

**修复循环（Critical / Major）：**
1. 在 tasks.md 中将对应任务恢复为 `in_progress`
2. 调用 `sdd-router:sdd-task-develop` 修复
3. 修复后重新执行受影响的 ST 测试用例（不需要跑全部）
4. 更新 st-cases.md 中的实际结果和状态

---

## Step 5：生成 ST 报告

所有测试执行完成后，在 `specs/changes/ARxxx-topic/st-cases.md` 末尾追加 ST 报告：

```markdown
## ST 执行报告

| 字段 | 内容 |
|------|------|
| 执行日期 | YYYY-MM-DD |
| 执行结果 | PASS / FAIL |
| 执行轮次 | 第 N 轮 |

### 需求覆盖矩阵

| 需求 ID | 需求描述 | 测试用例 | 结果 |
|--------|---------|---------|------|
| §3.1 | [需求名] | ST-001, ST-002 | PASS |
| §3.2 | [需求名] | ST-003 | PASS |

**需求覆盖率：** X / Y（100%）

### 测试执行汇总

| 类型 | 总计 | 通过 | 失败 | 阻塞 |
|------|------|------|------|------|
| 正常路径 | X | X | X | X |
| 边界条件 | X | X | X | X |
| 异常处理 | X | X | X | X |
| 回归测试 | X | X | X | X |
| **合计** | **X** | **X** | **X** | **X** |

### 遗留问题

| 严重性 | 描述 | 处理方式 |
|-------|------|---------|
| Minor | [描述] | 延后处理 |

### 结论

> Go / No-Go 及原因
```

---

## Step 6：Go / No-Go 决策

通过 AskUserQuestion 向用户呈现 ST 报告摘要和判断建议：

**Go 条件（全部满足）：**
- 所有需求覆盖率 100%
- 无 Critical / Major 未修复缺陷
- 所有单元测试通过，无回归
- NFR（如有）已验证达标

**Conditional-Go：**
- 有 Minor 缺陷记录并与用户确认延后处理
- 所有核心路径验证通过

**No-Go：**
- 存在未修复的 Critical / Major 缺陷
- 需求覆盖率不足 100%
- 存在回归

通过 **AskUserQuestion** 让用户确认判定结果（选项：Go / Conditional-Go / No-Go / 其他（自行补充））。用户也可在对话中直接输入自定义内容，Agent 正常接受。

---

## Step 7：归档 AR

用户确认 Go 后，将 AR 从 changes/ 归档到 archive/：

### 7a. 准备归档内容

AR 归档内容（只归档文档，代码留在 src/include/tests/ 中）：

```
specs/archive/ARxxx-topic/
├── srs.md           ← 需求设计说明书（final）
├── design.md        ← 详细设计文档（final）
└── st-cases.md      ← ST 测试用例 + 报告
```

> tasks.md 不归档（它是过程管理文件，无需保留在 archive 中）。

### 7b. 执行归档

```bash
# 在 specs/ 目录下
# Windows PowerShell:
Copy-Item -Recurse specs/changes/ARxxx-topic specs/archive/ARxxx-topic
# 确认 archive 目录内容正确后，删除 changes 中的 AR 目录
Remove-Item -Recurse specs/changes/ARxxx-topic
```

```bash
# Linux/macOS:
cp -r specs/changes/ARxxx-topic specs/archive/ARxxx-topic
rm -rf specs/changes/ARxxx-topic
```

### 7c. 提交归档

```bash
git add specs/archive/ARxxx-topic/
git rm -r specs/changes/ARxxx-topic/
git commit -m "archive(ARxxx): [AR 主题] ST 通过，归档

- ST 结果：PASS（第 N 轮）
- 需求覆盖：X/X (100%)
- 测试用例：X 个通过
- 遗留问题：X 个 Minor（已记录）"
```

### 7d. 完成摘要

输出最终完成摘要：

```
AR [ARxxx] ([主题]) — 完成并归档

归档位置：specs/archive/ARxxx-topic/
├── srs.md
├── design.md
└── st-cases.md

实现内容：
  [修改/新增的文件列表]

测试结果：
  ST 用例：X 通过 / X 总计
  单元测试：全部通过
  覆盖率：语句 XX%，分支 XX%

下一步：
  - 如有新的 AR → 在 specs/changes/ 创建新目录，重新开始流程
  - 如需查看历史 AR → specs/archive/ 目录
```

---

## 关键规则

- **ST 基于 srs.md，不是 design.md** — ST 是黑盒验证，关注行为是否满足需求
- **100% 需求覆盖** — srs.md 中每个功能需求必须有 ST 测试用例
- **有证据才能 PASS** — 每个 PASS 判定必须有实际执行记录
- **Critical/Major 不修复不归档** — 遗留严重缺陷会影响整个组件
- **归档前检查** — 归档后无法轻易撤回，确认 Go 后再执行

## 红旗警告

| 这种想法 | 正确做法 |
|---------|---------|
| "单元测试都过了，ST 就不用了" | 单元测试 ≠ ST，ST 验证端到端行为 |
| "这个用例手工跑一下就行，不用记录" | 每个测试用例必须在 st-cases.md 中记录结果 |
| "Minor 缺陷先归档，以后再说" | Minor 缺陷必须记录在 st-cases.md 并与用户确认 |
| "需求很简单，ST 走个形式" | 简单需求也需要 100% 覆盖 |
| "design.md 改了，ST 可以跳过" | 设计变更需要重新走 ST |

## 集成说明

**调用方：** sdd-router（review PASS，ST 未完成时）
**链接到：** 完成（归档后结束流程）
**读取：** `srs.md`、`design.md`、`tasks.md`、`组件_spec.md`、源文件/头文件/测试文件
**产出：** `specs/changes/ARxxx-topic/st-cases.md`（含报告）；完成后归档至 `specs/archive/ARxxx-topic/`
