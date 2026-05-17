# SDD 开发流程 Skill 集合

一套基于部门 IPD/SDD 规范的 AI 辅助开发流程 Skill，用于在 OpenCode 平台上实现结构化的需求→设计→开发→审查→验收全流程。

## 概述

本工程将传统的 SDD（软件开发文档）流程封装为 6 个独立的 Skill，由一个智能路由器根据工程当前状态自动分发到正确的阶段。每个 Skill 在独立的 Agent 上下文中运行，通过文件系统（`specs/` 目录下的 Markdown 文件）传递状态。

**核心设计理念：**

- **状态机驱动**：通过文件存在性自动判断当前阶段，任何时间中断后都能恢复
- **文档即契约**：srs.md 定义 WHAT，design.md 定义 HOW，tasks.md 追踪进度
- **硬性门禁**：每个阶段有明确的进入/退出条件，不可跳过
- **TDD 纪律**：开发阶段强制 Red→Green→Refactor，覆盖率不达标不可标记完成

---

## OpenCode 适配

本工程对 OpenCode 的三个扩展维度均进行了适配：**skill（按需加载）、command（用户触发入口）、agent（专属代理）**。

### 安装

将工程中的 `.opencode/` 目录整体复制到你的**目标组件工程根目录**：

```
cp -r /path/to/longtaskforagent/.opencode  /path/to/your-component/
```

复制完成后，目标工程的 `.opencode/` 目录结构如下：

```
your-component/
└── .opencode/
    ├── commands/          ← /sdd* slash command 定义
    │   ├── sdd.md
    │   ├── sdd-req.md
    │   ├── sdd-design.md
    │   ├── sdd-dev.md
    │   ├── sdd-review.md
    │   └── sdd-st.md
    └── agents/            ← 专属代理定义
        ├── sdd-build.md   ← 主流程代理（全工具权限）
        └── sdd-reviewer.md← 只读审查子代理
```

> **注意**：skill 本身已存放在 `longtaskforagent/skills/` 目录下，OpenCode 会沿目录树向上查找，无需额外复制 skill 文件。如需在完全独立的环境中使用，可在 `opencode.json` 中显式配置 skill 路径（见下方）。

---

### Command（用户触发入口）

共 6 个 `/sdd*` slash command，覆盖主入口和各阶段直连：

| Command | 说明 | 典型使用场景 |
|---------|------|------------|
| `/sdd` | **主入口**：自动检测状态，路由到正确阶段 | 每次会话开始时 |
| `/sdd-req` | 直接进入需求澄清阶段 | 开启新 AR，或需要补充需求文档 |
| `/sdd-design` | 直接进入详细设计阶段 | srs.md 已就绪，开始出 design.md |
| `/sdd-dev` | 直接进入开发阶段 | design.md 已就绪，开始 TDD 实现 |
| `/sdd-review` | 直接进入合规审查阶段 | 所有任务 passing，触发 S/D/C 三维审查 |
| `/sdd-st` | 直接进入验收测试 + 归档阶段 | review PASS 后，触发 ST 和 AR 归档 |

**推荐用法：**

```
# 每次会话只需一个命令，路由器自动判断阶段
/sdd

# 强制进入某阶段（跳过路由，高级用法）
/sdd-dev T003
```

---

### Agent（专属代理）

提供两个专属代理，在 OpenCode 中通过 `@agent-name` 调用：

#### `@sdd-build`（主流程代理）

- **模式**：primary（可直接交互）
- **工具权限**：全开（write / edit / bash / webfetch）
- **Skill 权限**：`sdd-*` 全部 allow，其他 ask
- **适用场景**：完整的 SDD 流程会话，等价于使用默认代理 + 加载 sdd-router

使用方式：
```
# 在对话框中指定代理
@sdd-build /sdd

# 或在 OpenCode 启动时指定
opencode --agent sdd-build
```

#### `@sdd-reviewer`（只读审查子代理）

- **模式**：subagent（由主代理调用，也可直接使用）
- **工具权限**：全部关闭（write / edit / bash 均禁用）
- **职责**：执行 S/D/C 三维独立审查，输出结构化审查报告
- **设计原则**：物理隔离写权限，确保审查结论不受代码修改能力干扰

`sdd-task-review` skill 会自动派发子任务给 `@sdd-reviewer`；也可以直接调用：
```
@sdd-reviewer 请对当前 AR 执行合规性审查
```

