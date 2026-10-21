# ENGR 4010 · Under the Green Light

《绿灯之下》的网页版项目准备仓库。背景来自 ENGR 4010 Lead RPG、Guardians Guild 和 Heliora Prime；当前已整理资料、剧本及玩法数据，供后续开发使用。

**当前阶段：开发交接准备完成，尚未建立 Web 应用。** 没有选定前端框架、部署平台或后端。已有 HTML 文件是可离线打开的交互流程图。

## 从哪里开始

1. 阅读 [项目说明](docs/PROJECT_BRIEF.md)，了解要开发什么和首版范围。
2. 阅读 [世界与课程背景](docs/WORLD_AND_COURSE.md)，区分既有设定与原创情节。
3. 阅读 [开发交接](docs/DEVELOPMENT_HANDOFF.md)，掌握状态、规则边界和验收场景。
4. 查看 [结构化场景数据](content/scenario.zh-CN.json) 和 [材料来源](docs/SOURCES.md)。

## 故事

The Shell 的外围潮汐泵站正在进水，控制台仍显示绿色安全状态。十二名维修人员被困，下一轮暴潮即将抵达。Guardians 需要调查旧测试数据、协调三位利益不同的 NPC，并选择救援路线。

三条示例路线是崖壁吊运、海上转运、外部泄洪；玩家也能自创方案。每条路线都要完成三个执行目标：建立通路、转移人员、隔离危险。结果分别影响人员、设施和信任。

## 材料导航

- [GM 剧本](materials/scenario/draft-v1/Under%20the%20Green%20Light%20-%20GM%20Script.docx)：中文主持说明、英文台词、分档后果、复盘和简版。
- [英文玩家包](materials/scenario/draft-v1/Under%20the%20Green%20Light%20-%20Player%20Pack.docx)：任务、证据、角色提示、事故报告。
- [交互流程图](materials/scenario/draft-v1/Under%20the%20Green%20Light%20-%20Flowchart.html)：浏览器直接打开；内嵌中文字体，可离线使用。
- [剧本文本](materials/text/scenario/gm-script.txt)、[玩家包文本](materials/text/scenario/player-pack.txt)：便于检索和开发工具读取。
- [课程与组内材料索引](materials/catalog.json)：原件、文本对应关系、材料性质及原件 SHA-256。

## 目录

```text
content/                     结构化场景数据，供后续应用导入
docs/                        产品说明、背景、开发交接、决定及来源
materials/
  course/originals/          课程 syllabus、规则、NSPE 指定读物、第6周课件
  guild/originals/           公会总部、使命、前次游戏及讨论材料
  scenario/draft-v1/         本次原创剧本、玩家包、流程图与字体许可证
  text/                     从原件提取的可搜索文本
  catalog.json              材料目录与校验值
tools/                       材料提取与 Word 文档再生成工具
```

## 维护材料

这两项工具只用于文档，不是 Web 应用依赖：

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-docs.txt
python tools/extract_materials.py
```

重新生成 Word 草案时，先指定单独的输出目录，避免覆盖人工修订：

```bash
python tools/build_documents.py --output /tmp/under-the-green-light-docs
```

`materials/catalog.json` 校验的是已收录的原件。若有意更新原件，需同步更新目录中的校验值、来源说明及结构化数据；具体规则见 [开发交接](docs/DEVELOPMENT_HANDOFF.md)。

## 使用范围

课程原件、公会作品、原创改编和字体有不同的权利归属，见 [来源与使用说明](docs/SOURCES.md)。课程材料作为本地开发参考保留，发布网页版时应挑选适合公开的内容。课纲第5页要求课程作业使用 AI 事先获得教师许可；剧本标注为 AI 辅助准备草案。

Git 已初始化为 `main` 分支；尚未配置远程仓库。
