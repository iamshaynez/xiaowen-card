/**
 * 小文卡片 · 小程序 Canvas 渲染引擎
 * 移植自 web/js/card.js，保持双端版式与色彩语言一致。
 * 四种风格：冷灰笺 paper / 玄黑卡 ink / 朱砂签 cinnabar / 竖排墨 vertical
 * 色彩纪律：冷漆红 #CE1432 仅点睛（≤5%），主底永远冷灰或玄黑，玄黑底上文字用奶白。
 *
 * 与浏览器版的差异：
 * - 使用小程序 Canvas 2D（type="2d"）节点接口，canvas 为 SelectorQuery 取得的节点
 * - 排版始终按 1080 逻辑宽度计算，通过 opts.scale 把逻辑坐标映射到画布实际像素
 * - Logo 使用 canvas.createImage() 创建的 Image 对象（onload 后有 width/height）
 * - 字体使用系统字体栈：serif / KaiTi / sans-serif（不依赖网络字体）
 */

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
  lineOnInk: '#3A3530'
};

var FONTS = {
  serif: '"Songti SC","STSong",serif',
  kai: '"Kaiti SC","KaiTi","STKaiti",serif',
  hei: '"PingFang SC","Hiragino Sans GB",sans-serif'
};

var THEMES = {
  paper: {
    bg: PALETTE.paper, fg: PALETTE.ink, sub: PALETTE.subOnPaper,
    faint: PALETTE.faintOnPaper, line: PALETTE.hairOnPaper, sealFg: PALETTE.cream
  },
  ink: {
    bg: PALETTE.ink, fg: PALETTE.cream, sub: PALETTE.noteOnInk,
    faint: PALETTE.noteOnInk, line: PALETTE.lineOnInk, sealFg: PALETTE.cream
  },
  cinnabar: {
    bg: PALETTE.paper, fg: PALETTE.ink, sub: PALETTE.subOnPaper,
    faint: PALETTE.faintOnPaper, line: PALETTE.hairOnPaper, sealFg: PALETTE.cream,
    cinnabar: true
  },
  vertical: {
    bg: PALETTE.ink, fg: PALETTE.cream, sub: PALETTE.noteOnInk,
    faint: PALETTE.noteOnInk, line: PALETTE.lineOnInk, sealFg: PALETTE.cream,
    vertical: true
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

// 逐字换行（适合中日韩混排），按 \n 分段，空段保留为空行
function wrapLines(ctx, text, maxWidth) {
  var out = [];
  var paras = String(text || '').replace(/\r/g, '').split('\n');
  for (var i = 0; i < paras.length; i++) {
    var p = paras[i];
    if (p === '') { out.push(''); continue; }
    var line = '';
    for (var j = 0; j < p.length; j++) {
      var ch = p[j];
      if (line && ctx.measureText(line + ch).width > maxWidth) {
        out.push(line);
        line = ch;
      } else {
        line += ch;
      }
    }
    out.push(line);
  }
  return out;
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

function layoutHorizontal(ctx, o) {
  var W = CARD_W, pad = 96;
  var cw = W - pad * 2;
  var bodySize = o.fontSize;
  var isQuote = o.mode === 'quote';
  var lh = isQuote ? 1.8 : 2.0;
  var weight = isQuote ? 600 : 400;
  var lineH = Math.round(bodySize * lh);
  var paraGap = Math.round(bodySize * 0.7);

  ctx.font = weight + ' ' + bodySize + 'px ' + o.font;
  var lines = wrapLines(ctx, o.text, cw);

  var bodyH = 0;
  for (var i = 0; i < lines.length; i++) {
    bodyH += lines[i] === '' ? paraGap : lineH;
  }
  if (lines.length && lines[lines.length - 1] === '') bodyH -= paraGap;

  var quoteMarkH = isQuote ? Math.round(bodySize * 1.5) : 0;

  var hasHead = !!(o.logo || o.brand);
  var headH = hasHead ? 56 : 0;
  var sealSize = 84;

  var top = 88;
  var y = top;
  if (hasHead) y += headH + 44;
  y += 1 + 52;                       // 发丝线 + 间距
  y += quoteMarkH;
  var bodyTop = y;
  y += bodyH;
  y += 72;                           // 正文与落款间距
  var signH = Math.max(40, sealSize);
  var H = y + signH + 84;

  return {
    W: W, H: H, pad: pad, cw: cw, top: top, headH: headH,
    bodyTop: bodyTop, bodyH: bodyH, lines: lines, lineH: lineH,
    paraGap: paraGap, bodySize: bodySize, weight: weight,
    quoteMarkH: quoteMarkH, signY: H - 84 - signH, sealSize: sealSize,
    hasHead: hasHead
  };
}

function drawHorizontal(ctx, o, theme, L) {
  // 底色
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, L.W, L.H);

  // 朱砂签：左侧一条冷漆红发丝（点睛，≤5%）
  if (theme.cinnabar) {
    ctx.fillStyle = PALETTE.red;
    ctx.fillRect(0, 0, 10, L.H);
  }

  var x0 = L.pad;
  var y = L.top;

  /* 头部：Logo + Banner */
  if (L.hasHead) {
    var hx = x0;
    if (o.logo) {
      drawLogo(ctx, o.logo, hx, y, 56);
      hx += 56 + 22;
    }
    if (o.brand) {
      ctx.fillStyle = theme.faint;
      ctx.font = '400 30px ' + FONTS.serif;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      // 加宽字距
      var brand = String(o.brand).split('').join(' ');
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

  /* 正文 */
  ctx.font = L.weight + ' ' + L.bodySize + 'px ' + o.font;
  ctx.fillStyle = theme.fg;
  ctx.textBaseline = 'alphabetic';
  var cy = L.bodyTop;
  for (var i = 0; i < L.lines.length; i++) {
    var ln = L.lines[i];
    if (ln === '') { cy += L.paraGap; continue; }
    var baseline = cy + L.bodySize * 0.85;
    if (o.mode === 'quote') {
      ctx.textAlign = 'center';
      ctx.fillText(ln, L.W / 2, baseline);
    } else {
      ctx.textAlign = 'left';
      ctx.fillText(ln, x0, baseline);
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

  /* 落款行：左发丝短线 + 右落款 + 印章 */
  var sy = L.signY;
  ctx.strokeStyle = theme.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x0, sy + L.sealSize / 2);
  ctx.lineTo(x0 + 120, sy + L.sealSize / 2);
  ctx.stroke();

  var sealX = L.W - L.pad - L.sealSize;
  if (o.signature) {
    ctx.fillStyle = theme.sub;
    ctx.font = '400 36px ' + FONTS.serif;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('—— ' + o.signature, sealX - 30, sy + L.sealSize / 2);
  }
  var sealCh = (o.signature || '文').replace(/^——\s*/, '').charAt(0) || '文';
  drawSeal(ctx, sealX, sy, L.sealSize, sealCh, theme);
}

/* ---------- 竖排布局（从右至左） ---------- */

function layoutVertical(o) {
  var pad = 88;
  var bodySize = o.fontSize;
  var charH = Math.round(bodySize * 1.32);   // 字距
  var colW = Math.round(bodySize * 2.1);     // 列距
  var charsPerCol = 10;

  // 只取可见字符（换行转为停顿）
  var chars = String(o.text || '').replace(/\s+/g, '').split('');
  if (!chars.length) chars = ['…'];
  var cols = Math.ceil(chars.length / charsPerCol);

  var textW = cols * colW;
  var signColW = Math.round(bodySize * 2.4);
  var W = pad * 2 + textW + signColW;
  var H = pad * 2 + charsPerCol * charH + 150; // 底部留给落款/印章

  return {
    W: W, H: H, pad: pad, bodySize: bodySize, charH: charH,
    colW: colW, charsPerCol: charsPerCol, chars: chars, cols: cols,
    signColW: signColW
  };
}

function drawVertical(ctx, o, theme, L) {
  var W = L.W, H = L.H, pad = L.pad;
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, W, H);

  // 顶部品牌行
  if (o.brand) {
    ctx.fillStyle = theme.faint;
    ctx.font = '400 26px ' + FONTS.serif;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(o.brand).split('').join(' '), pad, 52);
  }
  ctx.fillStyle = PALETTE.red;
  ctx.fillRect(W - pad - 12, 44, 12, 12);

  var textTop = pad + 40;
  var right = W - pad - L.signColW;

  ctx.font = '400 ' + L.bodySize + 'px ' + o.font;
  ctx.fillStyle = theme.fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (var c = 0; c < L.cols; c++) {
    var colX = right - c * L.colW - L.colW / 2;
    for (var r = 0; r < L.charsPerCol; r++) {
      var idx = c * L.charsPerCol + r;
      if (idx >= L.chars.length) break;
      ctx.fillText(L.chars[idx], colX, textTop + r * L.charH + L.charH / 2);
    }
  }

  // 落款：最左一列，竖排小字 + 印章
  var signX = pad + L.signColW / 2 - 10;
  var sign = String(o.signature || '').replace(/^——\s*/, '');
  var sealSize = 72;
  var signTextH = sign.length * Math.round(L.bodySize * 0.9);
  var signBottom = H - pad - sealSize - 24;
  var signTop = signBottom - signTextH;

  ctx.font = '400 ' + Math.round(L.bodySize * 0.72) + 'px ' + FONTS.serif;
  ctx.fillStyle = theme.sub;
  for (var i = 0; i < sign.length; i++) {
    ctx.fillText(sign[i], signX, signTop + i * Math.round(L.bodySize * 0.9) + L.bodySize * 0.36);
  }
  drawSeal(ctx, signX - sealSize / 2, H - pad - sealSize, sealSize, sign.charAt(0) || '文', theme);
}

/* ---------- 入口 ---------- */

/**
 * 渲染卡片到小程序 Canvas 2D 节点。
 *
 * canvas: 通过 wx.createSelectorQuery().fields({node:true}) 取得的画布节点
 * opts = {
 *   style: 'paper'|'ink'|'cinnabar'|'vertical',
 *   mode: 'quote'|'long',
 *   text, signature, brand,
 *   fontFamily: 'serif'|'kai'|'hei',
 *   fontSize: number,
 *   logo: Image|null,        // canvas.createImage() 且已 onload
 *   scale: number            // 画布实际像素 / 逻辑像素（预览传 css宽*dpr/1080，导出传 1）
 * }
 * 返回 { width, height }（逻辑像素，宽恒为 1080，竖排风格除外）
 */
function render(canvas, opts) {
  opts = opts || {};
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

  var ctx = canvas.getContext('2d');

  // 1. 逻辑排版（measureText 与变换无关，按逻辑字号测量）
  var L = theme.vertical ? layoutVertical(o) : layoutHorizontal(ctx, o);

  // 2. 按缩放设置画布实际像素（会重置上下文状态），再映射回逻辑坐标
  var scale = opts.scale || 1;
  canvas.width = Math.round(L.W * scale);
  canvas.height = Math.round(L.H * scale);
  ctx.scale(scale, scale);

  // 3. 绘制（逻辑坐标）
  if (theme.vertical) drawVertical(ctx, o, theme, L);
  else drawHorizontal(ctx, o, theme, L);

  return { width: L.W, height: L.H };
}

module.exports = {
  render: render,
  PALETTE: PALETTE,
  FONTS: FONTS,
  CARD_W: CARD_W
};
