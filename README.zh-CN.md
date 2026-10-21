# 绿灯之下 / Under the Green Light

[English](README.md) | 简体中文

支持多设备联机的 Guardians 协作救援剧本应用。采用 **Bun、Svelte 5、Vite、TypeScript、SQLite、Tailwind CSS**，可用 Docker Compose 自托管。

十二名维修人员被困在 The Shell 外围的潮汐泵站。海水已经涌入，屏幕却仍亮着绿色安全信号。团队需要调查证据、协调公会、选择路线，并完成通路、人员与隔离三个目标。

## 本地运行

使用 Bun 1.4.2，依赖由 `bun.lock` 固定。

```bash
bun install --frozen-lockfile
bun run dev
```

打开 Vite 输出的地址，默认 `http://localhost:5173`。开发脚本同时启动 Bun（3000）与 Vite（5173；占用时会选择下一个端口）。手机使用电脑的局域网 IP，两台设备需在同一网络，相应端口可访问。

更新 Vite 代理配置后重启 `bun run dev`。若旧服务提示“请求来源与房间地址不一致”，无需删除房间或数据库；重启后刷新页面即可。

生产模式由一个 Bun 进程提供静态资源、HTTP API 与 WebSocket：

```bash
bun run build
bun start
```

## Docker Compose

```bash
docker compose up -d
```

首次启动前，需将本次配置推送至 `main`，等待 GitHub Actions 成功发布镜像，并在 GitHub Packages 将该镜像设为 Public。之后每次推送 `main`，Actions 检查并发布 amd64 / arm64 镜像；Watchtower 默认每 60 秒检查并更新应用。PR 只验证构建。访问 `http://localhost:3000`，SQLite 保存在原命名卷 `green-light-data`。

可选将 `.env.example` 复制为 `.env`，设置 `APP_PORT`、反向代理后的 `PUBLIC_ORIGIN`、`APP_IMAGE` 和检查间隔。服务器首次切换到此配置时，在原部署目录执行上述命令，保留原 Compose 项目名以复用数据卷。源码本机构建使用：

```bash
docker compose -f compose.yaml -f compose.build.yaml up -d --build app
```

此模式不自动更新应用。首次部署、HTTPS、备份、回滚与单实例约束见 [部署说明](docs/DEPLOYMENT.md)。

## 如何游玩

1. 创建房间，选择完整 / 精简剧本、1–4 个 GM 席位与实体 / 虚拟骰。两个席位即 Co-GM。
2. 分享四位房间码、链接或二维码。房主分配 GM、玩家和观察者；成员自行选择角色分工。
3. GM 开始任务。系统同步背景、证据、NPC 消息和任务提示，支持按需朗读。完整版有三次准备检定，精简版跳过准备骰。
4. 协商、路线和补救使用预设投票，由 GM 手动结束并公开计票。结束前隐藏选择，玩家可随时改票，全员投完也不会自动关闭。平票由 GM 说明理由并裁决。
5. GM 公布预设或自定义行动、备用方案、依据与 DC。玩家选择申请 / 协助；系统从申请者中随机选一人。虚拟版仅这位玩家可掷骰；实体版由 GM 录入 1–20。
6. 系统结算五档后果；执行失败且还有物资时自动发起补救投票。每次最多提升一档，两份物资不会因重试重复扣除。三个目标顺序可调整。
7. 所有成员（含玩家与观察者）都可编辑交接、生成事实草稿，并先保存未完成的内容。实际通报、具名负责人和更新时间齐全后，由 GM 进入共同复盘。支持交接文本、GM 完整 JSON 存档导出，以及从存档建立新房间。

明暗主题自动跟随浏览器偏好，并在偏好变化时即时更新。语言按每台设备的浏览器首选顺序匹配中英文，均不匹配时使用英文；浏览器语言变化时，界面立即同步。语言按钮仍可临时切换，直到浏览器语言再次改变或刷新页面；旧版保存的语言选择不再覆盖浏览器设置。

界面图标统一使用 Font Awesome Free 实心 SVG，按图标导入并随应用本地打包，由 `src/components/Icon.svelte` 渲染；品牌标记与 favicon 使用其中的 shield-heart。虚拟掷骰仅让 D20 图形旋转 700 毫秒，结果点数保持静止；连接中的状态图标才持续旋转。系统启用减少动态效果时关闭动画。署名与许可证见 [Font Awesome Free](public/licenses/Font-Awesome-Free.txt)。

中英文通过同一组 ID 同步。自定义方案、笔记、通报和反思保留输入原文。玩家不会收到主持私密上下文与笔记。课堂计时与故事的十二分钟分别处理。

## 同步与恢复

SQLite 是权威存档；WebSocket 推送按成员权限裁剪的完整快照。浏览器保存自己的凭证与最后快照，刷新或重连恢复原身份。断线保留阅读并暂停写入；恢复后获取服务器状态。已实现心跳、退避重连、前台唤醒同步、HTTP 快照补取和多标签页在线统计。

写命令有独立 ID，数据库事务同时保存进度和去重记录。GM 操作检查版本，冲突返回最新状态；玩家投票和申请绑定具体 ID，可并发提交。详见 [实现与协议](docs/ARCHITECTURE.md)。

## 检查

```bash
bun run check
bun test tests
bun run build
# 或执行以上全部
bun run verify
```

测试覆盖规则、资源幂等、权限、投票保密、SQLite 重启、HTTP 完整游玩与真实 WebSocket 断开重连。[验证记录](docs/QA.md) 区分自动测试、浏览器检查和未执行的环境检查。

## 目录与材料

```text
src/                         Svelte 界面、语言切换、浏览器同步
shared/                      公共双语剧本、协议类型、结果展示
server/                      Bun 服务、状态机、SQLite、GM 私密上下文
tests/                       规则、存档、权限、协议与联机测试
public/                      精选公开资源与字体许可证
content/scenario.zh-CN.json   原开发种子，保持原草案边界
docs/                        世界背景、规则交接、实现与部署说明
materials/                   参考原件与原剧本草案，不进入运行镜像或公开资源
tools/                       文档工具与开发启动脚本
```

网页双语改编为 `shared/content.ts` 的 1.0.0 版本；原 Word、玩家包、流程图和开发种子保持原样。改编映射见 [决定记录](docs/DECISIONS.md)。

参考 [项目说明](docs/PROJECT_BRIEF.md)、[世界与课程](docs/WORLD_AND_COURSE.md)、[开发交接](docs/DEVELOPMENT_HANDOFF.md)、[来源与使用范围](docs/SOURCES.md)。课程规则、世界既有设定、本剧本虚构事实与场次约定分别记录；游戏不会生成伦理总分或课程成绩。

文档维护仍使用 `requirements-docs.txt`：

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-docs.txt
python tools/extract_materials.py
python tools/build_documents.py --output /tmp/under-the-green-light-docs
```

`build_documents.py` 再现原作者草案，不会读回后续人工 Word 修改；默认生成到临时目录。
