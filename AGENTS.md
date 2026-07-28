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

**改动规则：任何版式/配色/字体栈的修改必须双端同步。** 小程序版是从 web 版逐行移植的（PALETTE / THEMES / wrapLines / drawSeal / 横排布局与风格装饰一一对应）。只改一端会造成双端卡片不一致，这是本仓库最容易犯的错误。

`opts` 字段（两端相同）：

```js
{
  style: 'paper' | 'ink' | 'cinnabar' | 'moon' | 'indigo' | 'tea' | 'bamboo' | 'songhua',  // 八种风格，共用横排版式，各有签名式装饰
  mode: 'quote' | 'long',      // 金句（居中大字+红引号）/ 长文（左对齐逐字换行）
  text, signature, brand,      // 正文 / 落款 / Banner 顶部文字
  fontFamily: 'serif'|'kai'|'hei'|('shan' 仅 web),
  fontSize: 28–88,
  logo: 图片对象 | null,       // 替代落款处印章（不在 Banner 区显示）
  scale: 1                     // 仅小程序：逻辑坐标→实际像素的缩放
}
```

排版逻辑要点：

- 排版永远按 **1080 逻辑宽度**计算；web 直接按此出图，小程序预览用 `scale = css宽 × dpr / 1080` 映射，导出用 `scale = 1`（1080px 高清 PNG，两端一致）。
- 画布高度是**先排版测量、后定尺寸**算出来的（内容自适应）。
- 换行是**逐字 measureText**（`wrapLines`），适配 CJK 混排；按 `\n` 分段，空段保留为空行（段距）。
- canvas 无 `letter-spacing`，Banner 宽字距用 `split('').join(' ')` hack，两端一致。
- 印章（`drawSeal`）：冷漆红圆角方块 + 奶白字，取落款**首行首字**（落款为空用「文」）。**上传 Logo 时由 Logo（`drawLogo`）替代印章位置**，Logo 不再出现在 Banner 区；Banner 头部只由 `brand` 文字触发。
- 落款支持两行（`parseSignature`：split `\n` → trim → 去空 → 最多取 2 行）。web 页面上是两个独立输入框（`inpSign1` / `inpSign2`，app.js 里用 `\n` 拼接），小程序端仍是一个多行 textarea。单行「—— 署名」；两行 = 上行 26px 三级灰 + 下行 34px 次级灰，右对齐相对印章垂直居中。两端数值一致，改动需同步。
- 每款风格有一款签名式装饰（在底色之后、头部之前用 fillRect 绘制，双端逐字一致）：冷灰笺素面无装饰 / 玄黑卡四角裁切角线（cropMarks）/ 朱砂签左侧冷漆红竖条（cinnabar）/ 月白笺上下青瓷双弦纹（strings）/ 黛蓝卡碑拓界格（grid）/ 茶烟笺底部陶器底足带（groundBand）/ 竹青笺左侧竹简双纤线（slips）/ 松花笺信笺横格（ruled）。

## 色彩纪律（不可违反）

| 角色 | HEX | 规则 |
|---|---|---|
| 玄黑 ink | `#141210` | 卡身/主文字。**禁整页铺黑，页面主底永远是冷灰** |
| 冷灰 paper | `#F1F1EF` | 一切页面/卡片的默认底色（是冷灰，不是暖象牙白） |
| 冷漆红 red | `#CE1432` | **唯一强调色，面积 ≤5%**：印章、引号、红点小记、朱砂签左侧 10px 竖发丝。永不铺底 |
| 奶白 cream | `#EDEAE3` | 玄黑底上的文字，**别用纯白** |

辅助灰阶：冷灰底上次级 `#5A544C`、三级 `#9A948C`、发丝线 `#D8D6D1`；玄黑底上亮字 `#DCD7CE`、注释 `#A39D93`、暗线 `#3A3530`。两端的 PALETTE 常量一字不差。

