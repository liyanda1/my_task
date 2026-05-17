---
name: sdd-router
description: "Use when starting any session in an SDD-based component project - routes to the correct phase skill based on project state"
---

<EXTREMELY-IMPORTANT>
你正在一个 SDD（软件开发文档）多会话工程中。在做任何响应或操作之前，你必须先调用正确的阶段 skill。

如果某个阶段 skill 适用，你没有选择余地，必须使用它。

这不是可商量的，不是可选的，你无法用任何理由绕过它。
</EXTREMELY-IMPORTANT>

## 如何调用 Skill

使用 `Skill` 工具按名称调用（例如：`sdd-router:sdd-task-requirements`）。被调用后，skill 内容会被加载并呈现给你——直接按照它执行。不要用 Read 工具读取 skill 文件。

## 阶段检测（Phase Detection）

按顺序检查工程状态，调用对应的 skill：

```
Session Start
  │
  ├─ specs/changes/ 下存在 ARxxx 目录？
  │     │
  │     ├─ 否 → [sdd-task-requirements] 准备阶段：读取领域知识 + 需求澄清
  │     │
  │     └─ 是：进入已有 AR 目录检测
  │           │
  │           ├─ tasks.md 不存在？
  │           │     └─ → [sdd-task-requirements] 需求尚未澄清完成
  │           │
  │           ├─ tasks.md 存在，srs.md 不存在？
  │           │     └─ → [sdd-task-requirements] 需要补充完成 srs.md
  │           │
  │           ├─ srs.md 存在，design.md 不存在？
  │           │     └─ → [sdd-task-design] 生成 AR 详细设计
  │           │
  │           ├─ design.md 存在，tasks.md 中有 pending 任务？
  │           │     └─ → [sdd-task-develop] 执行代码开发
  │           │
  │           ├─ 所有任务 passing，review 未完成？
  │           │     └─ → [sdd-task-review] 规范性 / 合规性检查
  │           │
  │           └─ review 通过，ST 未完成？
  │                 └─ → [sdd-task-st] ST 验收测试 + 归档
```

## 检测规则（Detection Rules）

按优先级从高到低检查：

1. **检查 `specs/changes/` 目录**  
   - 如果没有任何 `ARxxx-*` 子目录 → 调用 `sdd-router:sdd-task-requirements`（从头开始）

2. **在所有 `specs/changes/ARxxx-*/` 中，找到当前正在处理的 AR**  
   - 优先选取最近修改时间的 AR 目录（或请用户指定）
   - 读取该目录下的文件状态

3. **AR 内部状态检测**（按顺序）：

   | 检测条件 | 调用 Skill |
   |---------|-----------|
   | `tasks.md` 不存在 | `sdd-router:sdd-task-requirements` |
   | `srs.md` 不存在 | `sdd-router:sdd-task-requirements` |
   | `design.md` 不存在 | `sdd-router:sdd-task-design` |
   | `tasks.md` 中存在 `status: pending` 或 `status: in_progress` 的任务 | `sdd-router:sdd-task-develop` |
   | 所有任务 `status: passing`，但无 `## Review` 通过记录 | `sdd-router:sdd-task-review` |
   | Review 已 PASS，但无 ST 通过记录 | `sdd-router:sdd-task-st` |
   | ST 已通过，AR 目录在 `specs/changes/` 下 | 提示用户：归档 AR 到 `specs/archive/ARxxx-topic/`，或使用 `/sdd-reactivate` 对已归档 AR 进行返工 |

## 归档 AR 返工

当 `specs/changes/` 为空但 `specs/archive/` 下有已归档 AR 时：

```
检测到所有 AR 已归档。可进行的操作：

1. 开启新 AR — 直接描述新需求，将启动需求澄清阶段
2. 返工已归档 AR — 使用 /sdd-reactivate <AR编号> <返工说明>
   例如：/sdd-reactivate AR123-fix-bug 实现逻辑有误需要修改代码
```

## 目录结构参考

```
component/
├── AGENTS.md                          ← 组件代理指导文件（已有则读取）
├── include/                           ← 头文件/接口定义
├── src/                               ← 源代码
├── tests/                             ← 测试代码
└── specs/
    ├── component-detail-design/
    │   └── 组件_spec.md               ← 组件整体详细设计（预先存在，必读）
    ├── changes/
    │   └── ARxxx-topic/               ← 进行中的 AR
    │       ├── srs.md                 ← 需求设计说明书（需求澄清产出）
    │       ├── design.md              ← AR 详细设计文档（设计阶段产出）
    │       └── tasks.md               ← 任务状态跟踪（Markdown 格式）
    └── archive/
        └── ARxxx-topic/               ← 已归档的 AR（ST 通过后移入）
            ├── srs.md
            └── design.md
```

## Skill 目录

### 阶段 Skill（根据检测结果调用其中一个）

| Skill | 阶段 | 触发条件 |
|-------|------|---------|
| `sdd-router:sdd-task-requirements` | 准备 + 需求澄清 | 无 AR 目录，或 srs.md / tasks.md 缺失 |
| `sdd-router:sdd-task-design` | AR 详细设计生成 | srs.md 存在，design.md 缺失 |
| `sdd-router:sdd-task-develop` | 代码开发 | design.md 存在，tasks.md 有 pending 任务 |
| `sdd-router:sdd-task-review` | 规范性/合规性检查 | 所有任务 passing，review 未完成 |
| `sdd-router:sdd-task-st` | ST 验收测试 | review 通过，ST 未完成 |

## 关键文件（共享契约）

| 文件 | 作用 |
|------|------|
| `specs/component-detail-design/组件_spec.md` | 组件详细设计（WHAT 的全局基准）|
| `AGENTS.md` | 组件代理指导，开发约定 |
| `specs/changes/ARxxx/srs.md` | 需求设计说明书 |
| `specs/changes/ARxxx/design.md` | AR 详细设计文档 |
| `specs/changes/ARxxx/tasks.md` | 任务状态跟踪（中央共享状态）|
| `include/` | 接口头文件，理解组件对外接口 |
| `src/` | 源码，理解当前实现 |
| `tests/` | 测试代码 |

## 红旗警告（Red Flags）

| 这种想法 | 现实 |
|---------|------|
| "我先看看代码" | 先调用阶段 skill，它告诉你如何定向 |
| "需求很清楚，直接设计吧" | sdd-task-requirements 会先读组件详设建立领域知识 |
| "设计文档够了，直接写代码" | sdd-task-develop 需要 tasks.md 作为执行依据 |
| "代码写好了，可以发布了" | 还需要经过 review 和 ST |
| "review 是走形式" | review 检查代码与 design.md 的符合性，是质量门禁 |
