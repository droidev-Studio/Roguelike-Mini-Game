# 审查发现

## SOP 摘要
- SOP 面向 2D 浏览器动作射击游戏，但工程硬规则可复用。
- 必须先适配现有代码，再决定是否替换。
- 推荐固定架构：`index.html`、`game.css`、`game.js`、`GameSettings.js`、`spec/`、`assets/manifest.json`。
- 常改参数进 `GameSettings.js`；流程与内容表进 `spec/*.json`；资源路径进 `assets/manifest.json`；运行时代码不维护业务数值。
- 入口脚本顺序必须是 `GameSettings.js` 先于 `game.js`。
- 关键系统应分层：Runtime、Input、Asset、Audio、World/ECS、Spawn/Progression、Movement、Collision、Render、HUD。
- 禁止硬编码资源路径、裸数值、update 热路径 DOM 查询、直接改 state 字符串、业务逻辑硬编码按键。

## 项目结构初步
- 关键顶层文件存在：`index.html`、`game.js`、`GameSettings.js`、`game.css`、`package.json`。
- 项目包含 `node_modules` 与 `dist/index.html`，Glob 输出会被依赖目录淹没。
- 存在文档 `docs/game-ready-art-asset-brief.md`。
- 存在历史归档资源：`assets/_archive/asset-reclass-20260526-161949/...`。

## 待补充
- 入口脚本顺序。
- 当前游戏类型、核心循环和状态机。
- 当前配置是否集中。
- 当前资源 manifest 与 spec 是否存在。
- 当前 UI/HUD、AI、关卡、碰撞、输入与结算实现情况。