---

### 在 opencode.json 中配置 skill 路径（独立部署时）

如果目标工程与 `longtaskforagent` 不在同一个 git 工作树下，skill 无法被自动发现，需要在目标工程的 `opencode.json` 中显式指定：

```json
{
  "permission": {
    "skill": {
      "sdd-*": "allow"
    }
  }
}
```

同时将 skill 目录放入 `.opencode/skills/`：

```
your-component/
└── .opencode/
    └── skills/
        ├── sdd-router/SKILL.md
        ├── sdd-task-requirements/SKILL.md
        ├── sdd-task-design/SKILL.md
        ├── sdd-task-develop/SKILL.md
        ├── sdd-task-review/SKILL.md
        └── sdd-task-st/SKILL.md
```

---

## 工程结构

```
longtaskforagent/
├── README.md                              ← 本文档
├── .opencode/
│   ├── commands/                          ← OpenCode slash command 定义
│   │   ├── sdd.md                         ← /sdd（主入口）
│   │   ├── sdd-req.md                     ← /sdd-req（需求阶段）
│   │   ├── sdd-design.md                  ← /sdd-design（设计阶段）
│   │   ├── sdd-dev.md                     ← /sdd-dev（开发阶段）
│   │   ├── sdd-review.md                  ← /sdd-review（审查阶段）
│   │   └── sdd-st.md                      ← /sdd-st（验收测试）
│   └── agents/                            ← OpenCode 专属代理定义
│       ├── sdd-build.md                   ← @sdd-build（主流程代理）
│       └── sdd-reviewer.md               ← @sdd-reviewer（只读审查子代理）
├── docs/
│   └── templates/
│       └── design-template.md             ← design.md 部门模板（优先读取）
└── skills/
    ├── sdd-router/                        ← 路由器：状态检测 + 阶段分发
    │   └── SKILL.md
    ├── sdd-task-requirements/             ← 准备 + 需求澄清
    │   └── SKILL.md
    ├── sdd-task-design/                   ← AR 详细设计
    │   └── SKILL.md
    ├── sdd-task-develop/                  ← TDD 逐任务开发
    │   └── SKILL.md
    ├── sdd-task-review/                   ← S/D/C 三维合规性审查
    │   └── SKILL.md
    └── sdd-task-st/                       ← ST 验收测试 + 归档
        └── SKILL.md
```

---

## 流程全景

```
┌─────────────┐
│  sdd-router  │  ← 入口：每次会话从此开始
└──────┬───────┘
       │ 检测工程状态
       │
       ▼
┌──────────────────┐
│ sdd-task-        │  Step 1-3: 建立领域知识
│ requirements     │  Step 4-6: 需求澄清 + 生成 srs.md + tasks.md
└──────┬───────────┘  Step 7-8: 用户确认 + 移交设计
       │
       ▼
┌──────────────────┐
│ sdd-task-design  │  Step 1-2: 重建领域知识 + 分析设计输入
└──────┬───────────┘  Step 3-4: 提案 2-3 种方案 + 逐节审批
       │              Step 5-6: 生成 design.md + 更新 tasks.md
       │              Step 7-8: 刷新组件详设（按需）+ 移交开发
       ▼
┌──────────────────┐
│ sdd-task-develop │  Step 1-2: 定向 + 环境检查
└──────┬───────────┘  Step 3-4: TDD (Red→Green→Refactor) + 质量门禁
       │              Step 5-6: 更新 tasks.md + 提交代码
       │         ┌────────────────┐
       │         │ 循环执行每个   │
       │         │ pending 任务  │
       │         └────────────────┘
       ▼
┌──────────────────┐
│ sdd-task-review  │  Step 1-2: 收集路径 + 构建审查提示
└──────┬───────────┘  Step 3-4: 派发子 Agent 审查 + 解析结果
       │              Step 5-7: 修复(如有) + 记录 + 移交 ST
       ▼
┌──────────────────┐
│ sdd-task-st      │  Step 1-2: 就绪检查 + 生成 ST 用例
└──────┬───────────┘  Step 3-5: 执行测试 + 缺陷处理 + 生成报告
       │              Step 6-7: Go/No-Go 决策 + 归档 AR
       ▼
┌──────────────────┐
│    归档完成       │  specs/changes/ARxxx/ → specs/archive/ARxxx/
└──────────────────┘
```

