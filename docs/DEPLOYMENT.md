# 部署与运维

## Docker Compose

需要 Docker Engine 和 Docker Compose v2 或更新版本。默认从 GHCR 拉取应用镜像，并启动 Watchtower。

首次部署先完成下节的 GitHub 设置，确认镜像已发布且可匿名拉取，再在服务器执行：

```bash
docker compose up -d
docker compose ps
docker compose logs -f app watchtower
```

默认访问 `http://localhost:3000`。Dockerfile 使用已核实存在的官方 `oven/bun:1.4.2-alpine`，有 amd64 / arm64 镜像。多阶段构建执行类型检查、测试与生产构建，运行阶段以非 root 用户启动。根目录只读，SQLite 放在可写卷，转译缓存放在 `/tmp`。

可选 `cp .env.example .env`，将 `APP_PORT` 改为其他外部端口。反向代理后的 `PUBLIC_ORIGIN` 应为浏览器实际使用的地址，例如 `https://game.example.com`。直接运行 Bun 支持 `PORT` 和 `DATABASE_PATH`，默认 3000 和 `./data/green-light.sqlite`。Compose 内部与健康检查端口固定为 3000。

健康检查 `/api/health` 实际查询 SQLite。SIGTERM 会关闭 WebSocket 与数据库；服务恢复后客户端重连，命名卷保留场次与凭证摘要。

## Git 推送后自动部署

部署链路：`main` 的 push → GitHub Actions → GHCR 的 `latest` → Watchtower 检查镜像摘要 → 替换应用容器。

