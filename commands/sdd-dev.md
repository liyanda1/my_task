---
description: "SDD 开发阶段：TDD 逐任务实现，每任务 Red→Green→Refactor 循环"
---

加载 `sdd-task-develop` skill，直接进入代码开发阶段。

跳过路由检测，强制执行开发阶段流程：
1. 从 tasks.md 选取下一个 pending 任务
2. 读取 design.md 对应设计节和 srs.md 对应需求
3. TDD 循环：Red（写失败测试）→ Green（最小实现）→ Refactor（重构）
4. 质量门禁：覆盖率达标，无新增警告
5. 更新 tasks.md 状态为 passing，提交 git commit

**前置条件：** `specs/changes/ARxxx/design.md` 和 `tasks.md` 必须已存在。

如需从特定任务开始，可附加任务 ID，例如：`/sdd-dev T003`

$ARGUMENTS
