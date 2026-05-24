# Skill Guard

通用 skill 防护网——对**任意 skill** 修改后自动检测功能退化，不绑定任何特定 skill。

## 背景与动机

### 为什么需要 skill-guard？

opencode 用 SKILL.md 定义 AI 的行为规范。随着 skill 越写越复杂（SDD 体系就有 5 个阶段 skill + 1 个 router），每次优化一个 skill 都可能意外破坏其他功能。这种退化往往很隐蔽——AI 的输出看起来没问题，但关键步骤被跳过了、输出格式变了、确认粒度不对了。等用户发现时，已经不知道是哪次改动引入的。

**传统做法**：改完 skill 后手动跑几个 case 看效果。但人脑记不住所有边界场景，而且 AI 的输出是非确定性的，手动对比根本不靠谱。

**skill-guard 的解法**：把回归测试做成一个标准流程——改 skill 前打快照，改完后用同一批用例并行跑新旧两版，自动评分对比，一眼看出哪里退化了。

### 和 opencode-skill-creator 的定位差异

skill-creator 回答的是"这个 skill 有没有用"（有 skill vs 无 skill）。skill-guard 回答的是"这次改坏了吗"（新版本 vs 旧版本）。前者用于首次创建 skill，后者用于持续迭代。

## 核心优势

1. **通用，不绑定任何 skill**。只要目标 skill 有 `evals/evals.json`，就能对其运行回归。SDD 体系的 skill 可以，你自己写的 skill 也可以。

2. **并行执行，速度尽可能快**。所有用例的 current 和 baseline 子代理同时启动，互不阻塞。用例越多，并行优势越明显。

3. **自动化评分，不是"看着差不多就行"**。grader 逐条检查 expectations，给出明确的 PASS/FAIL + 证据引用。还会主动提取 claims、审视用例质量——不止告诉你"过了没"，还告诉你"断言写得好不好"。

4. **自包含 HTML 报告，零依赖打开**。不需要 HTTP 服务器，浏览器直接打开就能看。聚合报告里一目了然：哪些用例退化了、为什么、输出文件对比一目了然。

5. **确定性脚本聚合，AI 不手工拼 JSON**。`aggregate.py` 和 `generate_report.py` 承担所有数据操作，AI 只负责执行 bash 命令。避免 AI 拼接 JSON 时的截断、格式错误、幻觉。

## 安装

拷贝到 opencode skills 目录：

```bash
# 在远端 Linux 上
cp -r skill-guard/ ~/.config/opencode/skills/skill-guard/
```

**前置条件**：远端环境需有 `python3`（open-code Linux 环境通常自带）。聚合和报告使用 Python 脚本，不需要额外依赖。

## 使用方式

在 opencode 中对话（替换 `<skill-name>` 为你要验证的 skill 名）：

```
guard <skill-name>
```

例如：
```
guard sdd-router
guard sdd-task-develop
```

Skill Guard 会自动搜索 skill 路径（支持嵌套在父 skill 下的情况）。

## 工作原理

对每个 eval 用例，Skill Guard 执行以下流程：

1. **快照基线（baseline）**：从 `.guard-snap` 快照目录运行 skill，记录输出
2. **当前版本（current）**：从当前 skill 目录运行 skill，记录输出
3. **评分（grader）**：对两个版本的输出分别评分，提取 claims（关键主张）和 eval_feedback（改进建议）
4. **聚合**：汇总所有用例的评分结果，检测回归
5. **报告**：生成 HTML 报告，展示逐用例对比和聚合统计

**核心对比维度**：

| 维度 | 说明 |
|------|------|
| `factual` | 事实正确性（输出是否符合预期） |
| `process` | 流程合规性（是否按 skill 定义的步骤执行） |
| `quality` | 输出质量（可读性、完整性、健壮性） |
| `claims` | 评分员提取的关键主张（用于快速定位差异） |
| `eval_feedback` | 改进建议（仅当存在回归时生成） |

## 工作目录

所有生成文件在当前工作目录（启动 opencode 的目录）下的 `.skill-guard/` 中。**不会在 /tmp 下创建任何文件**，避免权限问题：