八风格的主题色值集中定义在两端 PALETTE 常量中，除上表四角色与辅助灰阶外，后五种新风格各占一组（底色 / 主文字）：月白笺 `#E4ECEC` / `#2E3F46`、黛蓝卡 `#232D36` / `#D9E2E2`、茶烟笺 `#EFE9DD` / `#453B31`、竹青笺 `#E3E8DE` / `#37473B`、松花笺 `#F1EAD6` / `#463C30`（各自还带次级、三级、发丝线，见 PALETTE 的 moon*/indigo*/tea*/bamboo*/songhua* 键）。纪律不变：主文字与底色保持足够对比，冷漆红仍是唯一点睛色（印章、引号、红点小记），永不铺底。

新增 UI 或卡片风格时，先对照这张表选色，不要引入表外颜色。

## 各端要点与坑

### Web（`web/`）

- 3 个文件职责：`index.html`（结构）、`css/style.css`（`:root` 设计令牌）、`js/card.js`（渲染）+ `js/app.js`（控件/下载/剪贴板，120ms 输入防抖）。
- 网络字体走国内镜像 `fonts.loli.net`（Noto Serif SC / Ma Shan Zheng），回退系统宋体/楷体栈。首次渲染和切字体后都等 `document.fonts.ready` 再渲染一次，避免回退字体残留在画布上。
- 复制图片用 `navigator.clipboard.write` + `ClipboardItem`，需 HTTPS 或 localhost；不支持时降级提示用「下载 PNG」。
- 用户输入（类型/风格/正文/两行落款/Banner/字体/字号/Logo）持久化在 localStorage（key `xiaowen-card-settings-v1`），`render()` 里统一保存、加载时 `restoreSettings()` 恢复并同步控件选中态。Logo 压缩为 ≤256px PNG dataURL 存储（cookie 4KB 放不下，不用 cookie）。
- 线上部署在 Zeabur 静态托管（Caddy，前置 Cloudflare 代理；随 `main` 自动发布，域名 card.xiaowenz.com）。Zeabur 默认给 js/css 等静态资源 `max-age=16070400`（186 天）强缓存，且**平台默认值优先级高于 `web/_headers`，无法覆盖**（通配符规则更是直接不生效；`_headers` 里只保留 HTML 的 `no-cache`）。因此 js/css 的缓存正确性靠**文件指纹**：**改动任何 js/css 后，必须同步 bump `index.html` 引用上的 `?v=日期` 查询串**——HTML 永远新鲜，新 URL 强制所有浏览器重拉。**`?v` 值绝不能复用已发布过的**：同一天多次发布要用 `?v=日期-r2`、`-r3` 递增（2026-07-28 真实事故：新版本沿用了上一版相同的 `?v=20260728`，URL 没变导致 Cloudflare 与浏览器继续喂旧 JS，新风格按钮点击全部不生效，以 v0.4.1 hotfix 修复）。曾因此坑造成「新 HTML + 旧 JS」混搭、脚本引用已删除的 DOM id 崩溃、预览空白（2026-07 真实事故）。

### 小程序（`miniprogram/`）

- 页面：`pages/index/`（Landing）、`pages/card/`（制作页，全部交互在 `card.js`，150ms 防抖）。
- **两块画布**：可见的 `#cardCanvas`（预览，dpr 适配）+ 离屏 `#exportCanvas`（`position:fixed; left:-2000px`，scale=1 导出）。
- Logo 必须用 **每个画布各自的 `canvas.createImage()`** 创建（不能跨画布复用 Image），`card.js` 里按 key 缓存（`_logoImgs`）。
- 异步渲染用序号 `_seq` 丢弃过期结果（Logo onload 晚到时防串图）。
- 导出链：`canvas.toTempFilePath → wx.saveImageToPhotosAlbum`，授权拒绝时 `wx.openSetting` 引导，用户取消不提示。
- 小程序不支持复制图片到剪贴板——这是有意的双端差异，用「保存到相册」替代，不要"修复"它。
- 字体只用系统栈（serif / KaiTi / sans-serif），无 `shan`；要加网络字体需 `wx.loadFontFace`。
- 用户输入持久化在 `wx.setStorageSync`（key `card-settings-v1`），`renderPreview()` 里统一保存、`onLoad` 里 `restoreSettings()` 恢复。Logo 选择后经 `wx.saveFile` 转存为持久文件再存路径（临时路径重启会失效；文件被系统清理时 `getLogo` 兜底为无 Logo）。

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

