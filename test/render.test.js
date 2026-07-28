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
  return new Proxy({
    measureText: (s) => ({ width: String(s).length * 40 }),
    fillText: (s, x, y) => calls.push({ s: String(s), x, y }),
    drawImage: (img, x, y) => calls.push({ img: true, s: '[image]', x, y })
  }, {
    get(t, k) { return k in t ? t[k] : noop; },
    set() { return true; }
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

  test(`${name}: 空落款不绘制落款文字但仍画印章`, () => {
    const { calls } = render(renderer, Object.assign({}, BASE, { signature: '' }));
    assert.strictEqual(sigTexts(calls, '——').length, 0);
    // 印章字符「文」仍应出现（兜底）
    assert.ok(sigTexts(calls, '文').length >= 1, '空落款时应绘制兜底印章字');
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
