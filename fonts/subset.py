#!/usr/bin/env python3
# 子集化构建小程序画布用的单文件 WOFF 字体（用法见 fonts/README.md）
# 源字体：思源宋体 Noto Serif SC（OFL）、霞鹜文楷 LXGW WenKai（OFL）
# 字符集：GB2312 全字符集（约 7400 字，含一二级汉字与全角标点）+ ASCII
import os
import sys

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = HERE  # 产物直接写入 fonts/
SRC = os.getcwd()  # 源字体（约 25MB 的 TTF）放在临时构建目录，从该目录运行本脚本


# Python 的 gb2312 codec 与字体厂商的 GB2312 实现有个别出入（如破折号
# A1AA 在 codec 里是 U+2015，而字库里是 U+2014「—」），显式补上常用符号
EXTRA = '—–·…‰℃°€£¥§©®™±×÷≈≠≤≥∞√∠※↑↓→←①②③④⑤⑥⑦⑧⑨⑩'


def build_charset():
    chars = set(chr(c) for c in range(0x20, 0x7F))  # 可打印 ASCII
    chars.update(EXTRA)
    for b1 in range(0xA1, 0xF8):                    # GB2312 双字节区
        for b2 in range(0xA1, 0xFF):
            try:
                chars.add(bytes([b1, b2]).decode('gb2312'))
            except UnicodeDecodeError:
                pass
    return ''.join(sorted(chars))


def rename(font, family, subfamily='Regular'):
    # 子集属修改版，按 OFL 要求不使用原保留字体名（RFN），改用自有名称
    name = font['name']
    for nid in (1, 2, 3, 4, 6, 16, 17, 18):
        name.removeNames(nameID=nid)
    full = family + ' ' + subfamily
    ps = full.replace(' ', '')
    for plat, enc, lang in ((3, 1, 0x409), (1, 0, 0)):
        name.setName(family, 1, plat, enc, lang)
        name.setName(subfamily, 2, plat, enc, lang)
        name.setName(full + '; subset', 3, plat, enc, lang)
        name.setName(full, 4, plat, enc, lang)
        name.setName(ps, 6, plat, enc, lang)


def build(src, dst, family, axis=None):
    print('building', dst, '<-', src)
    font = TTFont(src)
    if axis:
        instantiateVariableFont(font, axis, inplace=True)
    opts = subset.Options()
    opts.flavor = 'woff'               # WOFF（非 woff2），兼容低版本 iOS
    opts.layout_features = '*'         # 保留 kern 等排版特性
    opts.name_IDs = ['*']              # 保留许可声明等 name 记录
    opts.notdef_outline = True
    opts.drop_tables += ['FFTM']
    ss = subset.Subsetter(options=opts)
    ss.populate(text=CHARS)
    ss.subset(font)
    rename(font, family)
    font.flavor = 'woff'  # Subsetter API 不应用 opts.flavor，需显式设置才能输出 WOFF
    font.save(dst)
    print('  ->', dst, os.path.getsize(dst) // 1024, 'KB')


CHARS = build_charset()
print('charset size:', len(CHARS))

build(os.path.join(SRC, 'NotoSerifSC-VF.ttf'),
      os.path.join(OUT, 'xw-serif.woff'), 'XW Serif', axis={'wght': 400})
build(os.path.join(SRC, 'LXGWWenKai-Regular.ttf'),
      os.path.join(OUT, 'xw-kai.woff'), 'XW Kai')
