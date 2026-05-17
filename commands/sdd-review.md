---
description: "SDD 审查阶段：S/D/C 三维合规性检查（需求符合性、设计符合性、组件规范）"
---

加载 `sdd-task-review` skill，直接进入合规性审查阶段。

跳过路由检测，强制执行审查阶段流程：
1. 收集所有被检文件（srs.md、design.md、tasks.md、src/、tests/）
2. 派发子 Agent 执行 S/D/C 三维独立审查
3. 汇总审查结论，标注每项 YES/NO 及证据
4. 给出总体 PASS / FAIL 判断

**三个维度：**
- **S（需求符合性）**：代码是否完整实现了 srs.md 中的每一条需求
- **D（设计符合性）**：实现是否与 design.md 中的接口、算法、模块划分一致
- **C（组件规范符合性）**：是否符合组件整体详设、AGENTS.md 和编码约定

**前置条件：** 所有 tasks.md 任务状态为 passing。

$ARGUMENTS
