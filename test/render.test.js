'use strict';

/**
 * 双端渲染引擎单元测试（node:test，零依赖）
 * 运行：node --test test/
 *
 * 用记录型 stub CanvasRenderingContext2D 在 Node 中驱动渲染：
 * - measureText 按字符数估算宽度（足以驱动逐字换行逻辑）
 * - fillText 记录全部文本与坐标，用于断言版式行为
 */

const test = require('node:test');
const assert = require('node:assert');

// Web 版渲染引擎挂在 window 上
global.window = global;
require('../web/js/card.js');
const webRenderer = global.CardRenderer;
const mpRenderer = require('../miniprogram/utils/card-renderer.js');

const RENDERERS = [
  ['web', webRenderer],
  ['miniprogram', mpRenderer]
];

function mkCtx(calls) {
  const noop = () => {};
  const state = { font: '', fillStyle: '' };
  return new Proxy({
    measureText: (s) => ({ width: String(s).length * 40 }),
    fillText: (s, x, y) => calls.push({ s: String(s), x, y, font: state.font, fillStyle: state.fillStyle }),
    fillRect: (x, y, w, h) => calls.push({ s: '[rect]', rect: true, x, y, w, h, fillStyle: state.fillStyle }),
    fill: () => calls.push({ s: '[fill]', fill: true, fillStyle: state.fillStyle }),
    drawImage: (img, x, y) => calls.push({ img: true, s: '[image]', x, y })
  }, {
    get(t, k) { return k in t ? t[k] : noop; },
    set(t, k, v) { if (k === 'font' || k === 'fillStyle') state[k] = v; return true; }
  });
}

function render(renderer, opts) {
  const calls = [];
  const canvas = { width: 0, height: 0, getContext: () => mkCtx(calls) };
  renderer.render(canvas, Object.assign({ scale: 1 }, opts));
  return { canvas, calls };
}

const BASE = {
  style: 'paper',
  mode: 'quote',
  text: '人生如逆旅，我亦是行人。',
  signature: '小文 记',
  brand: '小文卡片',
  fontFamily: 'serif',
  fontSize: 56
};

const STYLES = ['paper', 'ink', 'cinnabar', 'moon', 'indigo', 'tea', 'bamboo', 'songhua'];
const MODES = ['quote', 'long'];

/* ---------- 色彩纪律 ---------- */

test('双端 PALETTE 完全一致（色彩纪律同源）', () => {
  assert.deepStrictEqual(mpRenderer.PALETTE, webRenderer.PALETTE);
  assert.strictEqual(webRenderer.PALETTE.red, '#CE1432');
  assert.strictEqual(webRenderer.PALETTE.paper, '#F1F1EF');
  assert.strictEqual(webRenderer.PALETTE.ink, '#141210');
  assert.strictEqual(webRenderer.PALETTE.cream, '#EDEAE3');
});

/* ---------- 全路径冒烟 ---------- */

for (const [name, renderer] of RENDERERS) {
  test(`${name}: 8 风格 × 2 模式全部可渲染，横排宽恒 1080`, () => {
    for (const style of STYLES) {
      for (const mode of MODES) {
        const { canvas } = render(renderer, Object.assign({}, BASE, {
          style, mode,
          text: mode === 'long' ? BASE.text.repeat(10) : BASE.text
        }));
        assert.ok(canvas.width > 0 && canvas.height > 0, `${style}/${mode} 尺寸异常`);
        assert.strictEqual(canvas.width, 1080, `${style}/${mode} 横排宽度应为 1080`);
      }
    }
  });
}

/* ---------- 内容自适应 ---------- */

for (const [name, renderer] of RENDERERS) {
  test(`${name}: 横排高度随正文增长`, () => {
    const short = render(renderer, Object.assign({}, BASE, { mode: 'long', text: '短。' }));
    const long = render(renderer, Object.assign({}, BASE, { mode: 'long', text: BASE.text.repeat(30) }));
    assert.ok(long.canvas.height > short.canvas.height, '长文卡片应更高');
  });

  test(`${name}: 空正文兜底不崩溃`, () => {
    const { canvas } = render(renderer, Object.assign({}, BASE, { text: '  \n ' }));
    assert.ok(canvas.width > 0 && canvas.height > 0);
  });
}

/* ---------- 落款（单行 / 两行） ---------- */

function sigTexts(calls, needle) {
  return calls.filter((c) => c.s.indexOf(needle) > -1);
}