---

## 目标工程目录结构

使用本 Skill 集合的组件工程应具备以下目录布局：

```
component/                          ← 你的组件工程
├── AGENTS.md                       ← （可选）AI Agent 开发规范
├── include/                        ← 头文件 / 接口定义
├── src/                            ← 源代码
├── tests/                          ← 测试代码
└── specs/
    ├── component-detail-design/
    │   └── 组件_spec.md            ← 组件整体详细设计（预先存在，必读）
    ├── changes/
    │   └── AR001-add-retry/        ← 进行中的 AR 目录
    │       ├── srs.md              ← 需求设计说明书
    │       ├── design.md           ← AR 详细设计文档
    │       ├── tasks.md            ← 任务状态跟踪
    │       └── st-cases.md         ← ST 测试用例 + 报告（ST 阶段生成）
    └── archive/
        └── AR000-fix-leak/         ← 已归档的 AR
            ├── srs.md
            ├── design.md
            └── st-cases.md
```

### 关键约定

| 约定 | 说明 |
|------|------|
| AR 编号格式 | 用户在需求阶段提供，格式自由（如 `AR001`、`AR-20260416`） |
| AR 目录命名 | `AR编号-主题`，如 `AR001-add-retry-mechanism` |
| srs.md | 无部门模板，使用 Skill 内置格式 |
| design.md | 优先读取部门模板（见下方模板配置），否则用 Skill 内置格式 |
| tasks.md | Markdown 格式的任务跟踪表，状态机：`pending` → `in_progress` → `passing` |
| ST 通过后归档 | `specs/changes/ARxxx/` → `specs/archive/ARxxx/`（tasks.md 不归档） |
| AGENTS.md | 可选，有则各 Skill 读取，无则跳过 |

---

## Skill 详解

### 1. sdd-router — 智能路由器

**触发时机**：每次在组件工程中开始新的会话。

**职责**：检测 `specs/changes/` 目录的状态，自动判断当前 AR 处于哪个阶段，然后调用对应的阶段 Skill。

**检测逻辑**：

| 检测条件 | 分发到 |
|---------|--------|
| 无任何 AR 目录 | sdd-task-requirements |
| AR 目录存在，但 srs.md / tasks.md 缺失 | sdd-task-requirements |
| srs.md 存在，design.md 缺失 | sdd-task-design |
| design.md 存在，tasks.md 有 pending 任务 | sdd-task-develop |
| 所有任务 passing，无 Review 通过记录 | sdd-task-review |
| Review 通过，无 ST 通过记录 | sdd-task-st |
| ST 已通过，AR 仍在 changes/ 下 | 提示归档或开启新 AR |

**调用方式**：

```
# 自动触发（推荐）：在 OpenCode 中配置为默认 Skill
use skill sdd-router

# 手动触发
use skill sdd-router:sdd-task-requirements
use skill sdd-router:sdd-task-design
```

---

### 2. sdd-task-requirements — 准备 + 需求澄清

**进入条件**：srs.md 或 tasks.md 缺失。

**退出条件**：srs.md 和 tasks.md 已生成并得到用户确认。

**流程（8 步）**：

1. **建立领域知识** — 读取组件详设（`specs/component-detail-design/`）、AGENTS.md、代码结构
2. **获取 AR 基本信息** — AR 编号、主题、背景 SR、需求背景
3. **需求澄清** — 4 轮结构化提问（范围→功能→接口→边界）
4. **生成 srs.md** — 需求设计说明书
5. **生成 tasks.md** — 任务分解表
6. **用户确认** — 呈现文档，等待批准
7. **保存文档** — 写入 `specs/changes/ARxxx/`
8. **移交设计** — 调用 sdd-task-design

**产出文件**：
- `specs/changes/ARxxx-topic/srs.md`
- `specs/changes/ARxxx-topic/tasks.md`

---

### 3. sdd-task-design — AR 详细设计

**进入条件**：srs.md 存在，design.md 缺失。

**退出条件**：design.md 已生成并得到用户确认，tasks.md 已更新，组件详设已按需同步。

**流程（8 步）**：

