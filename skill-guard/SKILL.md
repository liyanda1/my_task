---
name: skill-guard
description: >
  Skill 防护网——每次优化 skill 后自动检测功能退化，保障已有功能不受影响。
  在修改 skill 后用于防护/验证/回归测试。
  触发词: guard, 防护网, validate skill, regression test, 回归测试,
  验证 skill, 检查退化, skill 防护, 保护网.
---

# Skill Guard

通用 skill 防护网。对任意 skill 修改后并行跑回归用例，对比新旧版本输出，生成 HTML 报告，检测功能退化。

## 核心逻辑

```
修改前:
  1. 对 skill 目录打快照 → baseline/
修改后:
  2. 读取目标 skill 的 evals/evals.json
  3. 并行 spawn 子代理: 每个 eval 同时跑 current（新版）和 baseline（旧版）
  4. 每个 run 完成后 spawn grader 子代理评分
  5. 聚合 grading.json → benchmark.json
  6. 生成静态 HTML 报告
  7. 判定: pass_rate 下降 → 告警 & 建议回滚
```

## 和 opencode-skill-creator 的差异

| skill-creator | skill-guard |
|--------------|-------------|
| with_skill vs without_skill | **current vs baseline** |
| 验证 skill 是否优于不用 | **检测新版本是否退化** |
| HTTP 服务器报告 | **仅静态 HTML** |
| 有 optimize loop | **单次回归验证** |

---

## 工作流程

### Step 0: 确认参数

运行前确认以下参数。如果用户只给了 skill 名称，你需要自己搜索路径。

**0a. 确认脚本可用**：

聚合和报告生成是确定性操作（文件 I/O + 数学计算），**绝不手工拼接 JSON**。使用 skill-guard 自带脚本：

```bash
ls scripts/aggregate.py scripts/generate_report.py
```

脚本路径相对于 skill-guard 的 SKILL.md 所在目录（见本文件末尾 `Base directory` 标注）。如果脚本不存在，报错终止。

**0b. 自动搜索 SKILL_PATH**（当用户只给名称时）：
1. 先尝试直接路径：`~/.config/opencode/skills/<name>/SKILL.md`
2. 如果不存在，用 glob 搜索：`**/<name>/SKILL.md` 在 `~/.config/opencode/skills/` 下（很多 skill 嵌套在父 skill 的 `skills/` 子目录下，如 `sdd-task/skills/sdd-router/`）
3. 如果用户在远端给出了具体路径，直接使用，不要重复搜索

**0c. 必须确认的参数**:
- `SKILL_NAME`: 目标 skill 名称
- `SKILL_PATH`: 目标 skill 的绝对路径（**必须通过搜索确认**，不能直接拼接）
- `SKILL_GUARD_BASE`: skill-guard SKILL.md 所在目录的绝对路径（用于定位 scripts/ 和 templates/）
- `EVALS_PATH`: evals.json 路径 (默认 `$SKILL_PATH/evals/evals.json`)
- `SNAPSHOT_PATH`: 快照路径 (默认 `$SKILL_PATH.guard-snap`，即 skill 目录同级加 `.guard-snap` 后缀)
- `WORKSPACE`: 工作目录 (默认 `$PWD/.skill-guard/<skill-name>/<timestamp>/` — 即在启动 opencode 的当前目录下)
- `FIXTURES_DIR`: 测试 fixture 目录 (默认 `$WORKSPACE/fixtures/`，**不使用 /tmp**，避免权限问题)

**0d. 立即写入固定任务列表**（确认参数后，第一个 todowrite 操作）：

用 todowrite 工具写入如下固定的 5 步任务列表，之后每步完成时更新状态为 completed。**任务内容固定，不要自行调整顺序或增减**：

```
确认参数和前置条件
准备测试环境和工作区
并行执行回归测试
评分并聚合结果
生成报告并判定结果
```

### Step 1: 检查前置条件

1. 确认 `$SKILL_PATH/SKILL.md` 存在
2. 确认 `$EVALS_PATH` 存在，否则报错"该 skill 没有 evals/evals.json，请先创建用例"
3. 确认 `$SNAPSHOT_PATH` 存在，否则报错"没有 baseline 快照，请先对 skill 打快照: cp -r $SKILL_PATH $SNAPSHOT_PATH"
4. 读取 `evals.json`，解析所有 eval 用例

**创建 fixture 目录**（如果 eval prompt 中引用文件系统路径）：

