# 小文卡片 · 字句成卡

把一段文字、一句金句，生成一张优雅的中文卡片图片。支持 Logo、Banner、正文、固定落款与朱文印章；字体、字号可调，四种风格；生成后可下载 PNG 或复制到剪贴板（小程序端为保存到相册）。

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

## 四种卡片风格

- **冷灰笺 paper**：冷灰底、玄黑字
- **玄黑卡 ink**：玄黑底、奶白字
- **朱砂签 cinnabar**：冷灰底，左侧一条冷漆红竖发丝
- **竖排墨 vertical**：玄黑底，正文竖排、从右至左，落款与印章居左列底部

卡片结构：Logo（可选）+ Banner → 发丝线 → 正文（金句模式带红色「」引号、居中大字；长文模式左对齐、逐字换行）→ 固定落款「—— xxx」+ 朱文印章（取落款首字）。

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
- 小程序不支持复制图片到剪贴板，以「保存到相册」替代。
- 修改卡片版式时请同步改动 `web/js/card.js` 与 `miniprogram/utils/card-renderer.js`。
