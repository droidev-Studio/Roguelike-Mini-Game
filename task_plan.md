# 游戏规划审查任务计划

## 目标
基于 `D:\Codex\Codex game design\GAME_BUILD_SOP.md` 和当前项目 `zero_downtime_refactor` 的实际代码，审查所有主要逻辑，并输出一份可执行的游戏制作规划。规划顶部必须固定包含游戏文件架构。

## 阶段

| 阶段 | 状态 | 内容 |
|---|---|---|
| 1 | in_progress | 读取 SOP、项目结构、入口文件、配置文件 |
| 2 | pending | 审查游戏核心逻辑、UI、资产、构建方式 |
| 3 | pending | 汇总问题、继承点与制作规划 |
| 4 | pending | 生成最终中文规划与提示词 |

## 约束
- 不修改游戏实现代码。
- 不删除用户文件。
- 规划中优先遵守 SOP 的架构分层：GameSettings、spec、assets/manifest、runtime、UI 样式。
- 当前 SOP 是 2D 浏览器动作射击基线，如项目不是射击类，需要提取可复用工程规范而不是强行套用玩法。

## 错误记录
| 错误 | 尝试 | 处理 |
|---|---|---|
| PowerShell 工具不可用 | 调用 session-catchup.py | 改用文件工具和 Bash/cmd 兼容方式读取 |
| Bash/cmd Windows 路径列目录输出异常 | dir 项目目录 | 改用 Glob 定向读取关键文件 |