1. **重建领域知识** — 读取组件详设、srs.md、代码接口、检查部门模板
2. **分析设计输入** — 提取功能点、NFR、接口约束、架构约束
3. **提案设计方案** — 提出 2-3 种方案并给出推荐
4. **逐节设计审批** — 架构、接口、算法、错误处理、测试策略
5. **生成 design.md** — 按部门模板或内置模板写入
6. **更新 tasks.md** — 确认任务分解与设计一致
7. **刷新组件详细设计** — 分析 AR 对组件整体架构的影响，按需更新 `组件_spec.md`（新增/修改接口、数据结构、模块说明）
8. **移交开发阶段** — 调用 sdd-task-develop

**产出文件**：
- `specs/changes/ARxxx-topic/design.md`
- 更新 `specs/changes/ARxxx-topic/tasks.md`
- 按需更新 `specs/component-detail-design/组件_spec.md`（有接口/架构变化时）

**模板优先级**：
1. `specs/templates/design-template.md`
2. `docs/templates/design-template.md`
3. Skill 内置默认模板



---

### 4. sdd-task-develop — TDD 逐任务开发

**进入条件**：design.md 存在，tasks.md 有 pending 任务。

**退出条件**：当前任务标记为 passing（一个会话只完成一个任务）。

**流程（6 步 / 每个任务）**：

1. **定向** — 读取 tasks.md 选取当前任务、读取 design.md 和 srs.md 对应节
2. **启动** — 确认开发环境、冒烟测试（确认无回归）
3. **TDD 循环**：
   - **Red**：先写测试，确认编译/运行失败
   - **Green**：写最少代码让测试通过
   - **Refactor**：在测试保持 Green 的前提下重构
4. **质量门禁** — 覆盖率 ≥ 80%（语句）/ 70%（分支），无新增编译警告
5. **持久化** — 更新 tasks.md 状态为 passing，git commit
6. **结束会话** — 输出完成摘要

**关键纪律**：
- 一个会话只完成一个任务
- 严格按 design.md 实现，不得自行发明接口
- 测试失败超过 3 次 → 停止，问用户
- 发现 design.md 有歧义 → 停止，问用户

**产出**：
- 修改/新增的源文件和测试文件
- 更新后的 `tasks.md`

---

### 5. sdd-task-review — S/D/C 三维合规性审查

**进入条件**：所有任务 passing，无 Review 通过记录。

**退出条件**：审查 PASS，记录已写入 tasks.md。

**流程（7 步）**：

1. **收集路径参数** — 收集 srs.md、design.md、修改的代码文件路径
2. **构建子 Agent 提示** — 填充审查模板
3. **派发子 Agent** — 在独立上下文中执行审查
4. **解析审查结果** — PASS 或 FAIL
5. **修复 + 重审**（如 FAIL，最多 3 轮）
6. **记录审查结果** — 追加到 tasks.md
7. **移交 ST** — 调用 sdd-task-st

**审查维度**：

| 维度 | 检查项 | 数量 |
|------|--------|------|
| **S — 需求符合性** | 功能需求有测试、验证行为而非实现、无未文档化副作用、边界条件覆盖、错误处理覆盖 | 5 项 |
| **D — 设计符合性** | 接口签名一致、算法逻辑一致、模块影响范围一致、无未授权偏离 | 4 项 |
| **C — 组件规范符合性** | 不破坏现有接口、符合架构原则、代码风格符合规范 | 3 项 |

**产出**：
- 审查报告（子 Agent 输出）
- 更新后的 `tasks.md`（含审查记录）

---

### 6. sdd-task-st — ST 验收测试 + 归档

**进入条件**：Review 已 PASS。

**退出条件**：ST Go 决策通过，AR 已归档到 `specs/archive/`。

**流程（7 步）**：

1. **ST 就绪检查** — 确认所有任务 passing、Review PASS、编译和测试通过
2. **生成 ST 用例** — 基于 srs.md 验收标准，输出 `st-cases.md`
3. **执行 ST** — 自动化测试 + 覆盖率验证 + 回归测试
4. **缺陷处理** — Critical/Major 必须修复并重测
5. **生成 ST 报告** — 需求覆盖矩阵 + 执行汇总 + 遗留问题
6. **Go/No-Go 决策** — 向用户呈现报告，等待确认
7. **归档 AR** — 将文档移至 `specs/archive/ARxxx/`，提交 git

