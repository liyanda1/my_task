# 工作记忆

## 用户信息

- 华为内部工程师，使用 Windows 11
- 偏好结构化分步流程，要求详细文档说明
- 开发工具：OpenCode（内部平台），非 WorkBuddy/Claude Code

## 当前项目

**工程路径：** `d:/application/Google_chrome/谷歌浏览器下载/longtaskforagent`

**项目描述：** 将 long-task-agent SDD 框架改造为符合部门 IPD/SDD 规范的开发流程范式。

### 改造状态（2026-04-16 完成）

已创建 6 个新 Skill，全部替换 long-task-* 系列（旧文件已全部清理）：

| Skill | 职责 |
|-------|------|
| sdd-router | 路由器：检测 AR 目录状态 → 分发阶段 skill |
| sdd-task-requirements | 准备 + 需求澄清：读域知识 + srs.md + tasks.md |
| sdd-task-design | 设计：基于 srs.md 生成 design.md |
| sdd-task-develop | 开发：TDD 逐任务实现（基于 tasks.md）|
| sdd-task-review | 审查：子 Agent 合规性检查（S/D/C 三维）|
| sdd-task-st | ST：验收测试 + 归档 AR |

### 目录结构约定

```
component/
├── AGENTS.md（可选，有则读）
├── include/
├── src/
├── tests/
└── specs/
    ├── component-detail-design/组件_spec.md（已有，必读）
    ├── changes/ARxxx-topic/（进行中 AR：srs.md、design.md、tasks.md）
    └── archive/ARxxx-topic/（归档 AR：srs.md、design.md、st-cases.md）
```

### 关键约定

- design.md 有部门模板（用户待提供，暂用内置模板）
- srs.md 无模板，用内置格式
- tasks.md 用 Markdown 格式（非 JSON）
- AR 编号由用户提供（格式自由）
- ST 通过后：`specs/changes/ARxxx/` → `specs/archive/ARxxx/`（tasks.md 不归档）

### OpenCode 适配（2026-04-18 完成）

`.opencode/` 目录下提供完整的三维适配：

**Command（`.opencode/commands/`）**：6 个 slash command
- `/sdd` — 主入口（自动路由）
- `/sdd-req`、`/sdd-design`、`/sdd-dev [任务ID]`、`/sdd-review`、`/sdd-st` — 各阶段直连

**Agent（`.opencode/agents/`）**：2 个专属代理
- `@sdd-build` — 主流程代理（primary，全工具权限，sdd-* skill allow）
- `@sdd-reviewer` — 只读审查子代理（subagent，全工具关闭，用于 S/D/C 三维审查）

**Plugin**：不适配（OpenCode plugin 是 JS/TS 工具扩展，本流程无需新增原生工具）

使用时将 `.opencode/` 目录整体复制到目标组件工程根目录。

### skill-creator OpenCode 适配（2026-04-22 完成）

将 skill-creator 的 3 个 Python 脚本从 `claude -p` CLI 改造为 `opencode run` CLI：
- `run_eval.py`：`claude -p` → `opencode run --format json`，`.claude/` → `.opencode/`
- `improve_description.py`：`claude -p` → `opencode run --format default`
- `run_loop.py`：import 更新

OpenCode `--format json` 事件格式（实测确认）：
- nd-JSON（每行一个 JSON 对象）
- 事件类型：`step_start`、`tool_use`、`text`、`step_finish`
- tool_use 结构：`{"type":"tool_use","part":{"type":"tool","tool":"<工具名>","state":{"status":"completed","input":{...},"output":"..."}}}`
- step_finish.reason：`"stop"` 或 `"tool-calls"`
