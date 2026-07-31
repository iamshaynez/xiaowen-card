# fonts/ — 小程序画布用网络子集字体

微信小程序原生 canvas 的 `ctx.font` 无法稳定引用系统字体名（Android 上宋体/楷体不存在，
带引号的回退列表解析也不可靠），且 `wx.loadFontFace` 只接受**单文件**字体（公开 CDN 上的
中文 webfont 全部是 unicode-range 分片，无法使用）。因此本目录存放自制的子集 WOFF，
经 jsdmirror 镜像（有 ICP 备案、CORS 放行）按 GitHub 仓库路径引用：

```
https://cdn.jsdmirror.com/gh/iamshaynez/xiaowen-card@main/fonts/xw-serif.woff
https://cdn.jsdmirror.com/gh/iamshaynez/xiaowen-card@main/fonts/xw-kai.woff
```

真机使用前需在 mp 后台把 `cdn.jsdmirror.com` 配置为 downloadFile 合法域名。

## 字体来源与许可

| 文件 | 源字体 | 家族名 | 许可 |
|---|---|---|---|
| `xw-serif.woff` | [Noto Serif SC](https://github.com/google/fonts/tree/main/ofl/notoserifsc)（思源宋体，取 wght=400 实例） | XW Serif | SIL OFL 1.1 |
| `xw-kai.woff` | [LXGW WenKai](https://github.com/lxgw/LxgwWenKai) v1.522 Regular（霞鹜文楷） | XW Kai | SIL OFL 1.1 |

两款源字体均为 SIL Open Font License，许可文本见 `OFL.txt`，字体 name 表内也保留了许可记录。
子集属修改版，按 OFL 要求不使用原保留字体名，已重命名为 XW Serif / XW Kai。

字符集：GB2312 全字符集（约 7500 字，含一二级汉字、全角标点）+ ASCII + 常用符号补丁
（Python gb2312 codec 与字库实现有个别出入，如破折号「—」U+2014，见 `subset.py`）。
字表外的生僻字由系统字体逐字兜底渲染。

## 重新生成

```bash
mkdir .font-build && cd .font-build
curl -L -o LXGWWenKai-Regular.ttf \
  https://github.com/lxgw/LxgwWenKai/releases/download/v1.522/LXGWWenKai-Regular.ttf
curl -L -o NotoSerifSC-VF.ttf \
  "https://github.com/google/fonts/raw/main/ofl/notoserifsc/NotoSerifSC%5Bwght%5D.ttf"
python3 -m venv venv && venv/bin/pip install fonttools brotli
venv/bin/python ../fonts/subset.py   # 产物写入 fonts/，用完删除 .font-build/
```