**产出文件**：
- `specs/changes/ARxxx-topic/st-cases.md`（测试用例 + 执行报告）
- 归档后的 `specs/archive/ARxxx-topic/`

---

## 部门模板配置

### design.md 模板

将部门设计文档模板放到以下任一路径，`sdd-task-design` 会自动读取并按模板结构填写：

```
优先级 1：specs/templates/design-template.md
优先级 2：docs/templates/design-template.md
优先级 3：Skill 内置模板（如果以上都不存在）
```

当前工程已包含一份默认模板在 `docs/templates/design-template.md`，可替换为部门正式模板。

### AGENTS.md

在组件工程根目录创建 `AGENTS.md`，各 Skill 会自动读取其中的开发规范。推荐内容：

```markdown
# 开发规范

## 代码风格
- 命名规范：[说明]
- 注释要求：[说明]

## 测试框架
- 框架：gtest/gmock
- 测试文件命名：tests/<module>_test.cpp

## 构建
- 构建工具：cmake
- 编译命令：cmake --build build
- 测试命令：cd build && ctest --output-on-failure
```

---

## 安装与部署

### OpenCode 平台

将本工程克隆到 OpenCode 的 skills 目录：

```bash
# 克隆到 OpenCode skills 目录
git clone <repo-url> ~/.config/opencode/skills/longtaskforagent

# 或者创建符号链接
ln -s /path/to/longtaskforagent ~/.config/opencode/skills/longtaskforagent
```

重启 OpenCode 后，Skills 会自动被发现。

### 使用方式

在组件工程目录中启动 OpenCode 会话，加载路由器 Skill：

```
> 加载 sdd-router skill，开始处理我的需求
```

路由器会自动检测工程状态并分发到对应阶段。

---

## 文件状态机

tasks.md 中的任务状态流转：

```
pending ──→ in_progress ──→ passing
               │
               └──→ failed ──→ in_progress（修复后重试）
```

AR 目录状态流转：

```
不存在 ──→ specs/changes/ARxxx/ ──→ specs/archive/ARxxx/
              │
              ├── srs.md 生成
              ├── design.md 生成
              ├── 所有任务 passing
              ├── Review PASS
              └── ST PASS → 归档
```

---

## 与部门 IPD 流程的对应关系

| 部门 IPD 阶段 | 本工程 Skill | 产出物 |
|--------------|-------------|--------|
| SR（系统需求） | （上游提供） | 组件详设（`组件_spec.md`） |
| AR（增强需求） | sdd-task-requirements | srs.md |
| AR 详细设计 | sdd-task-design | design.md |
| 编码实现 | sdd-task-develop | 源代码 + 测试代码 |
| 代码审查 | sdd-task-review | 审查报告 |
| 系统测试 | sdd-task-st | st-cases.md + ST 报告 |

> 开发团队主要接触 SR 和 AR 级别的需求。SR 级别的需求已在组件详设中体现，AR 级别的需求通过本流程管理。

---

## 端到端使用示例

以下用一个贴近实际的场景，展示从零开始走完整个 SDD 流程的完整过程。

### 场景

你正在维护一个 C++ 消息队列组件 `msg_queue`。组件已有基本的入队/出队功能，现在需要给消息增加优先级支持。

### 前提条件

组件工程目录结构：

```
msg_queue/
├── include/
│   └── msg_queue.h            ← 已有接口：enqueue(), dequeue(), size()
├── src/
│   └── msg_queue.cpp
├── tests/
│   └── msg_queue_test.cpp     ← 已有基础测试
├── specs/
│   └── component-detail-design/
│       └── msg_queue_spec.md  ← 组件详设（描述了整体架构和现有功能）
└── CMakeLists.txt
```

> 注意：`specs/changes/` 目录尚不存在。

---

### 第 1 次会话：需求澄清

在 OpenCode 中打开 `msg_queue/` 目录，开始：

```
> 加载 sdd-router skill
```

**sdd-router 检测状态**：

1. 检查 `specs/changes/` → 不存在
2. 分发到 `sdd-task-requirements`

**sdd-task-requirements 执行**：

**Step 1 — 建立领域知识**（Agent 自动完成，用户不需要操作）：

- 读取 `specs/component-detail-design/msg_queue_spec.md` → 了解到组件使用链表实现 FIFO 队列
- 读取 `include/msg_queue.h` → 现有接口：`enqueue(Msg)`, `dequeue() -> Msg`, `size() -> int`
- 扫描 `src/` 和 `tests/` → 了解现有实现和测试结构