`test/render.test.js` 用记录型 stub ctx 驱动双端引擎，覆盖：色彩纪律（双端 PALETTE 一致）、8 风格 × 2 模式冒烟、内容自适应尺寸、单行/两行落款、Logo 替代印章，以及最关键的**双端渲染序列一致性**（同一 opts 下两端 fillText 序列逐字节相同）。改渲染引擎后必须跑测试——双端版式数值不一致会被一致性用例直接抓住（它曾抓到两端 Banner 字距空格字符不同的真实 bug）。

## 分支与发布（保护分支，仅 PR 合并）

`main` 和 `dev` 都是保护分支：禁止直接 push，只能走 PR 且 CI（`test` 检查）必须通过。标准流程：

1. **日常开发**：从 `dev` 切特性分支（`feat/xxx`、`fix/xxx`），推分支后开 PR → `dev`。
2. **发布**：开 PR `dev` → `main`，合并后在 `main` 上打 tag（`git tag vX.Y.Z && git push origin vX.Y.Z`）完成发布。
3. **合并后清理分支**：PR 合并后必须删除对应特性分支（远端+本地），可用 `gh pr merge <n> --merge --delete-branch` 一步完成（gh 会顺带删本地分支并切回基线分支）。遗留的已合并旧分支随时清理：先 `git branch -r --merged origin/dev` 确认已全部合并，再 `git push origin --delete <branch>` 删除。远端只保留 `main` 和 `dev` 两个常驻分支。

不要直接把提交推到 `main` 或 `dev`——保护规则会拒绝；即便有权限绕过，也违反项目流程。

## 小程序发布（CI 手动上传）

小程序代码上传走 GitHub Actions workflow `.github/workflows/mp-upload.yml`，**纯手动触发**（`workflow_dispatch`，无任何自动触发条件）。版本号在触发时以参数传入，不依赖 git tag。

```bash
# 手动触发上传（version 为上传版本号，workflow 只能跑在默认分支 main 上）
gh workflow run mp-upload.yml -f version=1.0.0

# 查看运行状态
gh run list --workflow mp-upload.yml --limit 1
```

机制与前提：

- workflow 用 `npx miniprogram-ci upload` 临时安装官方 CI 工具上传 `./miniprogram`，仓库保持零依赖。
- 凭据走仓库 Secrets：`MP_APPID`（真实 AppID）+ `MP_PRIVATE_KEY`（mp 后台「开发管理 → 开发设置 → 小程序代码上传」下载的私钥全文）。私钥不落仓库，workflow 里临时写入 `private.key` 用完即弃。
- mp 后台的代码上传 **IP 白名单必须关闭**（GitHub Actions 出口 IP 不固定，否则报 `errCode -10008 invalid ip`）。
- 上传成功后代码进入 mp 后台「版本管理」的开发版本，**提交审核和全量发布仍需人工在 mp.weixin.qq.com 点击**，普通自研小程序没有开放接口可自动化这两步。

## 工程约定

- 代码注释、commit message、文档一律中文（项目语言）；标识符英文。
- 代码风格：ES5 语法的 IIFE（web）/ `module.exports`（小程序），`var`，无分号争议——跟现有文件保持一致，**不要引入构建工具、框架或第三方依赖**，这是刻意保持的零依赖（根目录 `package.json` 仅承载 `npm test` 脚本，不是依赖入口）。
- 改完版式记得同步检查 README.md「双端差异」一节是否仍然准确。