evals.json 的 prompt 字段可能引用 `/tmp/xxx-fixture` 这样的路径。由于 `/tmp` 可能有权限问题，改为在 workspace 下创建 fixture：

```bash
mkdir -p "$WORKSPACE/fixtures"
```

对每个 eval，如果其 prompt 中包含形如 `/tmp/sdd-router-fixture-eval<N>` 的路径：
1. 将 prompt 中的 `/tmp/<fixture-name>` 替换为 `$WORKSPACE/fixtures/<fixture-name>`
2. 在 `$WORKSPACE/fixtures/<fixture-name>/` 下创建该 eval 需要的文件结构（根据 evals.json 中 expectations 的描述推断）
3. 更新 `eval_metadata.json` 中的 prompt 字段为实际 fixture 路径

**重要**：fixture 必须在 spawn 子代理之前创建完毕，因为子代理需要访问这些文件。

### Step 2: 创建 workspace

在**当前工作目录**（启动 opencode 时的目录）下创建。所有生成文件集中在一个目录中，避免 /tmp 权限问题。

```bash
TIMESTAMP=$(date +%s)
WORKSPACE="$PWD/.skill-guard/$SKILL_NAME/$TIMESTAMP"
mkdir -p "$WORKSPACE"
```

对每个 eval (i=0,1,2...):
```bash
mkdir -p "$WORKSPACE/eval-$i/current/outputs"
mkdir -p "$WORKSPACE/eval-$i/baseline/outputs"
```

### Step 3: 写入 eval_metadata.json

为每个 eval 创建元数据文件:

```json
{
  "eval_id": <i>,
  "eval_name": "<从 evals.json 中取 name 字段, 无则用 eval-<i>>",
  "prompt": "<eval 的 prompt，如果其中包含 /tmp/ 路径则已替换为实际 fixture 路径>",
  "expected_output": "<从 evals.json 中取 expected_output 字段>",
  "expectations": [<eval 的 expectations 数组>]
}
```

保存到 `$WORKSPACE/eval-$i/eval_metadata.json`。

### Step 4: 并行 spawn 所有子代理 (关键步骤)

**一次性、同一回合 spawn 所有 current + baseline 子代理。不要分批。**

对 evals.json 中每个 eval:

```
同时 spawn 2 个 Task 子代理 (subagent_type="general"):

A. current 子代理:
   - prompt: 告诉它用 skill <SKILL_NAME> 执行以下任务:
     "<eval.prompt>"
   - 输入文件: <eval.files 中列出的文件, 从 $SKILL_PATH 下找>
   - 输出目录: $WORKSPACE/eval-<i>/current/outputs/
   - 要求: 将任务输出（文件、文本等）写入输出目录；完成后写入 transcript.md

B. baseline 子代理:
   - prompt: 用旧版 skill (快照) 执行同样任务
   - skill 路径: 指向 $SNAPSHOT_PATH/SKILL.md
   - 其他同上，输出到 $WORKSPACE/eval-<i>/baseline/outputs/
```

**重要**: 必须同时启动所有子代理，不要先启动 A 再回头启动 B。一次性发射全部。

### Step 5: 评分 (grader 子代理)

所有 run 完成后，为每个 run 目录 spawn grader 子代理:

```
启动 Task 子代理 (subagent_type="general"):
  - 指令: 读取 agents/grader.md 的内容
  - 参数:
    - expectations: eval_metadata.json 中的 expectations 数组
    - transcript_path: $RUN_DIR/outputs/transcript.md
    - outputs_dir: $RUN_DIR/outputs/
  - 输出: $RUN_DIR/grading.json
```

可以并行 spawn 所有 grader，互不依赖。

### Step 6: 聚合 benchmark.json（确定性脚本）

**绝不手工拼接 JSON。使用脚本，100% 确定性。**

```bash
python3 "$SKILL_GUARD_BASE/scripts/aggregate.py" "$WORKSPACE" --skill-name "$SKILL_NAME"
```

脚本自动完成：
- 遍历 `eval-N/current/grading.json`
- 遍历 `eval-N/baseline/grading.json`
- 读取 `eval-N/eval_metadata.json` 获取 prompt / expected_output
- 计算 pass_rate mean/stddev/min/max 统计
- 检测退化（pass_rate 下降 > 1% → REGRESSION 标注）
- 输出 `$WORKSPACE/benchmark.json`

**检查输出**：脚本会打印摘要（evals 数量、configs、是否有回归）。确认无报错再继续。