```
$PWD/.skill-guard/<skill-name>/<timestamp>/
├── fixtures/               ← 测试 fixture 文件（替代 /tmp）
├── eval-0/
│   ├── current/outputs/   ← 新版 skill 输出文件
│   ├── baseline/outputs/  ← 旧版 skill (快照) 输出文件
│   ├── current/grading.json
│   ├── baseline/grading.json
│   ├── eval_metadata.json
│   └── report.html        ← 单用例独立报告
├── benchmark.json         ← 聚合数据（由脚本生成）
└── report.html            ← 聚合报告（所有用例）
```

**报告层级**：
- 聚合报告 `report.html`：仪表盘 + 所有 eval 详情 + Outputs 对比区
- 每用例报告 `eval-N/report.html`：单个 eval 的独立对比页面

## 前置准备

### 1. 为目标 skill 创建 evals.json

在**目标 skill 的目录下**创建 `evals/evals.json`（不是在 skill-guard 目录下）：

```json
{
  "skill_name": "<skill-name>",
  "evals": [
    {
      "id": 1,
      "name": "核心功能冒烟测试",
      "prompt": "用户真实会说的 prompt",
      "expected_output": "预期结果描述",
      "files": [],
      "expectations": [
        "输出中包含关键词 XXX",
        "工具调用次数 <= 8",
        "生成了 .py 文件"
      ]
    }
  ]
}
```

**断言设计原则：**
- 必须客观可验证（不要写"代码质量高"、"看起来不错"）
- 每个断言应该能明确判 PASS 或 FAIL
- 聚焦核心功能路径

### 2. 首次使用时打快照

```bash
# 在远端 Linux 上执行
# 先找到 skill 的实际路径（可能嵌套在父 skill 下）：
find ~/.config/opencode/skills/ -name "SKILL.md" -path "*/skills/<skill-name>/*"

# 打快照（快照目录 = skill 路径 + .guard-snap 后缀）
cp -r <skill-path> <skill-path>.guard-snap
```

**关于 skill 路径**：SDD 体系的 skill 嵌套在父 skill 的 `skills/` 子目录下。Skill Guard 会自动搜索，你只需要提供 skill 名称。

### 3. 日常使用流程

```
1. 修改 SKILL.md 前，确保快照是最新的 baseline
2. 修改 SKILL.md
3. 在 opencode 中说: "guard <skill-name>"
4. 查看生成的 HTML 报告
   - 聚合: .skill-guard/<skill-name>/<timestamp>/report.html
   - 单用例: .skill-guard/<skill-name>/<timestamp>/eval-N/report.html
5. 如果无退化 → 更新快照: cp -r <skill-path> <skill-path>.guard-snap
6. 如果有退化 → 回滚: cp -r <skill-path>.guard-snap <skill-path>
```

## 确定性脚本

聚合和报告生成使用 Python 脚本，**AI 只执行 bash 命令，不手工拼接 JSON**：

| 脚本 | 用途 |
|------|------|
| `scripts/aggregate.py` | 读取所有 grading.json → 输出 benchmark.json（含统计 + 退化检测 + claims/feedback 聚合） |
| `scripts/generate_report.py` | 读取 benchmark.json → 输出聚合报告 + 每用例独立报告（含 Outputs 对比区） |

## 文件结构

```
skill-guard/
├── SKILL.md                          ← skill 定义（主工作流程）
├── README.md                         ← 使用说明（本文件）
├── agents/
│   └── grader.md                     ← 评分子代理指令（含 claims 提取 + eval_feedback）
├── scripts/                          ← 确定性脚本（★ 核心）
│   ├── aggregate.py                  ← 聚合 grading → benchmark
│   └── generate_report.py            ← benchmark → HTML 报告
├── templates/
│   ├── report.html                   ← 聚合 HTML 报告模板（含 Outputs 对比区）
│   ├── report-per-eval.html          ← 单用例 HTML 报告模板
│   └── evals.json.example            ← evals.json 示例
├── references/
│   └── schemas.md                    ← JSON schema 文档（grading.json / benchmark.json）
```

## 解读报告

聚合报告顶部显示：
- **通过率**：所有用例中无回归的比例
- **回归列表**：列出所有检测到的回归用例及原因
- **逐用例详情**：每个用例的 baseline/current 评分对比 + claims 对比 + eval_feedback

**回归判定规则**（任一触发即标记回归）：
- `factual` 评分下降
- `process` 评分下降
- `quality` 评分下降
- current 输出了文件但 baseline 也输出了（完整性对比）
