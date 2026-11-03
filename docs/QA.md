# 验证记录

## 自动检查

```bash
bun install --frozen-lockfile
bun run check
bun test tests
bun run build
```

`bun run verify` 依次执行类型检查、全部测试和生产构建。测试会启动临时 HTTP、WebSocket 和 Vite 代理服务，需要允许本机监听端口。

| 范围 | 测试文件 |
| --- | --- |
| 中英内容完整性、原剧本 ID / DC / 英文开场 | `tests/content.test.ts` |
| 浏览器语言顺序、地区变体、实时切换与清理 | `tests/browser-locale.test.ts` |
| 局域网 HTTP 下 UUID 回退 | `tests/ids.test.ts` |
| 五档结果、完整 / 精简流程、资源幂等、骰点更正、投票、存档校验 | `tests/engine.test.ts` |
| SQLite 重启、事务、双 GM 冲突、权限投影和交接并发 | `tests/store.test.ts` |
| 真实 HTTP / WebSocket、认证、重连、六人完整流程、静态资源和协作交接 | `tests/server.test.ts` |
| 真实 Vite HTTP / WebSocket 代理、局域网来源、跨来源拒绝及开发资料访问拒绝 | `tests/proxy.test.ts` |

GitHub Actions 在 Linux amd64 / arm64 镜像构建中执行类型检查、测试和生产构建；PR 只验证，`main` 通过后发布镜像。构建流程见 [部署说明](DEPLOYMENT.md)。

## 2026-11-02 仓库清理验证

环境为 Windows / Bun 1.4.4：

- 冻结锁文件安装、类型检查和生产构建通过，Svelte 检查 0 错误、0 警告。依赖分类调整后，锁文件解析的包及版本保持不变。
- 完整测试 60 项通过、1 项失败；失败为下文记录的已有 Windows 静态文件路径问题。新增的开发资料访问测试通过，覆盖普通 URL、`?raw`、`/@fs/` 及其 raw 形式；公开资源仍可读取。
- 在仓库外创建仅含 `server`、`shared`、`dist`、包清单和锁文件的临时运行目录。`bun install --frozen-lockfile --production` 只安装 Zod；健康检查、创建 / 加入房间、GM 导出和真实 WebSocket 认证同步通过。该检查不代替 Docker 或 Windows 静态路由验证。
- GM 剧本迁移时核对全部英文朗读台词保留；文档相对链接和结构化剧情参考的目标均存在。Python 工具、依赖声明和 pip 更新配置已移除。

## 已有人工回归

2026-10-21 的 Linux / Bun 1.4.2 验证记录包括类型检查、60 项测试和生产构建通过；后续检查的具体结果单独记录，不能据此推定其他平台通过。

此前桌面 1280×800 与手机尺寸 390×844 / 320×700 浏览器走查覆盖：

- 独立 GM / 玩家身份，中英混合设备，从创建、邀请、投票、三次执行到交接与复盘。
- 物资只消费一次，隔离失败保留已撤离人数；玩家看不到 GM 私密内容。
- 断线只读、刷新和重连恢复身份与进度；生产深层链接和虚拟骰由服务端生成。
- 邀请复制的 Clipboard API、备用复制和失败时手动选择路径；弹窗内反馈及小屏布局。
- 全员投完仍可改票，GM 手动关票后才公开结果；玩家和观察者可保存未完成交接。
- 浏览器语言与明暗偏好变化，中文字体、Font Awesome 图标、骰子动画及减少动态效果规则。

这些是历史人工验证，本次文档清理不代表重新执行了浏览器走查。

## 平台与环境限制

Windows / Bun 1.4.4 在清理前复现一项已有失败：`tests/server.test.ts` 的生产静态文件测试返回 400。`server/index.ts` 的路径边界检查使用 `/`，与 Windows 的反斜杠路径不匹配；原主分支同样失败。开发代理与生产静态服务是不同路径，不应据此将 Windows 生产模式标为通过。

历史记录中 Docker Compose 配置与 Actions 语法做过静态校验；当前环境没有 Docker Engine，未执行真实镜像构建、容器启动、Watchtower 更新或持久化恢复演练。上线按部署说明确认健康检查、数据卷、WebSocket 和更新后恢复。

手机尺寸检查不等于真实 iOS / Android 硬件测试。物理摄像头扫码、长时间后台休眠、Safari / Firefox 全套交互和公网 TLS 代理仍需对应环境验证。朗读使用设备的 Speech Synthesis；不提供离线首次加载或多实例广播。
