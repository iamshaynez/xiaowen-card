# AGENTS.md — 小文卡片（xiaowen-card）

给未来接手本仓库的工程 Agent 的导读。先读这里，再动代码。

## 项目是什么

把中文文本（一句金句或一段长文）渲染成一张排版考究的卡片图片。两个渠道，同一套设计语言：

- `web/` — 纯静态站点：Landing Page + 内嵌在线制作台。**无构建工具、无框架、无依赖**，打开 `web/index.html` 即用。
- `miniprogram/` — 原生微信小程序（无框架）：Landing 首页 + 制作页。微信开发者工具「导入项目」选此目录（appid 为测试号 `touristappid`）。

远端仓库：https://github.com/iamshaynez/xiaowen-card （main 分支）。

## 核心架构：双端同源渲染引擎

本仓库的心脏是两个**版式数值必须保持一致的 Canvas 渲染引擎**：

| 端 | 文件 | 接口 |
|---|---|---|
| Web | `web/js/card.js` | `CardRenderer.render(canvas, opts)`，直接改 `canvas.width/height`，挂在 `window` 上 |
| 小程序 | `miniprogram/utils/card-renderer.js` | `render(canvasNode, opts)`，`module.exports` 导出，多了 `opts.scale`，返回 `{width, height}` 逻辑尺寸 |

**改动规则：任何版式/配色/字体栈的修改必须双端同步。** 小程序版是从 web 版逐行移植的（PALETTE / THEMES / wrapLines / drawSeal / 横竖排布局一一对应）。只改一端会造成双端卡片不一致，这是本仓库最容易犯的错误。

`opts` 字段（两端相同）：

```js
{
  style: 'paper' | 'ink' | 'cinnabar' | 'vertical',  // 四种风格
  mode: 'quote' | 'long',      // 金句（居中大字+红引号）/ 长文（左对齐逐字换行）
  text, signature, brand,      // 正文 / 落款 / Banner 顶部文字
  fontFamily: 'serif'|'kai'|'hei'|('shan' 仅 web),
  fontSize: 28–88,
  logo: 图片对象 | null,
  scale: 1                     // 仅小程序：逻辑坐标→实际像素的缩放
}
```

排版逻辑要点：

- 排版永远按 **1080 逻辑宽度**计算；web 直接按此出图，小程序预览用 `scale = css宽 × dpr / 1080` 映射，导出用 `scale = 1`（1080px 高清 PNG，两端一致）。
- 画布高度是**先排版测量、后定尺寸**算出来的（内容自适应）；竖排墨风格例外，是**宽度随列数自适应**（每列固定 10 字）。
- 换行是**逐字 measureText**（`wrapLines`），适配 CJK 混排；按 `\n` 分段，空段保留为空行（段距）。
- canvas 无 `letter-spacing`，Banner 宽字距用 `split('').join(' ')` hack，两端一致。
- 印章（`drawSeal`）：冷漆红圆角方块 + 奶白字，取落款**首行首字**（落款为空用「文」）。
- 落款支持两行（`parseSignature`：split `\n` → trim → 去空 → 最多取 2 行）。横排：单行「—— 署名」；两行 = 上行 26px 三级灰 + 下行 34px 次级灰，右对齐相对印章垂直居中。竖排：两行为两竖列，第一行在右、第二行在左，列底对齐，印章居中于列组下方。两端数值一致，改动需同步。

## 色彩纪律（不可违反）

| 角色 | HEX | 规则 |
|---|---|---|
| 玄黑 ink | `#141210` | 卡身/主文字。**禁整页铺黑，页面主底永远是冷灰** |
| 冷灰 paper | `#F1F1EF` | 一切页面/卡片的默认底色（是冷灰，不是暖象牙白） |
| 冷漆红 red | `#CE1432` | **唯一强调色，面积 ≤5%**：印章、引号、红点小记、朱砂签左侧 10px 竖发丝。永不铺底 |
| 奶白 cream | `#EDEAE3` | 玄黑底上的文字，**别用纯白** |