for (const [name, renderer] of RENDERERS) {
  test(`${name}: 单行落款带「—— 」前缀`, () => {
    const { calls } = render(renderer, Object.assign({}, BASE, { signature: '小文 记' }));
    const hits = sigTexts(calls, '—— 小文 记');
    assert.strictEqual(hits.length, 1);
  });

  test(`${name}: 两行落款绘制两行、无破折号、上行在下行的上方`, () => {
    const { calls } = render(renderer, Object.assign({}, BASE, { signature: '甲辰年夏\n小文 记' }));
    const up = sigTexts(calls, '甲辰年夏');
    const down = sigTexts(calls, '小文 记');
    assert.strictEqual(up.length, 1, '应绘制第一行');
    assert.strictEqual(down.length, 1, '应绘制第二行');
    assert.ok(!down[0].s.startsWith('——'), '两行模式不应有破折号前缀');
    assert.ok(up[0].y < down[0].y, '第一行应在第二行上方');
  });

  test(`${name}: 落款第三行被丢弃`, () => {
    const { calls } = render(renderer, Object.assign({}, BASE, { signature: '一\n二\n三' }));
    assert.strictEqual(sigTexts(calls, '三').length, 0);
  });

  test(`${name}: 空落款且无 Logo 时整行落款与印章都不绘制、不占高度`, () => {
    const { calls, canvas } = render(renderer, Object.assign({}, BASE, { signature: '', brand: '' }));
    const withSign = render(renderer, Object.assign({}, BASE, { brand: '' }));
    assert.strictEqual(sigTexts(calls, '——').length, 0);
    assert.strictEqual(calls.filter((c) => c.s === '文').length, 0, '空落款时不应再画兜底印章字「文」');
    assert.ok(canvas.height < withSign.canvas.height, '空落款时不应再占落款行高度');
  });

  test(`${name}: 空落款但有 Logo 时仍画 Logo`, () => {
    const logo = { width: 100, height: 100 };
    const { calls } = render(renderer, Object.assign({}, BASE, { signature: '', brand: '', logo }));
    assert.strictEqual(calls.filter((c) => c.img).length, 1);
  });
}

/* ---------- Logo 替代印章 ---------- */

for (const [name, renderer] of RENDERERS) {
  test(`${name}: 有 Logo 时画在横排印章位，不占头部、不再画印章`, () => {
    const logo = { width: 100, height: 100 };
    const withLogo = render(renderer, Object.assign({}, BASE, { brand: '', logo }));
    const noLogo = render(renderer, Object.assign({}, BASE, { brand: '' }));
    const imgs = withLogo.calls.filter((c) => c.img);
    assert.strictEqual(imgs.length, 1, 'Logo 应只绘制一次');
    assert.strictEqual(imgs[0].x, 1080 - 96 - 84, 'Logo 应位于横排印章位（右下角）');
    assert.strictEqual(noLogo.calls.filter((c) => c.img).length, 0, '无 Logo 不应绘制图片');
    assert.strictEqual(withLogo.canvas.height, noLogo.canvas.height, 'Logo 不应再占头部高度');
    // 落款为「小文 记」，印章字本应是单字「小」；有 Logo 时不应出现
    assert.strictEqual(withLogo.calls.filter((c) => c.s === '小').length, 0, '有 Logo 时不应再画印章字');
  });
}

/* ---------- 行内 Markdown ---------- */

const MD_TEXT = '这是**粗体**和*斜体*与`代码`加[链接](https://card.xiaowenz.com)。';

