---
description: "SDD 主入口：自动检测当前组件工程状态，路由到正确的开发阶段"
---

加载 `sdd-router` skill。

检测当前组件工程的 `specs/` 目录状态，根据以下规则自动路由到对应阶段：

- 无 AR 目录 → 需求澄清阶段（sdd-task-requirements）
- 有 AR，srs.md 缺失 → 需求澄清阶段
- srs.md 存在，design.md 缺失 → 详细设计阶段（sdd-task-design）
- design.md 存在，有 pending 任务 → 开发阶段（sdd-task-develop）
- 所有任务 passing，review 未完成 → 合规审查阶段（sdd-task-review）
- review PASS，ST 未完成 → 验收测试阶段（sdd-task-st）

$ARGUMENTS
