---
description: "SDD 验收测试阶段：生成 ST 用例，执行验收测试，Go/No-Go 决策，通过后归档 AR"
---

加载 `sdd-task-st` skill，直接进入验收测试阶段。

跳过路由检测，强制执行 ST 阶段流程：
1. 从 srs.md 的验收标准生成 ST 用例（写入 st-cases.md）
2. 执行验收测试套件（含回归测试）
3. 统计需求覆盖率和测试通过率
4. Go/No-Go 决策（全部通过 → Go；有失败 → No-Go，循环修复）
5. Go 确认后：将 AR 目录从 `specs/changes/` 归档到 `specs/archive/`，提交 git commit

**前置条件：** `sdd-task-review` 已 PASS。

$ARGUMENTS