辅助灰阶：冷灰底上次级 `#5A544C`、三级 `#9A948C`、发丝线 `#D8D6D1`；玄黑底上亮字 `#DCD7CE`、注释 `#A39D93`、暗线 `#3A3530`。两端的 PALETTE 常量一字不差。

新增 UI 或卡片风格时，先对照这张表选色，不要引入表外颜色。

## 各端要点与坑

### Web（`web/`）

- 3 个文件职责：`index.html`（结构）、`css/style.css`（`:root` 设计令牌）、`js/card.js`（渲染）+ `js/app.js`（控件/下载/剪贴板，120ms 输入防抖）。
- 网络字体走国内镜像 `fonts.loli.net`（Noto Serif SC / Ma Shan Zheng），回退系统宋体/楷体栈。首次渲染和切字体后都等 `document.fonts.ready` 再渲染一次，避免回退字体残留在画布上。
- 复制图片用 `navigator.clipboard.write` + `ClipboardItem`，需 HTTPS 或 localhost；不支持时降级提示用「下载 PNG」。

### 小程序（`miniprogram/`）

- 页面：`pages/index/`（Landing）、`pages/card/`（制作页，全部交互在 `card.js`，150ms 防抖）。
- **两块画布**：可见的 `#cardCanvas`（预览，dpr 适配）+ 离屏 `#exportCanvas`（`position:fixed; left:-2000px`，scale=1 导出）。
- Logo 必须用 **每个画布各自的 `canvas.createImage()`** 创建（不能跨画布复用 Image），`card.js` 里按 key 缓存（`_logoImgs`）。
- 异步渲染用序号 `_seq` 丢弃过期结果（Logo onload 晚到时防串图）。
- 导出链：`canvas.toTempFilePath → wx.saveImageToPhotosAlbum`，授权拒绝时 `wx.openSetting` 引导，用户取消不提示。
- 小程序不支持复制图片到剪贴板——这是有意的双端差异，用「保存到相册」替代，不要"修复"它。
- 字体只用系统栈（serif / KaiTi / sans-serif），无 `shan`；要加网络字体需 `wx.loadFontFace`。

## 验证方式（无构建，零依赖）

```bash
# 单元测试：Node 内置 node:test（Node ≥ 18），CI 同款
npm test                       # = node --test

# 语法：全部 JS（CI 也跑）
for f in $(find . -name '*.js' -not -path './.git/*' -not -path './node_modules/*'); do node --check "$f"; done

# 手工验证
cd web && python3 -m http.server 8080        # 网页版
# 小程序版：微信开发者工具导入 miniprogram/
```

`test/render.test.js` 用记录型 stub ctx 驱动双端引擎，覆盖：色彩纪律（双端 PALETTE 一致）、4 风格 × 2 模式冒烟、内容自适应尺寸、单行/两行落款、竖排列序，以及最关键的**双端渲染序列一致性**（同一 opts 下两端 fillText 序列逐字节相同）。改渲染引擎后必须跑测试——双端版式数值不一致会被一致性用例直接抓住（它曾抓到两端 Banner 字距空格字符不同的真实 bug）。

## 分支与发布（保护分支，仅 PR 合并）

`main` 和 `dev` 都是保护分支：禁止直接 push，只能走 PR 且 CI（`test` 检查）必须通过。标准流程：

1. **日常开发**：从 `dev` 切特性分支（`feat/xxx`、`fix/xxx`），推分支后开 PR → `dev`。
2. **发布**：开 PR `dev` → `main`，合并后在 `main` 上打 tag（`git tag vX.Y.Z && git push origin vX.Y.Z`）完成发布。

不要直接把提交推到 `main` 或 `dev`——保护规则会拒绝；即便有权限绕过，也违反项目流程。

## 工程约定

- 代码注释、commit message、文档一律中文（项目语言）；标识符英文。
- 代码风格：ES5 语法的 IIFE（web）/ `module.exports`（小程序），`var`，无分号争议——跟现有文件保持一致，**不要引入构建工具、框架或第三方依赖**，这是刻意保持的零依赖（根目录 `package.json` 仅承载 `npm test` 脚本，不是依赖入口）。
- 改完版式记得同步检查 README.md「双端差异」一节是否仍然准确。