for (const [name, renderer] of RENDERERS) {
  test(`${name}: 行内 Markdown 标记符号不进入绘制文本`, () => {
    for (const mode of MODES) {
      const { calls } = render(renderer, Object.assign({}, BASE, { mode, text: MD_TEXT }));
      const texts = calls.filter((c) => !c.rect && !c.img).map((c) => c.s).join('');
      assert.ok(texts.indexOf('**') === -1, `${mode} 不应绘制 ** 标记`);
      assert.ok(texts.indexOf('`') === -1, `${mode} 不应绘制 \` 标记`);
      assert.ok(texts.indexOf('](') === -1 && texts.indexOf('card.xiaowenz.com') === -1, `${mode} 不应绘制链接标记与 url`);
      for (const frag of ['粗体', '斜体', '代码', '链接']) {
        assert.ok(texts.indexOf(frag) > -1, `${mode} 应绘制「${frag}」`);
      }
    }
  });

  test(`${name}: 粗体提升字重并着冷漆红（long 600 / quote 700），斜体加 italic`, () => {
    const long = render(renderer, Object.assign({}, BASE, { mode: 'long', text: MD_TEXT }));
    const boldLong = long.calls.filter((c) => c.s === '粗体');
    assert.strictEqual(boldLong.length, 1);
    assert.ok(boldLong[0].font.indexOf('600 ') === 0, `long 粗体应为 600 字重，实际 ${boldLong[0].font}`);
    assert.strictEqual(boldLong[0].fillStyle, webRenderer.PALETTE.red, '粗体应着冷漆红');
    // 粗体之后的普通 run 应恢复主文字色
    const afterBold = long.calls.filter((c) => c.s === '和');
    assert.strictEqual(afterBold.length, 1);
    assert.strictEqual(afterBold[0].fillStyle, webRenderer.PALETTE.ink, '粗体后应恢复主文字色');
    const italic = long.calls.filter((c) => c.s === '斜体');
    assert.strictEqual(italic.length, 1);
    assert.ok(italic[0].font.indexOf('italic ') === 0, `斜体应带 italic，实际 ${italic[0].font}`);

    const quote = render(renderer, Object.assign({}, BASE, { mode: 'quote', text: MD_TEXT }));
    const boldQuote = quote.calls.filter((c) => c.s === '粗体');
    assert.strictEqual(boldQuote.length, 1);
    assert.ok(boldQuote[0].font.indexOf('700 ') === 0, `quote 粗体应为 700 字重，实际 ${boldQuote[0].font}`);
  });

  test(`${name}: 行内代码画浅底 chip，链接画下划线（发色均在主题色板内）`, () => {
    const { calls } = render(renderer, Object.assign({}, BASE, { mode: 'long', text: MD_TEXT }));
    const code = calls.filter((c) => c.s === '代码');
    assert.strictEqual(code.length, 1);
    // chip：主题发丝线色（paper 主题 hairOnPaper）的圆角矩形填充（roundRect + fill）
    const chips = calls.filter((c) => c.fill && c.fillStyle === webRenderer.PALETTE.hairOnPaper);
    assert.ok(chips.length >= 1, '应有代码 chip 底块');
    // 下划线：主文字色、细高的矩形，宽度与链接文字一致
    const link = calls.filter((c) => c.s === '链接');
    assert.strictEqual(link.length, 1);
    const underlines = calls.filter((c) => c.rect && c.fillStyle === webRenderer.PALETTE.ink && c.h <= 4 && c.w === 2 * 40);
    assert.strictEqual(underlines.length, 1, '链接文字下应有一条下划线');
  });

  test(`${name}: 未闭合的 Markdown 标记按字面文本渲染`, () => {
    const { calls } = render(renderer, Object.assign({}, BASE, { mode: 'long', text: '这是**未闭合的标记[链](缺' }));
    const texts = calls.filter((c) => !c.rect && !c.img).map((c) => c.s).join('');
    assert.ok(texts.indexOf('这是**未闭合的标记[链](缺') > -1, '未闭合标记应原样绘制');
  });
}

/* ---------- 双端一致性 ---------- */

test('双端渲染序列完全一致（同一 opts 同一 fillText 序列）', () => {
  for (const style of STYLES) {
    for (const mode of MODES) {
      const opts = Object.assign({}, BASE, {
        style, mode,
        signature: '甲辰年夏\n小文 记',
        text: mode === 'long' ? BASE.text.repeat(5) : BASE.text
      });
      const a = render(webRenderer, opts);
      const b = render(mpRenderer, opts);
      assert.strictEqual(a.canvas.width, b.canvas.width, `${style}/${mode} 宽度不一致`);
      assert.strictEqual(a.canvas.height, b.canvas.height, `${style}/${mode} 高度不一致`);
      assert.deepStrictEqual(
        a.calls.map((c) => c.s),
        b.calls.map((c) => c.s),
        `${style}/${mode} 绘制文本序列不一致`
      );
    }
  }
});

test('双端一致性：含行内 Markdown 的正文（文本序列 + 字体风格前缀）', () => {
  for (const style of STYLES) {
    for (const mode of MODES) {
      const opts = Object.assign({}, BASE, { style, mode, text: MD_TEXT });
      const a = render(webRenderer, opts);
      const b = render(mpRenderer, opts);
      assert.strictEqual(a.canvas.height, b.canvas.height, `${style}/${mode} 高度不一致`);
      assert.deepStrictEqual(
        a.calls.map((c) => c.s),
        b.calls.map((c) => c.s),
        `${style}/${mode} 绘制序列不一致`
      );
      // 两端字体栈不同，只比较 px 前的风格/字重前缀（italic、400/600/700）
      assert.deepStrictEqual(
        a.calls.map((c) => (c.font || '').split('px')[0]),
        b.calls.map((c) => (c.font || '').split('px')[0]),
        `${style}/${mode} 字体风格前缀序列不一致`
      );
    }
  }
});