**Step 2 — 获取 AR 基本信息**（Agent 向你提问）：

```
Agent: 请提供以下信息：
1. AR 编号是什么？
2. AR 主题简述？
3. 关联的 SR？
4. 需求背景？
```

你的回答：
```
1. AR 编号：AR-2026-0417
2. 主题：add-priority-support
3. 关联 SR：SR-0089（消息队列性能增强）
4. 背景：当前队列 FIFO，无法保证高优先级消息优先处理，影响实时性要求高的场景
```

Agent 创建目录 `specs/changes/AR-2026-0417-add-priority-support/`。

**Step 3 — 需求澄清**（Agent 多轮提问）：

```
Agent（Round 1）：
- 核心功能：是否需要支持多级优先级（如高/中/低）？
- 影响范围：enqueue/dequeue 的接口签名会改变吗？
- 性能要求：入队和出队的时间复杂度要求？
- 不做约束：是否需要支持运行时修改消息优先级？
```

你的回答：
```
- 支持三级优先级：HIGH / MEDIUM / LOW
- enqueue 接口增加 priority 参数；dequeue 保持不变（自动出队最高优先级）
- 入队 O(1)，出队 O(log n) 以内
- 不需要运行时修改优先级
```

Agent 可能还会追问 Round 2-3（功能细节、接口变更、兼容性等），你逐一回答。

**Step 4-5 — 生成文档**（Agent 自动完成）：

Agent 生成 `srs.md`（需求）和 `tasks.md`（任务分解），内容类似：

```markdown
# srs.md（摘要）

## 3. 功能需求

### 3.1 支持多级优先级入队
**触发条件：** 调用 enqueue(msg, priority)
**期望行为：** 消息按指定优先级入队
**验收标准：** Given 一个空队列, When 以 HIGH 优先级入队消息 A 再以 LOW 入队消息 B, Then dequeue 返回 A

### 3.2 优先级出队
**触发条件：** 调用 dequeue()
**期望行为：** 返回优先级最高的最早消息
**验收标准：** Given 队列中有 HIGH 消息 A 和 MEDIUM 消息 B, When dequeue, Then 返回 A
```

```markdown
# tasks.md（摘要）

| ID | 任务描述 | 依赖 | 状态 |
|----|---------|------|------|
| T001 | 定义 Priority 枚举和 Msg 结构体增加 priority 字段 | - | pending |
| T002 | 修改 enqueue 接口，支持 priority 参数 | T001 | pending |
| T003 | 修改内部存储为优先级队列结构 | T002 | pending |
| T004 | 修改 dequeue 逻辑，返回最高优先级消息 | T003 | pending |
```

**Step 6 — 用户确认**：

```
Agent: 请确认以上 srs.md 和 tasks.md 内容是否准确？
- 功能需求覆盖了多级优先级入队和优先级出队
- 任务分解为 4 个任务，依赖关系合理

回复"确认"继续，或指出需要修改的地方。
```

你确认后，Agent 将文件写入 `specs/changes/AR-2026-0417-add-priority-support/`，然后自动调用 `sdd-task-design`。

---

### 第 2 次会话：详细设计

> 也可以在第 1 次会话中连续完成（如果会话未超时）。

```
> 加载 sdd-router skill
```

**sdd-router 检测状态**：

1. `specs/changes/AR-2026-0417-add-priority-support/` 存在
2. `srs.md` 存在，`design.md` 不存在
3. 分发到 `sdd-task-design`

**sdd-task-design 执行**：

**Step 1 — 重建领域知识**：重新读取组件详设、srs.md、现有代码接口。

**Step 3 — 提案设计方案**：

```
Agent: 针对优先级队列的实现，有以下方案：

## 方案 A：三链表分离
每个优先级一个独立链表，dequeue 时按 HIGH→MEDIUM→LOW 顺序查找。
- 优点：实现简单，入队 O(1)，出队均摊 O(1)
- 缺点：消息量大时内存不连续

## 方案 B：小顶堆
使用二叉小顶堆，以 (priority, timestamp) 为排序键。
- 优点：入队 O(log n)，出队 O(log n)，内存连续
- 缺点：实现稍复杂

## 推荐：方案 B
理由：出队 O(log n) 满足 NFR 要求，且内存连续性更好。
```

