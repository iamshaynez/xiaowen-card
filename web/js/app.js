/* 小文卡片 · 网页版交互 */
(function () {
  'use strict';

  var canvas = document.getElementById('cardCanvas');
  var inpText = document.getElementById('inpText');
  var inpSign1 = document.getElementById('inpSign1');
  var inpSign2 = document.getElementById('inpSign2');
  var inpBrand = document.getElementById('inpBrand');
  var inpLogo = document.getElementById('inpLogo');
  var btnClearLogo = document.getElementById('btnClearLogo');
  var logoName = document.getElementById('logoName');
  var selFont = document.getElementById('selFont');
  var rngSize = document.getElementById('rngSize');
  var outSize = document.getElementById('outSize');
  var btnDownload = document.getElementById('btnDownload');
  var btnCopy = document.getElementById('btnCopy');
  var hint = document.getElementById('hint');
  var segMode = document.getElementById('segMode');
  var styleRow = document.getElementById('styleRow');

  var state = {
    mode: 'quote',
    style: 'paper',
    fontFamily: 'serif',
    fontSize: 56,
    logo: null,
    logoDataURL: ''
  };

  /* ---------- 输入持久化（localStorage，下次打开自动恢复） ---------- */

  var STORE_KEY = 'xiaowen-card-settings-v1';

  function saveSettings() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        mode: state.mode,
        style: state.style,
        text: inpText.value,
        sign1: inpSign1.value,
        sign2: inpSign2.value,
        brand: inpBrand.value,
        fontFamily: state.fontFamily,
        fontSize: state.fontSize,
        logo: state.logoDataURL
      }));
    } catch (e) { /* 存储不可用（隐私模式等）时静默忽略 */ }
  }

  // Logo 压缩到 256px 以内的 PNG dataURL，避免超出 localStorage 容量
  function compressLogo(img) {
    try {
      var c = document.createElement('canvas');
      var s = Math.min(1, 256 / Math.max(img.width, img.height));
      c.width = Math.max(1, Math.round(img.width * s));
      c.height = Math.max(1, Math.round(img.height * s));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/png');
    } catch (e) { return ''; }
  }

  function restoreSettings() {
    var s;
    try { s = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) { s = null; }
    if (!s) return;
    if (s.mode === 'quote' || s.mode === 'long') state.mode = s.mode;
    if (['paper', 'ink', 'cinnabar', 'vertical', 'moon', 'indigo', 'tea', 'bamboo'].indexOf(s.style) > -1) state.style = s.style;
    if (['serif', 'kai', 'hei', 'shan'].indexOf(s.fontFamily) > -1) state.fontFamily = s.fontFamily;
    if (typeof s.fontSize === 'number') state.fontSize = Math.max(28, Math.min(88, s.fontSize));
    if (typeof s.text === 'string' && s.text) inpText.value = s.text;
    if (typeof s.sign1 === 'string') inpSign1.value = s.sign1;
    if (typeof s.sign2 === 'string') inpSign2.value = s.sign2;
    if (typeof s.brand === 'string') inpBrand.value = s.brand;
    // 控件选中态
    segMode.querySelectorAll('.seg-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.mode === state.mode);
    });
    styleRow.querySelectorAll('.style-chip').forEach(function (b) {
      b.classList.toggle('active', b.dataset.style === state.style);
    });
    selFont.value = state.fontFamily;
    rngSize.value = state.fontSize;
    // Logo（压缩后的 dataURL）
    if (typeof s.logo === 'string' && s.logo) {
      state.logoDataURL = s.logo;
      var img = new Image();
      img.onload = function () { state.logo = img; render(); };
      img.src = s.logo;
      logoName.textContent = '已恢复上次 Logo';
      btnClearLogo.hidden = false;
    }
  }

  function render() {
    outSize.textContent = state.fontSize;
    saveSettings();
    CardRenderer.render(canvas, {
      mode: state.mode,
      style: state.style,
      text: inpText.value,
      // 两个落款输入框合并为渲染引擎的两行落款约定（\n 分隔，空行会被忽略）
      signature: inpSign1.value + '\n' + inpSign2.value,
      brand: inpBrand.value,
      fontFamily: state.fontFamily,
      fontSize: state.fontSize,
      logo: state.logo
    });
  }

  var timer = null;
  function scheduleRender() {
    clearTimeout(timer);
    timer = setTimeout(render, 120);
  }

  /* 分段控件：卡片类型 */
  segMode.addEventListener('click', function (e) {
    var btn = e.target.closest('.seg-btn');
    if (!btn) return;
    segMode.querySelectorAll('.seg-btn').forEach(function (b) { b.classList.remove('active'); });
    btn.classList.add('active');
    state.mode = btn.dataset.mode;
    // 长文默认字号略小
    if (state.mode === 'long' && state.fontSize > 60) {
      state.fontSize = 40;
      rngSize.value = 40;
    }
    render();
  });

  /* 风格 */
  styleRow.addEventListener('click', function (e) {
    var chip = e.target.closest('.style-chip');
    if (!chip) return;
    styleRow.querySelectorAll('.style-chip').forEach(function (b) { b.classList.remove('active'); });
    chip.classList.add('active');
    state.style = chip.dataset.style;
    render();
  });

  /* 文本输入 */
  [inpText, inpSign1, inpSign2, inpBrand].forEach(function (el) {
    el.addEventListener('input', scheduleRender);
  });

  /* 字体 / 字号 */
  selFont.addEventListener('change', function () {
    state.fontFamily = selFont.value;
    // 网络字体可能尚未就绪，等字体加载完再渲染一次
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(render);
    }
    render();
  });
  rngSize.addEventListener('input', function () {
    state.fontSize = parseInt(rngSize.value, 10);
    render();
  });

  /* Logo 上传 */
  inpLogo.addEventListener('change', function () {
    var file = inpLogo.files && inpLogo.files[0];
    if (!file) return;
    var img = new Image();
    img.onload = function () {
      state.logo = img;
      state.logoDataURL = compressLogo(img);
      logoName.textContent = file.name;
      btnClearLogo.hidden = false;
      render();
    };
    img.src = URL.createObjectURL(file);
  });
  btnClearLogo.addEventListener('click', function () {
    state.logo = null;
    state.logoDataURL = '';
    inpLogo.value = '';
    logoName.textContent = '';
    btnClearLogo.hidden = true;
    render();
  });

  function setHint(msg, cls) {
    hint.textContent = msg;
    hint.className = 'hint' + (cls ? ' ' + cls : '');
    if (msg) setTimeout(function () { hint.textContent = ''; hint.className = 'hint'; }, 2600);
  }

  /* 下载 PNG */
  btnDownload.addEventListener('click', function () {
    canvas.toBlob(function (blob) {
      if (!blob) { setHint('导出失败，请重试', 'err'); return; }
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'xiaowen-card-' + Date.now() + '.png';
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
      setHint('已开始下载', 'ok');
    }, 'image/png');
  });

  /* 复制到剪贴板 */
  btnCopy.addEventListener('click', function () {
    if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
      setHint('当前浏览器不支持复制图片，请使用下载', 'err');
      return;
    }
    canvas.toBlob(function (blob) {
      if (!blob) { setHint('复制失败，请重试', 'err'); return; }
      navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
        .then(function () { setHint('已复制到剪贴板，可直接粘贴', 'ok'); })
        .catch(function () { setHint('复制被拒绝，请检查浏览器权限或使用下载', 'err'); });
    }, 'image/png');
  });

  /* 初次渲染：先恢复上次输入，再等网络字体就绪，避免首屏回退字体 */
  restoreSettings();
  render();
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(render);
  }
})();
