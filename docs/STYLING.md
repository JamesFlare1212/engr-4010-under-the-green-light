# Tailwind 样式维护

## 文件职责

- `src/components/*.svelte` 与 `src/App.svelte`：布局、间距、排版、响应式和交互状态直接使用 Tailwind CSS 4 工具类。
- `src/app.css`：集中维护主题 token、Tailwind 基础样式、少量共享 `@utility` 和骰子动画配置。共享工具只通过 `@apply` 组合 Tailwind 类，不恢复按页面或组件命名的大量 CSS 选择器。
- `src/components/Icon.svelte`：接收可选的 `class`，由调用处传入尺寸、颜色、定位或动画工具类，不依赖跨组件的图标 CSS 选择器。
- `tests/styles.test.ts`：用项目实际安装的 Tailwind 编译器验证样式约定、响应式顺序、主题、焦点、选中态和动画；不增加额外测试依赖。

`@import "tailwindcss" source("./")` 将工具类扫描范围限定在 `src/`。文档、测试字符串、GM 内容和临时文件不作为生产工具类来源；如将界面移动到其他目录，应显式登记新的来源。

## 主题与基础样式

颜色在 `:root` 和 `prefers-color-scheme: dark` 中分别定义，通过 `@theme inline` 映射为 `bg-surface`、`text-muted`、`border-line` 等语义工具类。明暗偏好仍直接由 CSS 媒体查询响应，不新增本地主题状态，也不等待客户端脚本运行。

表单、基础排版、焦点轮廓和弹窗在 `@layer base` 中使用 `@apply`。`btn`、`surface`、`pill`、`choice`、`panel-heading` 等跨界面复用的小型样式组合使用 `@utility`，组件可再用普通或响应式工具类调整。业务页面的网格、侧栏、卡片布局和结果状态留在 Svelte 模板中。

保留非标准像素值的任意值工具类，是为了迁移时保持现有阅读字号和布局，而不是重新设计界面。注意 `leading-7` 是固定行高，不能替代原来的无单位 `line-height: 1.75`；需要时使用 `leading-[1.75]`。`text-[inherit]` 可能被识别为文字颜色，继承字号应写为 `[font-size:inherit]`。

## 响应式与状态

断点统一为 px，避免默认 rem 断点与任意 px 断点混用后排序不符合预期。常用断点为 `max-md`（小于 768px）、`max-lg`（小于 1024px）、`max-xl`（小于 1280px）；特别窄的手机使用 `max-[360px]`，宽屏使用 `min-[1700px]`。需维持窄屏规则在平板规则之后生效，不能靠 class 字符串的前后顺序覆盖样式。

优先复用已有的可访问属性，例如 `aria-pressed` 控制选项选中态、`aria-current="page"` 控制导航。必须由数据决定的其他状态使用条件 class 数组，并保留完整工具类字符串，不能拼接 `bg-${value}` 一类构建器无法静态发现的名字。

虚拟骰只有 SVG 使用 `motion-safe:animate-dice-roll`，结果数字不旋转；连接状态使用 `motion-safe:animate-spin`。`prefers-reduced-motion` 同时禁用动画和过渡，并把过渡时长置零。700 ms 骰子动画的关键帧仍在 Tailwind `@theme` 中集中定义。

## 少量非工具类数据

- 投票填充条的 `style:width` 来自实时票数百分比；这是运行时数据，不是静态界面 CSS。
- 海岸 SVG 的路径、渐变、填充和描边属于插图数据；二维码的绘制颜色属于 QRCode API 配置。它们不需要为了形式上的零 CSS 而拆成动态类名。
- 不新增 Svelte `<style>` 块、静态 `style` 属性或页面专属的全局选择器。

## 验证

从根目录运行 README 中的 `bun run check`、`bun test tests`、`bun run build`，或执行 `bun run verify`。样式单测会实际编译当前 `src/app.css`，检查窄屏覆盖顺序和减少动态效果的规则，而不只搜索工具类名称。

迁移时还用本机无头 Chromium 对比迁移前后构建，覆盖中英文、深浅色、移动端与桌面、主要阶段、展开表单、投票、弹窗和骰子动画。该检查不等于 Safari / Firefox、真实手机或完整人工交互验证；本次结果与限制见 [QA](QA.md)。