你选择方案 B 后，Agent 进入逐节设计审批（Step 4），然后生成 `design.md`，包含：
- 接口签名：`void enqueue(const Msg& msg, Priority prio);`
- 核心算法：小顶堆的插入和提取逻辑
- 边界条件矩阵（空队列、满队列、同级排序等）
- 错误处理表
- 测试设计（单元测试覆盖点）

**Step 6-7**：Agent 更新 tasks.md（确认任务与设计一致），调用 `sdd-task-develop`。

---

### 第 3 次会话：开发 T001

```
> 加载 sdd-router skill
```

**sdd-router 检测状态**：

1. `design.md` 存在
2. `tasks.md` 中 T001 状态为 `pending`
3. 分发到 `sdd-task-develop`

**sdd-task-develop 执行**：

**Step 1 — 定向**：Agent 读取 tasks.md（选取 T001）、design.md（对应接口设计）、srs.md（对应需求）。

**Step 2 — 启动**：确认 cmake 和 gtest 可用，运行现有测试确认无回归。

**Step 3 — TDD 循环**：

```
--- Red 阶段 ---
Agent: 编写 T001 的测试...

tests/msg_queue_test.cpp 新增：
  TEST(MsgQueueTest, PriorityEnumHasThreeLevels) {
    EXPECT_EQ(static_cast<int>(Priority::HIGH), 0);
    EXPECT_EQ(static_cast<int>(Priority::MEDIUM), 1);
    EXPECT_EQ(static_cast<int>(Priority::LOW), 2);
  }

运行测试 → 编译失败（Priority 枚举尚未定义）✓ Red 确认

--- Green 阶段 ---
Agent: 实现最小代码让测试通过...

include/msg_queue.h 新增：
  enum class Priority { HIGH = 0, MEDIUM = 1, LOW = 2 };

运行测试 → 通过 ✓ Green 确认

--- Refactor 阶段 ---
Agent: 代码已足够简洁，无需重构。
```

**Step 4 — 质量门禁**：覆盖率达标，无新增编译警告。

**Step 5 — 持久化**：
- tasks.md 中 T001 状态更新为 `passing`
- git commit：`feat(AR-2026-0417): define Priority enum and update Msg struct`

**Step 6 — 结束摘要**：

```
Agent: 任务 T001 (定义 Priority 枚举和 Msg 结构体) — 完成
修改文件：include/msg_queue.h, tests/msg_queue_test.cpp
覆盖率：语句 100%，分支 100%
下一步：T002 (修改 enqueue 接口，支持 priority 参数)
```

---

### 第 4-5 次会话：开发 T002、T003、T004

（过程与 T001 相同，每次会话完成一个任务。假设全部通过。）

会话结束后 tasks.md 状态：

```markdown
| T001 | 定义 Priority 枚举和 Msg 结构体增加 priority 字段 | - | passing |
| T002 | 修改 enqueue 接口，支持 priority 参数 | T001 | passing |
| T003 | 修改内部存储为优先级队列结构 | T002 | passing |
| T004 | 修改 dequeue 逻辑，返回最高优先级消息 | T003 | passing |
```

---

### 第 6 次会话：合规性审查

```
> 加载 sdd-router skill
```

**sdd-router 检测状态**：

1. 所有任务 `passing`
2. 无 Review 通过记录
3. 分发到 `sdd-task-review`

**sdd-task-review 执行**：

**Step 3 — 派发子 Agent**：主 Agent 收集文件路径，构建审查提示，派发子 Agent。

子 Agent 独立读取所有文件，执行 S/D/C 三维审查：

```
## 审查结论
**总体判断：** PASS

### S — 需求符合性
| S1 | YES | srs.md §3.1 和 §3.2 均有对应测试 |
| S2 | YES | 测试基于 enqueue/dequeue 的输入输出断言 |
| S3 | YES | 无额外副作用 |
| S4 | YES | design.md §5 边界条件矩阵 6 行均有测试 |
| S5 | YES | design.md §6 错误处理表 3 种错误均有测试 |

### D — 设计符合性
| D1 | YES | 接口签名与 design.md §3 完全一致 |
| D2 | YES | 堆插入和提取逻辑与 §4 伪代码一致 |
| D3 | YES | 修改文件集合与 §2 模块影响分析一致 |
| D4 | YES | 无未授权偏离 |

### C — 组件规范符合性
| C1 | YES | 原有 dequeue() 接口签名未变 |
| C2 | YES | 代码组织与组件详设分层一致 |
| C3 | YES | 命名符合 AGENTS.md 规范 |
```

