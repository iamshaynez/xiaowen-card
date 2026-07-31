/**
 * 小文卡片 · Canvas 渲染引擎
 * 八种风格：冷灰笺 paper / 玄黑卡 ink / 朱砂签 cinnabar / 月白笺 moon / 黛蓝卡 indigo / 茶烟笺 tea / 竹青笺 bamboo / 松花笺 songhua
 * 色彩纪律：冷漆红 #CE1432 仅点睛（≤5%），主底永远冷灰或玄黑，玄黑底上文字用奶白。
 */
(function (global) {
  'use strict';

  var PALETTE = {
    ink: '#141210',
    paper: '#F1F1EF',
    red: '#CE1432',
    cream: '#EDEAE3',
    subOnPaper: '#5A544C',
    faintOnPaper: '#9A948C',
    hairOnPaper: '#D8D6D1',
    brightOnInk: '#DCD7CE',
    noteOnInk: '#A39D93',
    lineOnInk: '#3A3530',
    moonBg: '#E4ECEC', moonFg: '#2E3F46', moonSub: '#5A6D75', moonFaint: '#93A4AA', moonLine: '#C4D2D4',
    indigoBg: '#232D36', indigoFg: '#D9E2E2', indigoSub: '#8C9BA0', indigoLine: '#3A4750',
    teaBg: '#EFE9DD', teaFg: '#453B31', teaSub: '#736557', teaFaint: '#A29889', teaLine: '#D9D0C1',
    bambooBg: '#E3E8DE', bambooFg: '#37473B', bambooSub: '#66776A', bambooFaint: '#99A69B', bambooLine: '#C7D0C2',
    songhuaBg: '#F1EAD6', songhuaFg: '#463C30', songhuaSub: '#7A6A52', songhuaFaint: '#A89A80', songhuaLine: '#DDD2B8'
  };

  var FONTS = {
    serif: '"Noto Serif SC","Songti SC","STSong","SimSun",serif',
    kai: '"Kaiti SC","KaiTi","STKaiti","Noto Serif SC",serif',
    hei: '"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif',
    shan: '"Ma Shan Zheng","Kaiti SC","KaiTi",cursive'
  };

  var THEMES = {
    paper: {
      bg: PALETTE.paper, fg: PALETTE.ink, sub: PALETTE.subOnPaper,
      faint: PALETTE.faintOnPaper, line: PALETTE.hairOnPaper, sealFg: PALETTE.cream
    },
    ink: {
      bg: PALETTE.ink, fg: PALETTE.cream, sub: PALETTE.noteOnInk,
      faint: PALETTE.noteOnInk, line: PALETTE.lineOnInk, sealFg: PALETTE.cream,
      cropMarks: true
    },
    cinnabar: {
      bg: PALETTE.paper, fg: PALETTE.ink, sub: PALETTE.subOnPaper,
      faint: PALETTE.faintOnPaper, line: PALETTE.hairOnPaper, sealFg: PALETTE.cream,
      cinnabar: true
    },
    moon: {
      bg: PALETTE.moonBg, fg: PALETTE.moonFg, sub: PALETTE.moonSub,
      faint: PALETTE.moonFaint, line: PALETTE.moonLine, sealFg: PALETTE.cream,
      strings: true
    },
    indigo: {
      bg: PALETTE.indigoBg, fg: PALETTE.indigoFg, sub: PALETTE.indigoSub,
      faint: PALETTE.indigoSub, line: PALETTE.indigoLine, sealFg: PALETTE.cream,
      grid: true
    },
    tea: {
      bg: PALETTE.teaBg, fg: PALETTE.teaFg, sub: PALETTE.teaSub,
      faint: PALETTE.teaFaint, line: PALETTE.teaLine, sealFg: PALETTE.cream,
      groundBand: true
    },
    bamboo: {
      bg: PALETTE.bambooBg, fg: PALETTE.bambooFg, sub: PALETTE.bambooSub,
      faint: PALETTE.bambooFaint, line: PALETTE.bambooLine, sealFg: PALETTE.cream,
      slips: true
    },
    songhua: {
      bg: PALETTE.songhuaBg, fg: PALETTE.songhuaFg, sub: PALETTE.songhuaSub,
      faint: PALETTE.songhuaFaint, line: PALETTE.songhuaLine, sealFg: PALETTE.cream,
      ruled: true
    }
  };

  var CARD_W = 1080;

  /* ---------- 工具 ---------- */

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* ---------- 行内 Markdown ---------- */

  // 匹配行首的 [label](url)，返回 {label, len} 或 null
  function matchLink(s) {
    var close = s.indexOf('](');
    if (close <= 1) return null;
    var end = s.indexOf(')', close + 2);
    if (end < 0) return null;
    return { label: s.slice(1, close), len: end + 1 };
  }

  // 行内 Markdown 解析：**粗体**、*斜体*、`行内代码`、`[链接文字](url)`
  // 产出 run 数组 [{t, b, i, c, l}]；不支持嵌套，未闭合的标记按字面文本渲染
  function parseInline(text) {
    var runs = [];
    function push(t, b, i, c, l) {
      if (!t) return;
      var last = runs[runs.length - 1];
      if (last && last.b === b && last.i === i && last.c === c && last.l === l) last.t += t;
      else runs.push({ t: t, b: b, i: i, c: c, l: l });
    }
    var plain = '', j = 0, m;
    while (j < text.length) {
      var rest = text.slice(j);
      var ch = rest.charAt(0);
      if (ch === '`' && (m = rest.indexOf('`', 1)) > 0) {
        push(plain, false, false, false, false); plain = '';
        push(rest.slice(1, m), false, false, true, false);
        j += m + 1;
      } else if (ch === '[' && (m = matchLink(rest))) {
        push(plain, false, false, false, false); plain = '';
        push(m.label, false, false, false, true);
        j += m.len;
      } else if (rest.slice(0, 2) === '**' && (m = rest.indexOf('**', 2)) > 2) {
        push(plain, false, false, false, false); plain = '';
        push(rest.slice(2, m), true, false, false, false);
        j += m + 2;
      } else if (ch === '*' && (m = rest.indexOf('*', 1)) > 1) {
        push(plain, false, false, false, false); plain = '';
        push(rest.slice(1, m), false, true, false, false);
        j += m + 1;
      } else {
        plain += ch;
        j++;
      }
    }
    push(plain, false, false, false, false);
    return runs;
  }

  // 把带样式字符流合并回 run 数组（相邻同一样式对象的字符合并）
  function mergeStyled(chars) {
    var out = [];
    for (var i = 0; i < chars.length; i++) {
      var c = chars[i];
      var last = out[out.length - 1];
      if (last && last.f === c.f) last.t += c.ch;
      else out.push({ t: c.ch, f: c.f });
    }
    return out;
  }

  // run 字体：粗体提升字重（quote 基线 600→700，long 400→600），斜体加 italic
  function runFont(f, size, stack, weight, boldWeight) {
    return (f.i ? 'italic ' : '') + (f.b ? boldWeight : weight) + ' ' + size + 'px ' + stack;
  }

  // 逐字换行（适合中日韩混排），按 \n 分段，空段保留为空行（[]）
  // 段内先解析行内 Markdown，测量时按字符所属 run 的字体累加宽度；
  // 返回行数组，每行是 [{t, f}]（f 为该 run 的样式对象），空行为 []
  function wrapLines(ctx, text, maxWidth, size, stack, weight, boldWeight) {
    var out = [];
    var paras = String(text || '').replace(/\r/g, '').split('\n');
    for (var i = 0; i < paras.length; i++) {
      var p = paras[i];
      if (p === '') { out.push([]); continue; }
      var runs = parseInline(p);
      // 展开为带样式字符流
      var chars = [];
      for (var r = 0; r < runs.length; r++) {
        for (var k = 0; k < runs[r].t.length; k++) {
          chars.push({ ch: runs[r].t.charAt(k), f: runs[r] });
        }
      }
      // 贪心断行
      var line = [], lineW = 0;
      for (var j = 0; j < chars.length; j++) {
        ctx.font = runFont(chars[j].f, size, stack, weight, boldWeight);
        var w = ctx.measureText(chars[j].ch).width;
        if (line.length && lineW + w > maxWidth) {
          out.push(mergeStyled(line));
          line = [chars[j]];
          lineW = w;
        } else {
          line.push(chars[j]);
          lineW += w;
        }
      }
      out.push(mergeStyled(line));
    }
    return out;
  }

  // 落款解析：支持两行（\n 分隔），上行多为日期/地点，下行为署名；最多取两行
  function parseSignature(signature) {
    var lines = String(signature || '').replace(/\r/g, '').split('\n');
    var out = [];
    for (var i = 0; i < lines.length; i++) {
      var s = lines[i].trim();
      if (s) out.push(s);
    }
    return out.slice(0, 2);
  }

  // 朱文印章：冷漆红方印 + 奶白字（落款首字）
  function drawSeal(ctx, x, y, size, ch, theme) {
    ctx.save();
    ctx.fillStyle = PALETTE.red;
    roundRect(ctx, x, y, size, size, size * 0.12);
    ctx.fill();
    ctx.fillStyle = theme.sealFg;
    ctx.font = '600 ' + Math.round(size * 0.58) + 'px ' + FONTS.kai;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ch, x + size / 2, y + size / 2 + size * 0.03);
    ctx.restore();
  }

  function drawLogo(ctx, img, x, y, size) {
    ctx.save();
    roundRect(ctx, x, y, size, size, size * 0.2);
    ctx.clip();
    // cover 裁切
    var s = Math.max(size / img.width, size / img.height);
    var w = img.width * s, h = img.height * s;
    ctx.drawImage(img, x + (size - w) / 2, y + (size - h) / 2, w, h);
    ctx.restore();
  }

  /* ---------- 横排布局 ---------- */

  function layoutHorizontal(ctx, o, theme) {
    var W = CARD_W, pad = 96;
    var cw = W - pad * 2;
    var bodySize = o.fontSize;
    var isQuote = o.mode === 'quote';
    var lh = isQuote ? 1.8 : 2.0;
    var weight = isQuote ? 600 : 400;
    var boldWeight = isQuote ? 700 : 600;
    var lineH = Math.round(bodySize * lh);
    var paraGap = Math.round(bodySize * 0.7);

    var lines = wrapLines(ctx, o.text, cw, bodySize, o.font, weight, boldWeight);

    var bodyH = 0;
    for (var i = 0; i < lines.length; i++) {
      bodyH += lines[i].length === 0 ? paraGap : lineH;
    }
    if (lines.length && lines[lines.length - 1].length === 0) bodyH -= paraGap;

    var quoteMarkH = isQuote ? Math.round(bodySize * 1.5) : 0;

    var hasHead = !!o.brand;
    var headH = hasHead ? 56 : 0;
    var sealSize = 84;

    // 两行落款块更高，需预留纵向空间
    var sigLines = parseSignature(o.signature);
    var sigBlockH = sigLines.length > 1 ? 26 + 14 + 34 : 36;
    // 落款为空且无 Logo 时，整个落款行（发丝线 + 落款 + 印章）不绘制也不占高度
    var hasSign = sigLines.length > 0 || !!o.logo;

    var top = 88;
    var y = top;
    if (hasHead) y += headH + 44;
    y += 1 + 52;                       // 发丝线 + 间距
    y += quoteMarkH;
    var bodyTop = y;
    y += bodyH;
    y += 72;                           // 正文与落款间距
    var signH = hasSign ? Math.max(sealSize, sigBlockH + 12) : 0;
    var H = y + signH + 84;

    return {
      W: W, H: H, pad: pad, cw: cw, top: top, headH: headH,
      bodyTop: bodyTop, bodyH: bodyH, lines: lines, lineH: lineH,
      paraGap: paraGap, bodySize: bodySize, weight: weight, boldWeight: boldWeight,
      quoteMarkH: quoteMarkH, signY: H - 84 - signH, sealSize: sealSize,
      hasHead: hasHead, hasSign: hasSign, sigLines: sigLines
    };
  }

  function renderHorizontal(canvas, o, theme) {
    var ctx = canvas.getContext('2d');
    var L = layoutHorizontal(ctx, o, theme);
    canvas.width = L.W;
    canvas.height = L.H;

    // 底色
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, L.W, L.H);

    // 朱砂签：左侧一条冷漆红发丝（点睛，≤5%）
    if (theme.cinnabar) {
      ctx.fillStyle = PALETTE.red;
      ctx.fillRect(0, 0, 10, L.H);
    }

    /* 风格签名式装饰（全部 fillRect，双端确定一致） */
    if (theme.cropMarks) {
      // 玄黑卡·四角裁切角线
      var m = 28, len = 44;
      ctx.fillStyle = theme.line;
      ctx.fillRect(m, m, len, 1);
      ctx.fillRect(m, m, 1, len);
      ctx.fillRect(L.W - m - len, m, len, 1);
      ctx.fillRect(L.W - m - 1, m, 1, len);
      ctx.fillRect(m, L.H - m - 1, len, 1);
      ctx.fillRect(m, L.H - m - len, 1, len);
      ctx.fillRect(L.W - m - len, L.H - m - 1, len, 1);
      ctx.fillRect(L.W - m - 1, L.H - m - len, 1, len);
    }
    if (theme.strings) {
      // 月白笺·青瓷弦纹（上下各双弦）
      ctx.fillStyle = theme.line;
      ctx.fillRect(L.pad, 26, L.cw, 1);
      ctx.fillRect(L.pad, 32, L.cw, 1);
      ctx.fillRect(L.pad, L.H - 33, L.cw, 1);
      ctx.fillRect(L.pad, L.H - 27, L.cw, 1);
    }
    if (theme.grid) {
      // 黛蓝卡·碑拓界格（正文与落款之间的方格网）
      var gx = Math.round(L.bodySize * 1.6);
      var gridTop = L.bodyTop - 32;
      var gridBottom = L.signY - 16;
      ctx.fillStyle = theme.line;
      for (var x = L.pad; x <= L.W - L.pad; x += gx) {
        ctx.fillRect(x, gridTop, 1, gridBottom - gridTop);
      }
      for (var gy = gridTop; gy <= gridBottom; gy += L.lineH) {
        ctx.fillRect(L.pad, gy, L.cw, 1);
      }
    }
    if (theme.groundBand) {
      // 茶烟笺·陶器底足（底部一条深色带）
      ctx.fillStyle = theme.fg;
      ctx.fillRect(0, L.H - 10, L.W, 10);
    }
    if (theme.slips) {
      // 竹青笺·竹简双纤线（左侧两道编绳）
      ctx.fillStyle = theme.fg;
      ctx.fillRect(28, L.top, 2, L.H - L.top - 84);
      ctx.fillRect(36, L.top, 2, L.H - L.top - 84);
    }
    if (theme.ruled) {
      // 松花笺·信笺横格（随正文行距的横线）
      var ruleOff = Math.round(L.lineH * 0.14);
      ctx.fillStyle = theme.line;
      for (var ry = L.bodyTop + L.lineH - ruleOff; ry < L.bodyTop + L.bodyH; ry += L.lineH) {
        ctx.fillRect(L.pad, ry, L.cw, 1);
      }
    }

    var x0 = L.pad;
    var y = L.top;

    /* 头部：Banner（Logo 不在此处，见落款处） */
    if (L.hasHead) {
      var hx = x0;
      if (o.brand) {
        ctx.fillStyle = theme.faint;
        ctx.font = '400 30px ' + FONTS.serif;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        // 加宽字距
        var brand = String(o.brand).split('').join('\u2009\u2009');
        ctx.fillText(brand, hx, y + 30);
      }
      // 头部右端红点小记
      ctx.fillStyle = PALETTE.red;
      ctx.fillRect(L.W - L.pad - 14, y + 22, 14, 14);
      y += L.headH + 44;
    }

    /* 发丝线 */
    ctx.fillStyle = theme.line;
    ctx.fillRect(x0, y, L.cw, 1);
    y += 52;

    /* 金句引号 */
    if (o.mode === 'quote') {
      ctx.fillStyle = PALETTE.red;
      ctx.font = '600 ' + Math.round(L.bodySize * 1.2) + 'px ' + FONTS.serif;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('「', x0, y);
    }

    /* 正文（支持行内 Markdown：粗体/斜体/代码 chip/链接下划线，逐 run 绘制） */
    ctx.fillStyle = theme.fg;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    var cy = L.bodyTop;
    for (var i = 0; i < L.lines.length; i++) {
      var ln = L.lines[i];
      if (ln.length === 0) { cy += L.paraGap; continue; }
      var baseline = cy + L.bodySize * 0.85;
      // 逐 run 实测行宽
      var lineW = 0;
      for (var r = 0; r < ln.length; r++) {
        ctx.font = runFont(ln[r].f, L.bodySize, o.font, L.weight, L.boldWeight);
        ln[r].w = ctx.measureText(ln[r].t).width;
        lineW += ln[r].w;
      }
      var rx = o.mode === 'quote' ? (L.W - lineW) / 2 : x0;
      for (var r2 = 0; r2 < ln.length; r2++) {
        var run = ln[r2];
        ctx.font = runFont(run.f, L.bodySize, o.font, L.weight, L.boldWeight);
        if (run.f.c) {
          // 行内代码：圆角浅底 chip（主题发丝线色铺底）
          ctx.fillStyle = theme.line;
          roundRect(ctx, rx - 6, cy - L.bodySize * 0.12, run.w + 12, L.bodySize * 1.3, L.bodySize * 0.2);
          ctx.fill();
          ctx.fillStyle = theme.fg;
        }
        // 粗体：字重提升 + 冷漆红点睛（与印章/引号同一强调色）
        if (run.f.b) ctx.fillStyle = PALETTE.red;
        ctx.fillText(run.t, rx, baseline);
        if (run.f.b) ctx.fillStyle = theme.fg;
        if (run.f.l) {
          // 链接：文字下划发丝线（主文字色），url 不显示
          ctx.fillRect(rx, Math.round(baseline + L.bodySize * 0.12), run.w, Math.max(1, Math.round(L.bodySize * 0.04)));
        }
        rx += run.w;
      }
      cy += L.lineH;
    }
    if (o.mode === 'quote') {
      ctx.fillStyle = PALETTE.red;
      ctx.font = '600 ' + Math.round(L.bodySize * 1.2) + 'px ' + FONTS.serif;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText('」', L.W - L.pad, cy - L.lineH + L.bodySize * 0.4);
    }

    /* 落款行：左发丝短线 + 右落款 + 印章（有 Logo 时 Logo 替代印章；落款为空且无 Logo 时整行不绘制） */
    if (L.hasSign) {
      var sy = L.signY;
      ctx.strokeStyle = theme.line;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x0, sy + L.sealSize / 2);
      ctx.lineTo(x0 + 120, sy + L.sealSize / 2);
      ctx.stroke();

      var sealX = L.W - L.pad - L.sealSize;
      var midY = sy + L.sealSize / 2;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      if (L.sigLines.length === 1) {
        ctx.fillStyle = theme.sub;
        ctx.font = '400 36px ' + FONTS.serif;
        ctx.fillText('—— ' + L.sigLines[0], sealX - 30, midY);
      } else if (L.sigLines.length > 1) {
        // 两行落款：上行小字（日期/地点）用三级灰，下行署名用次级灰，垂直相对印章居中
        ctx.fillStyle = theme.faint;
        ctx.font = '400 26px ' + FONTS.serif;
        ctx.fillText(L.sigLines[0], sealX - 30, midY - 20);
        ctx.fillStyle = theme.sub;
        ctx.font = '400 34px ' + FONTS.serif;
        ctx.fillText(L.sigLines[1], sealX - 30, midY + 22);
      }
      if (o.logo) {
        drawLogo(ctx, o.logo, sealX, sy, L.sealSize);
      } else {
        // hasSign 保证此处 sigLines 非空（无落款时只有 Logo 才会走到这）
        drawSeal(ctx, sealX, sy, L.sealSize, L.sigLines[0].charAt(0), theme);
      }
    }

    return canvas;
  }

  /* ---------- 入口 ---------- */

  /**
   * opts = {
   *   style: 'paper'|'ink'|'cinnabar'|'moon'|'indigo'|'tea'|'bamboo'|'songhua',
   *   mode: 'quote'|'long',
   *   text, signature, brand,
   *   fontFamily: 'serif'|'kai'|'hei'|'shan',
   *   fontSize: number,
   *   logo: HTMLImageElement|null   // 替代落款处的朱文印章（不出现在 Banner 区）
   * }
   */
  function renderCard(canvas, opts) {
    var theme = THEMES[opts.style] || THEMES.paper;
    var o = {
      mode: opts.mode || 'quote',
      text: opts.text || '',
      signature: opts.signature || '',
      brand: opts.brand || '',
      font: FONTS[opts.fontFamily] || FONTS.serif,
      fontSize: Math.max(20, Math.min(120, opts.fontSize || 56)),
      logo: opts.logo || null
    };
    if (!o.text.trim()) o.text = '请输入正文';
    return renderHorizontal(canvas, o, theme);
  }

  global.CardRenderer = {
    render: renderCard,
    PALETTE: PALETTE,
    FONTS: FONTS
  };
})(typeof window !== 'undefined' ? window : this);
