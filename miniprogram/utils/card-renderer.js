/**
 * 小文卡片 · 小程序 Canvas 渲染引擎
 * 移植自 web/js/card.js，保持双端版式与色彩语言一致。
 * 八种风格：冷灰笺 paper / 玄黑卡 ink / 朱砂签 cinnabar / 月白笺 moon / 黛蓝卡 indigo / 茶烟笺 tea / 竹青笺 bamboo / 松花笺 songhua
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
  lineOnInk: '#3A3530',
  moonBg: '#E4ECEC', moonFg: '#2E3F46', moonSub: '#5A6D75', moonFaint: '#93A4AA', moonLine: '#C4D2D4',
  indigoBg: '#232D36', indigoFg: '#D9E2E2', indigoSub: '#8C9BA0', indigoLine: '#3A4750',
  teaBg: '#EFE9DD', teaFg: '#453B31', teaSub: '#736557', teaFaint: '#A29889', teaLine: '#D9D0C1',
  bambooBg: '#E3E8DE', bambooFg: '#37473B', bambooSub: '#66776A', bambooFaint: '#99A69B', bambooLine: '#C7D0C2',
  songhuaBg: '#F1EAD6', songhuaFg: '#463C30', songhuaSub: '#7A6A52', songhuaFaint: '#A89A80', songhuaLine: '#DDD2B8'
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

  var hasHead = !!o.brand;
  var headH = hasHead ? 56 : 0;
  var sealSize = 84;

  // 两行落款块更高，需预留纵向空间
  var sigLines = parseSignature(o.signature);
  var sigBlockH = sigLines.length > 1 ? 26 + 14 + 34 : 36;

  var top = 88;
  var y = top;
  if (hasHead) y += headH + 44;
  y += 1 + 52;                       // 发丝线 + 间距
  y += quoteMarkH;
  var bodyTop = y;
  y += bodyH;
  y += 72;                           // 正文与落款间距
  var signH = Math.max(sealSize, sigBlockH + 12);
  var H = y + signH + 84;

  return {
    W: W, H: H, pad: pad, cw: cw, top: top, headH: headH,
    bodyTop: bodyTop, bodyH: bodyH, lines: lines, lineH: lineH,
    paraGap: paraGap, bodySize: bodySize, weight: weight,
    quoteMarkH: quoteMarkH, signY: H - 84 - signH, sealSize: sealSize,
    hasHead: hasHead, sigLines: sigLines
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

  /* 落款行：左发丝短线 + 右落款 + 印章（有 Logo 时 Logo 替代印章） */
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
    var sealCh = (L.sigLines[0] || '文').charAt(0);
    drawSeal(ctx, sealX, sy, L.sealSize, sealCh, theme);
  }
}

/* ---------- 入口 ---------- */

/**
 * 渲染卡片到小程序 Canvas 2D 节点。
 *
 * canvas: 通过 wx.createSelectorQuery().fields({node:true}) 取得的画布节点
 * opts = {
 *   style: 'paper'|'ink'|'cinnabar'|'moon'|'indigo'|'tea'|'bamboo'|'songhua',
 *   mode: 'quote'|'long',
 *   text, signature, brand,
 *   fontFamily: 'serif'|'kai'|'hei',
 *   fontSize: number,
 *   logo: Image|null,        // canvas.createImage() 且已 onload；替代落款处的朱文印章（不出现在 Banner 区）
 *   scale: number            // 画布实际像素 / 逻辑像素（预览传 css宽*dpr/1080，导出传 1）
 * }
 * 返回 { width, height }（逻辑像素，宽恒为 1080）
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
  var L = layoutHorizontal(ctx, o);

  // 2. 按缩放设置画布实际像素（会重置上下文状态），再映射回逻辑坐标
  var scale = opts.scale || 1;
  canvas.width = Math.round(L.W * scale);
  canvas.height = Math.round(L.H * scale);
  ctx.scale(scale, scale);

  // 3. 绘制（逻辑坐标）
  drawHorizontal(ctx, o, theme, L);

  return { width: L.W, height: L.H };
}

module.exports = {
  render: render,
  PALETTE: PALETTE,
  FONTS: FONTS,
  CARD_W: CARD_W
};