1. 将 `.github/workflows/publish-image.yaml` 和本次 Compose 配置推送到 [项目仓库](https://github.com/JamesFlare1212/engr-4010-under-the-green-light) 的 `main`，在仓库设置中允许 GitHub Actions。工作流声明 `packages: write`，使用自动提供的 `GITHUB_TOKEN`，无需新增发布密钥。
2. 在 Actions 中等待 **Build and publish Docker image** 成功。工作流对 amd64 / arm64 执行 Dockerfile 内的类型检查、测试和构建，通过后发布 `ghcr.io/jamesflare1212/engr-4010-under-the-green-light:latest` 及 `sha-<完整提交哈希>` 标签。任何 `main` push 都触发；PR 构建不发布；手动运行仅允许 `main`，其他分支不能覆盖生产镜像。
3. 首次发布的 GHCR 包默认可能为 Private，即使源码仓库公开也要单独确认。在 GitHub 账号的 Packages 中打开 `engr-4010-under-the-green-light` → Package settings → Change visibility → Public。本配置采用公开镜像，应用与 Watchtower 都无需登录。若拉取提示 `denied`，先检查包可见性与 Actions 发布结果。参见 [GitHub Container registry 文档](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)。
4. 服务器在原部署目录拉取配置后执行 `docker compose up -d`。原先使用本地 `--build` 的部署也由该命令切换到 GHCR。保持原目录、Compose 项目名和 `green-light-data` 卷，不要使用 `down -v`。如果原先用 `-p` 指定项目名，在 `.env` 中将 `COMPOSE_PROJECT_NAME` 设为相同名称，再启动。

后续推送 `main` 时，构建发布完成后通常在下一次检查（默认 60 秒）开始更新，另需镜像下载与重启时间。`.env` 中的 `WATCHTOWER_POLL_INTERVAL` 单位为秒，修改后运行 `docker compose up -d` 应用配置。更新期间 WebSocket 短暂断开，客户端恢复后从 SQLite 继续；没有零停机或健康检查失败后的自动回滚保证。构建失败不会发布新的 `latest`。

使用维护中的 [nickfedor/watchtower 1.23.1](https://github.com/nicholas-fedor/watchtower/releases/tag/v1.23.1)；原 [containrrr/watchtower](https://github.com/containrrr/watchtower) 已归档。通过 enable 标签与 scope 限制为当前项目的应用容器，Watchtower 自身不自动更新。多套部署应在 `.env` 设置不同的 `COMPOSE_PROJECT_NAME`，并保持每套已有数据卷所属的项目名。Docker socket 挂载赋予 Watchtower 管理宿主机容器的权限，因此仅在可信 Docker 主机部署，不开放远程 Docker API。

Watchtower 更新应用镜像并复用现有容器配置。它不会拉取服务器上的 Git 工作区，也不会应用 Compose、端口、环境变量或 Watchtower 版本变更；这些配置修改需在服务器拉取仓库后重新执行 `docker compose up -d`。本配置保留旧镜像，便于手工回滚，不执行全局镜像清理。

仅从服务器源码构建时使用：

```bash
docker compose -f compose.yaml -f compose.build.yaml up -d --build app
```

覆盖文件使用本地 `green-light:local` 镜像并关闭应用的自动更新；指定 `app` 不会启动 Watchtower。若先前已启动 Watchtower，可用 `docker compose stop watchtower` 停止。切回自动部署执行 `docker compose up -d`。

## 手机、远程与 HTTPS

手机使用 `http://电脑局域网IP:3000`，同一网络且防火墙允许端口。手机打开后生成的邀请使用该地址。电脑通过 localhost 打开的邀请弹窗也可手工改为局域网地址，二维码同步重绘。

公网可在 Caddy / Nginx 之后启用 HTTPS，HTTP 和 WebSocket 共用域名。保留 Host，转发 WebSocket Upgrade，不缓存 `/api/`，连接超时大于一分钟。下面 `map` 位于 Nginx 的 `http` 块：

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}
server {
    listen 443 ssl;
    server_name game.example.com;
    # 配置自己的 TLS 证书
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $http_host;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_read_timeout 90s;
    }
}
```

TLS 在代理终止时，设置 `.env` 的 `PUBLIC_ORIGIN` 为公开 HTTPS 地址。浏览器自动使用 wss。

## 数据、备份与升级

SQLite 卷为 `green-light-data`，实际名称通常带 Compose 项目前缀。常规 `docker compose down` 保留卷；删除卷会删除场次和身份凭证。

单场交接可在应用导出 JSON，含 GM 笔记，不含登录令牌。恢复为新房间后，历史成员重新加入，房主将旧身份设为观察者。若需原样恢复所有场次与原浏览器身份，备份整个 SQLite 数据目录：

```bash
mkdir -p backups
docker compose stop watchtower app
docker compose cp app:/data/. ./backups/
docker compose start app watchtower
```

停服复制避免遗漏 WAL 中的事务，同时暂停 Watchtower，避免备份时触发更新。恢复时也先暂停 Watchtower 和应用，将备份中的数据库和相应 WAL / SHM 文件一同放回 `/data`，确保 bun 用户可读写，再启动。运行中备份应使用 SQLite 在线备份 API，不能只复制主文件。本地源码模式的命令需附带 `-f compose.yaml -f compose.build.yaml`，只停止 / 启动 `app`。

手动拉取当前部署标签并更新：

```bash
docker compose pull app
docker compose up -d app
```

暂停自动更新可执行 `docker compose stop watchtower`，恢复用 `docker compose start watchtower`。回滚时先暂停 Watchtower，将 `.env` 的 `APP_IMAGE` 改为已成功发布的 `ghcr.io/jamesflare1212/engr-4010-under-the-green-light:sha-<完整提交哈希>`，再执行上述拉取和更新命令。固定标签后，即使恢复 Watchtower 也不会继续跟踪 `latest`；重新设为 `:latest` 并运行 `docker compose up -d` 才恢复正常跟随。构建缓存和 SHA 标签均不代替数据库备份。

数据库 `user_version=1`，拒绝写入高于应用支持版本的数据库。后续 schema 更新需加入显式迁移，发布前备份；回滚应用不能自动降级数据库，必要时恢复兼容版本的备份。

## 运行约束与验证边界

单实例课堂 / 小组应用，每房间最多 40 名成员，建议 4–8 名玩家。四位码用于邀请，权限由会话令牌决定。浏览器本地存储丢失后不能仅凭姓名找回 GM 身份，可用此前导出的存档创建新房间。无需外部账号、数据库或服务密钥。

当前环境没有 Docker Engine，未实际执行容器构建、Compose 启动或 Watchtower 更新演练。具体已完成的静态校验与应用检查见 [验证记录](QA.md)。首次上线应确认 Actions 成功、应用容器 healthy，再推送一次更新确认 Watchtower 日志与房间恢复。
