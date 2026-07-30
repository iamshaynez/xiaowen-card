# 小文卡片 · 字句成卡

把一段文字、一句金句，生成一张优雅的中文卡片图片。支持 Logo、Banner、正文、固定落款与朱文印章；字体、字号可调，八种风格；生成后可下载 PNG 或复制到剪贴板（小程序端为保存到相册）。

## 两个渠道

| 渠道 | 目录 | 说明 |
|---|---|---|
| 网页版（含 Landing Page） | `web/` | 纯静态站点，无需构建，直接打开 `web/index.html` 或任意静态服务器托管 |
| 微信小程序版 | `miniprogram/` | 原生小程序，用微信开发者工具「导入项目」选择该目录即可预览（appid 为测试号 `touristappid`） |

## 设计规范

| 角色 | HEX | 用法 |
|---|---|---|
| 玄黑 ink | `#141210` | 卡身 / 收边 / 主文字。禁整页铺黑，主底永远是冷灰 |
| 冷灰底 paper | `#F1F1EF` | 主底色、留白默认背景 |
| 冷漆红 red | `#CE1432` | 唯一强调色，面积 ≤5% 只点睛：印章 / 引号 / 红点小记。永不铺底 |
| 奶白 cream | `#EDEAE3` | 玄黑底上的一切文字与金句 |

辅助灰阶（冷灰底上）：正文次级 `#5A544C` · 三级 `#9A948C` · 发丝线 `#D8D6D1`；玄黑底上：亮字 `#DCD7CE` · 注释 `#A39D93` · 暗线 `#3A3530`。

## 八种卡片风格

- **冷灰笺 paper**：冷灰底、玄黑字，素面无装饰
- **玄黑卡 ink**：玄黑底、奶白字，四角裁切角线
- **朱砂签 cinnabar**：冷灰底，左侧一条冷漆红竖发丝
- **月白笺 moon**：月白底 `#E4ECEC`、深灰蓝字 `#2E3F46`，上下青瓷双弦纹
- **黛蓝卡 indigo**：黛蓝底 `#232D36`、浅灰青字 `#D9E2E2`，正文碑拓界格
- **茶烟笺 tea**：茶白底 `#EFE9DD`、褐灰字 `#453B31`，底部陶器底足带
- **竹青笺 bamboo**：竹青底 `#E3E8DE`、墨绿灰字 `#37473B`，左侧竹简双纤线
- **松花笺 songhua**：松花黄底 `#F1EAD6`、褐灰字 `#463C30`，正文信笺横格

八种风格共用横排版式（金句 / 长文两种模式自动支持），各有一款签名式装饰。

卡片结构：Banner → 发丝线 → 正文（金句模式带红色「」引号、居中大字；长文模式左对齐、逐字换行）→ 固定落款 + 朱文印章（取落款首行首字；上传 Logo 时由 Logo 替代印章位置）。

落款支持两行（`\n` 分隔，最多取两行）：单行保持「—— 署名」；两行为「上行小字三级灰（日期/地点）+ 下行署名次级灰」，右对齐叠排于印章左侧、垂直居中，无破折号前缀。

## 本地运行

```bash
# 网页版
cd web && python3 -m http.server 8080
# 打开 http://localhost:8080

# 小程序版：微信开发者工具 → 导入项目 → 选择 miniprogram/ 目录
```

## 目录结构

```
web/                  # 网页版 + Landing Page
  index.html
  css/style.css
  js/card.js          # Canvas 渲染引擎（版式/色彩的唯一实现来源）
  js/app.js           # 交互：控件、下载、复制剪贴板
miniprogram/          # 微信小程序版
  app.json / app.js / app.wxss / project.config.json / sitemap.json
  pages/index/        # Landing 首页
  pages/card/         # 制作页（Canvas 2D 预览 + 保存到相册）
  utils/card-renderer.js   # 渲染引擎（自 web/js/card.js 移植，版式数值保持一致）
```

## 双端差异

- 网页版字体含网络字体（Noto Serif SC / 马善政毛笔体，走国内镜像 `fonts.loli.net`），小程序版使用系统字体栈（宋体 / 楷体 / 黑体）。
- 落款输入两端一致：均为两个独立输入框（第一行日期/地点小字 / 第二行署名），渲染约定一致（`\n` 分隔、最多取两行）。
- 小程序不支持复制图片到剪贴板，以「保存到相册」替代。
- 修改卡片版式时请同步改动 `web/js/card.js` 与 `miniprogram/utils/card-renderer.js`。

## 研发流程

`main` 与 `dev` 均为保护分支，**只允许通过 Pull Request 合并**（CI 必须通过），禁止直接 push。

```bash
# 1. 日常开发：从 dev 拉特性分支
git checkout dev && git pull
git checkout -b feat/some-feature

# 2. 本地验证后推分支，开 PR 合入 dev
npm test                       # = node --test（零依赖，Node ≥ 18）
gh pr create --base dev

# 3. 发布：dev → main 的 PR 合并后，在 main 上打 tag
gh pr create --base main --head dev
git checkout main && git pull
git tag v0.x.x && git push origin v0.x.x
```

- CI（`.github/workflows/ci.yml`）：对 `main`/`dev` 的 push 与 PR 运行 JS 语法检查 + `node --test` 单元测试。
- 单元测试在 `test/`（Node 内置 `node:test`，无第三方依赖），重点守护**双端渲染一致性**——同一输入下两端引擎的绘制序列必须完全相同。
