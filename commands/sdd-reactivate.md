---
description: "重新激活已归档的 AR，从指定阶段开始返工"
---

你是 SDD 流程的 AR 重新激活助手。

## 输入解析

用户输入格式：`/sdd-reactivate <AR编号> <返工说明>`

- **AR 编号**：`specs/archive/` 下的目录名，如 `AR123-fix-bug`（必填）
- **返工说明**：一句话描述要改什么（必填），例如："设计文档的接口描述有误"、"实现有 bug 需要修代码"

## 执行步骤

### 1. 验证 AR 存在

检查 `specs/archive/` 下是否存在用户指定的 AR 目录：
- 存在 → 继续
- 不存在 → 列出 `specs/archive/` 下所有归档 AR，让用户确认

### 2. 移动目录

将归档目录移回进行中目录：

```bash
mv specs/archive/ARxxx-topic/ specs/changes/ARxxx-topic/
```

### 3. 解析返工意图，确定重置阶段

根据用户的返工说明，判断从哪个阶段开始返工：

| 返工说明关键词 | 重置阶段 | 需要删除/重置的文件 |
|--------------|---------|-------------------|
| 涉及需求描述、功能变更 | **requirements** | 重置 tasks.md 中相关任务为 pending |
| 涉及设计文档、接口变更 | **design** | 删除 design.md；重置 tasks.md 中相关任务为 pending |
| 仅涉及代码实现、bug 修复 | **develop** | 重置 tasks.md 中相关任务为 pending |
| 涉及测试场景、ST 遗漏 | **st** | 清除 tasks.md 中的 review 和 ST 通过记录 |
| 无法判断 | **询问用户** | — |

### 4. 执行重置

按第 3 步判断结果执行重置操作：

**重置 requirements/design 阶段时：**
- 如需删除 design.md：删除 `specs/changes/ARxxx-topic/design.md`
- 将 tasks.md 中所有任务重置为 `status: pending`（或 `status: in_progress`，根据返工说明判断）
- 清除 tasks.md 中的 review 和 ST 通过记录

**重置 develop 阶段时：**
- 将 tasks.md 中涉及修改的任务重置为 `status: pending`
- 清除 tasks.md 中的 review 和 ST 通过记录
- 保留 srs.md 和 design.md 不变

**重置 st 阶段时：**
- 仅清除 tasks.md 中的 review 和 ST 通过记录
- 保留所有文件不变

### 5. 路由到对应阶段

重置完成后，调用对应的阶段 skill：

- requirements → `sdd-router:sdd-task-requirements`
- design → `sdd-router:sdd-task-design`
- develop → `sdd-router:sdd-task-develop`
- st → `sdd-router:sdd-task-st`

## 注意事项

- 移动目录前确认 `specs/changes/` 下不存在同名目录（避免覆盖）
- 重置 tasks.md 时保留任务结构，只改状态和进度记录
- 如果返工涉及多个阶段（如"设计和代码都要改"），以最早阶段为准（design），后续阶段会在流程中自然触发

$ARGUMENTS
