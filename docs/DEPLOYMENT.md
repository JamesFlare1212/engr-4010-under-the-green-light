# 部署与运维

## Docker Compose

需要 Docker Engine 和 Docker Compose v2。

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f app
```

默认访问 `http://localhost:3000`。Dockerfile 使用已核实存在的官方 `oven/bun:1.4.2-alpine`，有 amd64 / arm64 镜像。多阶段构建执行类型检查、测试与生产构建，运行阶段以非 root 用户启动。根目录只读，SQLite 放在可写卷，转译缓存放在 `/tmp`。

可选 `cp .env.example .env`，将 `APP_PORT` 改为其他外部端口。反向代理后的 `PUBLIC_ORIGIN` 应为浏览器实际使用的地址，例如 `https://game.example.com`。直接运行 Bun 支持 `PORT` 和 `DATABASE_PATH`，默认 3000 和 `./data/green-light.sqlite`。Compose 内部与健康检查端口固定为 3000。

健康检查 `/api/health` 实际查询 SQLite。SIGTERM 会关闭 WebSocket 与数据库；服务恢复后客户端重连，命名卷保留场次与凭证摘要。

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
docker compose stop app
docker compose cp app:/data/. ./backups/
docker compose start app
```

停服复制避免遗漏 WAL 中的事务。恢复时停服，将备份中的数据库和相应 WAL / SHM 文件一同放回 `/data`，确保 bun 用户可读写，再启动。运行中备份应使用 SQLite 在线备份 API，不能只复制主文件。

更新后执行 `docker compose up -d --build`。数据库 `user_version=1`，拒绝写入高于应用支持版本的数据库。后续 schema 更新需加入显式迁移，发布前备份。

## 运行约束与验证边界

单实例课堂 / 小组应用，每房间最多 40 名成员，建议 4–8 名玩家。四位码用于邀请，权限由会话令牌决定。浏览器本地存储丢失后不能仅凭姓名找回 GM 身份，可用此前导出的存档创建新房间。无需外部账号、数据库或服务密钥。

当前环境没有 Docker Engine。交付执行了与镜像构建相同的检查、测试和生产构建，核实了官方镜像标签，未实际执行容器构建或 Compose 启动，见 [验证记录](QA.md)。
