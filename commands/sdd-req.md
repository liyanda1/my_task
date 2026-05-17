---
description: "SDD 需求阶段：读取领域知识，澄清需求，生成 srs.md 和 tasks.md"
---

加载 `sdd-task-requirements` skill，直接进入需求准备与澄清阶段。

跳过路由检测，强制执行需求阶段流程：
1. 读取组件详设和现有接口，建立领域知识
2. 获取 AR 基本信息（AR 编号、主题、SR 关联）
3. 多轮澄清需求细节
4. 生成 srs.md（软件需求说明书）和 tasks.md（任务分解）

**使用场景：** 开启全新 AR，或已有 AR 需要补充需求文档。

$ARGUMENTS