### Step 7: 生成 HTML 报告（确定性脚本）

**绝不手工嵌入 JSON 到 HTML。使用脚本，同时生成聚合报告和每用例独立报告。**

```bash
python3 "$SKILL_GUARD_BASE/scripts/generate_report.py" \
  "$WORKSPACE/benchmark.json" \
  "$SKILL_GUARD_BASE/templates/report.html" \
  "$WORKSPACE/report.html" \
  --per-eval-template "$SKILL_GUARD_BASE/templates/report-per-eval.html" \
  --per-eval-dir "$WORKSPACE"
```

输出：
- `$WORKSPACE/report.html` — 所有 eval 的聚合报告（仪表盘 + 逐用例详情）
- `$WORKSPACE/eval-0/report.html` — eval 0 独立报告
- `$WORKSPACE/eval-1/report.html` — eval 1 独立报告
- ...（每个 eval 一个独立报告）

每个报告都是自包含静态 HTML，浏览器直接打开。

### Step 8: 判定 + 总结

分析 benchmark.json 的 delta 数据，给用户报告:

```
✓ Skill Guard 报告: <SKILL_NAME>
─────────────────────────────────
  指标     │ 基线   │ 当前   │ 变化
  ─────────┼────────┼────────┼───────
  通过率   │  X%   │  Y%   │  +/-

  用例:  M/N 通过 (X/Y 退化)

  状态: ✓ 通过 / ⚠ 检测到回归
─────────────────────────────────

HTML 报告: <WORKSPACE>/report.html (可直接用浏览器打开)
```

判定规则:
- 所有 eval pass_rate >= baseline → ✓ 通过
- 任一 eval pass_rate 下降 → ⚠ 回归告警，建议检查变更
- pass_rate 下降 > 20% → 严重退化，建议回滚: `cp -r $SNAPSHOT_PATH $SKILL_PATH`

---

## 注意事项

1. **快照 (snapshot) 是必须的**: 第一次使用时必须先手工打快照
2. **evals.json 断言要可验证**: 断言应该是客观可验证的语句，不要写"代码质量高"这种主观判断
3. **并行子代理**: 必须一次性同时 spawn 所有子代理
4. **HTML 报告是自包含的**: 不需要服务器，直接用浏览器打开
5. **fixture 路径**: 不要在 evals.json prompt 中硬编码 `/tmp/` 路径；使用相对路径或在 Step 1 中替换为 `$WORKSPACE/fixtures/`
6. **skill 路径搜索**: 不要直接拼接 `~/.config/opencode/skills/<name>`，先用 glob 搜索（很多 skill 嵌套在父级 skill 的 `skills/` 目录下）
7. **聚合和报告用脚本，不用 AI 手工**: Step 6/7 必须调用 `scripts/aggregate.py` 和 `scripts/generate_report.py`，禁止手工读取 JSON 拼接 benchmark
8. **todos 固定列表**: 每次运行开始时在 Step 0 用 todowrite 写入固定的 5 步列表（面向用户粒度的摘要），之后只更新状态，不添加新条目

---
## 确定性脚本

聚合和报告生成使用 Python 脚本（不是 plugin、不是 AI 手工操作）：

| 脚本 | 用途 | 输入 | 输出 |
|------|------|------|------|
| `scripts/aggregate.py` | 聚合 grading → benchmark | workspace 目录 | `benchmark.json` |
| `scripts/generate_report.py` | benchmark → HTML 报告 | benchmark.json + 模板 | `report.html` + 每用例 `eval-N/report.html` |

**为什么用脚本而不是 plugin**：
- opencode 的 ToolSearch 机制在不同环境中行为不一致，plugin 经常无法被发现
- Python 脚本 100% 确定性，AI 只需执行一个 bash 命令
- 不会出现 AI 手工拼接 JSON 时的截断或格式错误

**前提**：远端环境需有 `python3`（open-code Linux 环境通常自带）。

---
## 参考文件

- `agents/grader.md` — 评分子代理指令
- `references/schemas.md` — benchmark.json / grading.json JSON schema
- `templates/report.html` — 聚合 HTML 报告模板（仪表盘风格）
- `templates/report-per-eval.html` — 单用例 HTML 报告模板
- `templates/evals.json.example` — evals.json 示例
- `scripts/aggregate.py` — 确定性聚合脚本
- `scripts/generate_report.py` — 确定性报告生成脚本
