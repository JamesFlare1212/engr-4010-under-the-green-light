# 依赖与工具链

## 版本来源

以下为 **2026-11-03 的仓库版本快照**，不是上游最新版本清单：

- `package.json` 声明直接依赖和允许的版本范围；例如 `svelte: ^5.46.0` 不表示当前安装的是 5.46.0。
- `bun.lock` 固定实际解析版本。开发、CI 和生产安装均使用 `bun install --frozen-lockfile`，切换分支或拉取依赖更新后也应重新执行，避免沿用旧的 `node_modules`。
- Bun 运行时由本机安装或 `Dockerfile` 的 `BUN_VERSION` 决定；`@types/bun` 只是类型声明，不会升级运行时或容器镜像。
- 以下本地检查使用 Linux x64 / Bun 1.4.4；Dockerfile 与 CI 镜像构建默认仍使用 `oven/bun:1.4.2-alpine`。本地通过不能替代容器与其他平台验证，详见 [验证记录](QA.md)。

## 应用直接依赖

| 包 | `package.json` 范围 | `bun.lock` 实际版本 | 用途 |
| --- | --- | --- | --- |
| `zod` | `^4.3.0` | 4.6.7 | 唯一生产依赖；命令、设置与存档验证 |
| `svelte` | `^5.46.0` | 5.57.2 | 前端界面 |
| `vite` | `^8.3.5` | 8.3.5 | 开发服务与生产构建 |
| `@sveltejs/vite-plugin-svelte` | `^6.2.1` | 6.2.4 | Svelte 编译与 Vite 集成 |
| `tailwindcss` | `^4.1.18` | 4.3.3 | 样式生成 |
| `@tailwindcss/vite` | `^4.1.18` | 4.3.3 | Tailwind CSS 的 Vite 集成 |
| `typescript` | `^5.9.3` | 5.9.3 | TypeScript 类型检查 |
| `svelte-check` | `^4.3.4` | 4.7.7 | Svelte 与前端类型检查 |
| `@types/bun` | `^1.4.4` | 1.4.4 | Bun 类型声明，不是 Bun 运行时 |
| `qrcode` | `^1.5.4` | 1.5.4 | 邀请二维码 |
| `@types/qrcode` | `^1.5.6` | 1.5.6 | 二维码库类型声明 |
| `@fortawesome/free-solid-svg-icons` | `^7.3.1` | 7.3.1 | 按需打包的 Font Awesome Free 实心图标 |
| `@fontsource-variable/noto-sans-sc` | `^5.3.1` | 5.3.1 | 自托管 Noto Sans SC 可变字体 |

除 Zod 外，上述包均列入 `devDependencies`。前端运行所需代码、图标和字体在构建时进入 `dist`；生产服务端通过 `bun install --frozen-lockfile --production` 只安装 Zod。HTTP、WebSocket、SQLite 和测试运行器使用 Bun 内置支持，不另装 Express、`ws` 或 SQLite 驱动。资源署名与许可见 [来源与许可](SOURCES.md)。

## 本地额外包清理

2026-11-03 核查确认，上述 13 个直接依赖均有代码、配置或检查命令使用，未删除仍在使用的包。本地 `node_modules` 中另外存在锁文件之外的 Rollup、esbuild、Prettier、Svelte 格式化插件、TypeScript 原生平台包及相关二进制，共 9 个额外包；已定向删除这些包及对应的 3 个命令链接。另清理 Svelte 与 Tailwind 子目录中两份与根目录逐文件一致的 `magic-string` 0.30.21 重复副本，保留根目录的必需包。仓库外的干净安装也确认不需要这些额外包和重复副本即可完成检查、61 项测试和构建。

冻结安装会同步锁定版本，但不保证清除已有目录中的所有额外安装。清理时应核对实际包与锁文件，并同步处理属于这些包的命令链接；不要因为当前机器不用，就删除锁文件中为其他平台保留的可选依赖。

本次清理后执行 `bun install --lockfile-only --ignore-scripts` 重新核对锁文件，再用 `bun install --frozen-lockfile` 与 `bun run verify` 验证。由于额外包原本不在 `bun.lock` 中，锁文件内容保持不变；未为制造差异而升级依赖、添加覆盖规则或重构 Tailwind。

## Vite 8 兼容性提示

当前构建使用 Vite 8.3.5，锁定的 Rolldown 为 1.2.15。注意插件声明与实际检查是两回事：

- `@tailwindcss/vite` 4.3.3 的 `peerDependencies.vite` 已包含 Vite 8。
- `@sveltejs/vite-plugin-svelte` 6.2.4 的 Vite peer 范围仍为 `^6.3.0 || ^7.0.0`；其间接依赖 `@sveltejs/vite-plugin-svelte-inspector` 5.0.2 也未声明 Vite 8。
- 当前 Svelte 插件在类型检查、构建和开发代理测试启动时会输出 Vite 8 支持为实验性的提示，关联 [上游问题 #1143](https://github.com/sveltejs/vite-plugin-svelte/issues/1143)。

2026-11-03 的本地类型检查、61 项测试和生产构建均通过，但这不表示上述插件已正式声明兼容，也不等于完整浏览器回归。后续升级应同时核查 Svelte 插件与 inspector 的 peer 范围、开发热更新、HTTP / WebSocket 代理和生产构建，不能仅凭安装成功判定兼容。

## 部署与 CI 依赖

这些版本不由 `bun.lock` 管理：

| 配置 | 当前版本 / 设置 | 来源 |
| --- | --- | --- |
| Bun 基础镜像 | `oven/bun:1.4.2-alpine` | `Dockerfile` 的 `BUN_VERSION=1.4.2` |
| Watchtower | `nickfedor/watchtower:1.23.2` | `compose.yaml` |
| Checkout | `actions/checkout@v7` | `.github/workflows/publish-image.yaml` |
| QEMU | `docker/setup-qemu-action@v4` | 同上 |
| Buildx | `docker/setup-buildx-action@v4` | 同上 |
| GHCR 登录 | `docker/login-action@v4` | 同上 |
| 镜像构建与推送 | `docker/build-push-action@v7` | 同上 |

GitHub Actions 的主版本标签不等于固定提交 SHA。镜像构建执行 Dockerfile 中的检查，目标为 `linux/amd64` 与 `linux/arm64`；具体发布条件与 Watchtower 更新范围见 [部署说明](DEPLOYMENT.md)。

## 更新与验证约定

Dependabot 按 `.github/dependabot.yml` 每周检查 Bun 包、Docker 基础镜像、Docker Compose 镜像与 GitHub Actions；其中一类更新不会自动同步其他类别。

依赖更新后的核对流程：

1. 核对 `package.json` 和 `bun.lock`，使用冻结锁文件安装，确认本地实际版本与锁文件一致；不要在只同步文档时顺手重解析或升级依赖。
2. 核查框架、构建器和插件的 peer 范围；Bun 类型包和运行时分别核对。
3. 从仓库根目录执行：

   ```bash
   bun install --frozen-lockfile
   bun run check
   bun test tests
   bun run build
   ```

   安装后也可用 `bun run verify` 依次执行三项检查。

4. 更新本文快照与 [验证记录](QA.md)，保留历史验证环境和已知限制。若改动 Bun 基础镜像或 Compose / Actions 配置，另行验证对应部署路径，不能由本机检查推定通过。