Agent 在 tasks.md 中记录审查 PASS，调用 `sdd-task-st`。

---

### 第 7 次会话：ST 验收测试 + 归档

```
> 加载 sdd-router skill
```

**sdd-router 检测状态**：Review PASS，无 ST 记录 → 分发到 `sdd-task-st`。

**sdd-task-st 执行**：

**Step 2 — 生成 ST 用例**（写入 `st-cases.md`）：

```markdown
### ST-001：高优先级消息优先出队
**关联需求：** srs.md §3.2
**前置条件：** 队列中有 HIGH 消息 A 和 LOW 消息 B
**测试步骤：** 1. enqueue(A, HIGH) 2. enqueue(B, LOW) 3. dequeue()
**期望结果：** 返回 A
**状态：** PASS
```

（共 8 个 ST 用例，覆盖正常路径、边界条件、异常处理）

**Step 3 — 执行 ST**：运行测试套件，全部通过。

**Step 6 — Go/No-Go 决策**：

```
Agent: ST 结果摘要
- 需求覆盖率：2/2 (100%)
- ST 用例：8 通过 / 0 失败
- 回归测试：通过，无回归
- 遗留问题：无

建议：Go
```

你确认 Go 后，Agent 执行归档：

```
specs/changes/AR-2026-0417-add-priority-support/
  → specs/archive/AR-2026-0417-add-priority-support/
    ├── srs.md
    ├── design.md
    └── st-cases.md
```

git commit：`archive(AR-2026-0417): add-priority-support ST 通过，归档`

```
Agent: AR AR-2026-0417 (add-priority-support) — 完成并归档

归档位置：specs/archive/AR-2026-0417-add-priority-support/

下一步：
  - 如有新的 AR → 在 specs/changes/ 创建新目录，重新开始流程
  - 如需查看历史 AR → specs/archive/ 目录
```

---

### 中断恢复示例

假设在开发 T003 时会话中断（网络断开、下班等），下次重新打开时：

```
> 加载 sdd-router skill
```

**sdd-router 检测**：

1. `specs/changes/AR-2026-0417-add-priority-support/` 存在
2. `design.md` 存在
3. `tasks.md` 中 T003 状态仍为 `pending`（未完成，不是 passing）
4. 分发到 `sdd-task-develop` → 从 T003 继续

无需手动指定阶段，路由器自动恢复。

---

### 并行 AR 说明

当前设计下，`specs/changes/` 下可以同时存在多个 AR 目录（例如一个紧急修复和一个常规需求）。路由器会优先选取最近修改的 AR 目录，或请用户指定：

```
Agent: 检测到 2 个进行中的 AR：
1. AR-2026-0417-add-priority-support（最后修改：2 小时前）
2. AR-2026-0418-fix-deadlock（最后修改：30 分钟前）

请选择要继续的 AR，或直接输入新的 AR 编号开始新需求。
```

---

## 常见问题

### Q: 中断后如何恢复？

每次会话开始时加载 `sdd-router`，它会自动检测 `specs/changes/ARxxx/` 下的文件状态，跳转到正确的阶段。

### Q: 一个 AR 有多少个任务合适？

| AR 规模 | 功能需求 | 任务数量 |
|---------|---------|---------|
| 小型 | 1-3 个 | 2-4 个 |
| 中型 | 4-10 个 | 5-10 个 |
| 大型 | 10+ 个 | 建议拆分为多个 AR |

### Q: 可以跳过某些阶段吗？

不可以。每个阶段都有硬性门禁（`<HARD-GATE>`），必须在满足退出条件后才能进入下一阶段。

### Q: 覆盖率目标是多少？

默认：语句覆盖率 ≥ 80%，分支覆盖率 ≥ 70%。可在 design.md §7.2 中自定义目标。

### Q: 审查不通过怎么办？

进入修复循环（最多 3 轮）。Critical 和 Important 问题必须修复后才能重审。超过 3 轮仍有 FAIL，向用户上报由用户决定。
