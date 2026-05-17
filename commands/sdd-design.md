---
description: "SDD 设计阶段：基于 srs.md 生成 AR 详细设计文档 design.md"
---

加载 `sdd-task-design` skill，直接进入详细设计阶段。

跳过路由检测，强制执行设计阶段流程：
1. 重建领域知识（读取组件详设 + srs.md + 现有接口）
2. 提出 1-3 个实现方案供用户选择
3. 逐节进行设计审批（接口定义、算法、边界条件、错误处理）
4. 生成 design.md，并对齐 tasks.md 中的任务列表

**前置条件：** `specs/changes/ARxxx/srs.md` 必须已存在。

$ARGUMENTS
