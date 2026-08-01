var CardRenderer = require('../../utils/card-renderer.js');

// 用户输入持久化（wx.setStorageSync，下次打开自动恢复）
var STORAGE_KEY = 'card-settings-v1';

// 网络子集字体（GB2312 单文件 WOFF，见 fonts/README.md）。
// 引用本仓库 fonts/ 目录，经 jsdmirror 镜像（有 ICP 备案、CORS 放行）分发；
// 真机需在 mp 后台把 cdn.jsdmirror.com 配置为 downloadFile 合法域名。
// 黑体用系统黑体，不在此表，无需下载。
var FONT_CDN = 'https://cdn.jsdmirror.com/gh/iamshaynez/xiaowen-card@main/fonts/';
var WEB_FONTS = {
  serif: { family: 'XW Serif', file: 'xw-serif.woff' },
  kai: { family: 'XW Kai', file: 'xw-kai.woff' }
};

Page({
  data: {
    mode: 'quote',          // quote 金句 / long 长文
    style: 'paper',         // paper / ink / cinnabar / moon / indigo / tea / bamboo / songhua
    text: '人生如逆旅，我亦是行人。',
    sign1: '',                // 落款第一行：日期 / 地点（小字）
    sign2: '小文 记',          // 落款第二行：署名
    brand: '小文卡片 · 每日一句',
    fontFamily: 'serif',    // serif 宋体 / kai 楷体 / hei 黑体
    fontSize: 56,
    logoPath: '',
    canvasH: '400px',
    previewH: 0,          // 固定预览区的实测高度，用于顶开面板
    inputFocus: false,    // 任一输入框聚焦时为 true（聚焦期禁面板滚动，防原生 input 文字上浮错位）
    saving: false,
    styles: [
      { key: 'paper', name: '冷灰笺' },
      { key: 'ink', name: '玄黑卡' },
      { key: 'cinnabar', name: '朱砂签' },
      { key: 'moon', name: '月白笺' },
      { key: 'indigo', name: '黛蓝卡' },
      { key: 'tea', name: '茶烟笺' },
      { key: 'bamboo', name: '竹青笺' },
      { key: 'songhua', name: '松花笺' }
    ],
    fonts: [
      { key: 'serif', name: '宋体' },
      { key: 'kai', name: '楷体' },
      { key: 'hei', name: '黑体' }
    ]
  },

  onLoad: function () {
    this._seq = 0;          // 渲染序号，丢弃过期的异步结果
    this._timer = null;     // 输入防抖
    this._logoImgs = {};    // 每个画布各自的 Logo Image 缓存
    this._fontReady = {};   // 已加载成功的网络字体
    this._lastH = 0;
    this.restoreSettings();
  },

  /* ---------- 网络字体 ---------- */

  // 按需加载网络字体进 canvas；resolve(true/false) 表示是否可用，永不 reject
  ensureFont: function (key) {
    var def = WEB_FONTS[key];
    if (!def) return Promise.resolve(true);   // 黑体用系统字体，无需下载
    if (this._fontReady[key]) return Promise.resolve(true);
    var that = this;
    return new Promise(function (resolve) {
      wx.loadFontFace({
        family: def.family,
        source: 'url("' + FONT_CDN + def.file + '")',
        // canvas 是原生组件，必须带 native scope（默认仅 webview 生效）
        scopes: ['webview', 'native'],
        global: true,
        success: function () { that._fontReady[key] = true; resolve(true); },
        fail: function () { resolve(false); }
      });
    });
  },

  /* ---------- 输入持久化 ---------- */

  saveSettings: function () {
    var d = this.data;
    try {
      wx.setStorageSync(STORAGE_KEY, {
        mode: d.mode,
        style: d.style,
        text: d.text,
        sign1: d.sign1,
        sign2: d.sign2,
        brand: d.brand,
        fontFamily: d.fontFamily,
        fontSize: d.fontSize,
        logoPath: d.logoPath
      });
    } catch (e) { /* 存储失败时静默忽略 */ }
  },

  restoreSettings: function () {
    var s;
    try { s = wx.getStorageSync(STORAGE_KEY); } catch (e) { s = null; }
    if (!s || typeof s !== 'object') return;
    var patch = {};
    if (s.mode === 'quote' || s.mode === 'long') patch.mode = s.mode;
    if (['paper', 'ink', 'cinnabar', 'moon', 'indigo', 'tea', 'bamboo', 'songhua'].indexOf(s.style) > -1) patch.style = s.style;
    if (['serif', 'kai', 'hei'].indexOf(s.fontFamily) > -1) patch.fontFamily = s.fontFamily;
    if (typeof s.fontSize === 'number') patch.fontSize = Math.max(28, Math.min(88, s.fontSize));
    if (typeof s.text === 'string' && s.text) patch.text = s.text;
    if (typeof s.sign1 === 'string') patch.sign1 = s.sign1;
    if (typeof s.sign2 === 'string') patch.sign2 = s.sign2;
    // 旧版本存的是合并的 signature（\n 分隔），迁移为两个输入框：单行归入署名行
    if (patch.sign1 === undefined && patch.sign2 === undefined && typeof s.signature === 'string') {
      var sp = s.signature.split('\n');
      if (sp.length > 1) {
        patch.sign1 = sp[0];
        patch.sign2 = sp.slice(1).join('\n');
      } else {
        patch.sign2 = s.signature;
      }
    }
    if (typeof s.brand === 'string') patch.brand = s.brand;
    // 持久文件路径（wx.saveFile 保存），文件被系统清理时 getLogo 会兜底为无 Logo
    if (typeof s.logoPath === 'string' && s.logoPath) patch.logoPath = s.logoPath;
    this.setData(patch);
  },

  onReady: function () {
    var that = this;
    var info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    this.dpr = info.pixelRatio || 2;
    wx.createSelectorQuery().in(this)
      .select('#cardCanvas').fields({ node: true, size: true })
      .select('#exportCanvas').fields({ node: true, size: true })
      .exec(function (res) {
        if (!res[0] || !res[0].node) return;
        that.canvasNode = res[0].node;
        that.previewCssW = res[0].width;
        that.exportNode = res[1] && res[1].node;
        that.renderPreview();
        that.updatePreviewH();
        // 恢复的网络字体静默补载：先用系统字体渲染，字体到位后再重绘一次
        that.ensureFont(that.data.fontFamily).then(function (ok) {
          if (ok && WEB_FONTS[that.data.fontFamily]) that.renderPreview();
        });
      });
  },

  // 实测固定预览区高度，顶开面板（预览吸顶由 fixed 实现，面板需让出位置）
  updatePreviewH: function () {
    var that = this;
    wx.createSelectorQuery().in(this)
      .select('.preview').boundingClientRect(function (rect) {
        if (rect && rect.height && Math.ceil(rect.height) !== that.data.previewH) {
          that.setData({ previewH: Math.ceil(rect.height) });
        }
      }).exec();
  },

  /* ---------- 渲染 ---------- */

  collectOpts: function (logo, scale) {
    var d = this.data;
    return {
      style: d.style,
      mode: d.mode,
      text: d.text,
      // 两个落款输入框合并为渲染引擎的两行落款约定（\n 分隔，空行会被忽略）
      signature: d.sign1 + '\n' + d.sign2,
      brand: d.brand,
      fontFamily: d.fontFamily,
      fontSize: d.fontSize,
      logo: logo,
      scale: scale
    };
  },

  // Logo 图片需按画布分别创建（canvas.createImage），按 key 缓存
  getLogo: function (key, canvas) {
    var that = this;
    if (!this.data.logoPath || !canvas) return Promise.resolve(null);
    var cached = this._logoImgs[key];
    if (cached && cached.path === this.data.logoPath) return Promise.resolve(cached.img);
    return new Promise(function (resolve) {
      var img = canvas.createImage();
      img.onload = function () {
        that._logoImgs[key] = { path: that.data.logoPath, img: img };
        resolve(img);
      };
      img.onerror = function () { resolve(null); };
      img.src = that.data.logoPath;
    });
  },

  renderPreview: function () {
    var that = this;
    this.saveSettings();
    if (!this.canvasNode) return;
    var seq = ++this._seq;
    this.getLogo('preview', this.canvasNode).then(function (logo) {
      if (seq !== that._seq || !that.canvasNode) return;
      // 预览：逻辑 1080 宽排版，映射到「CSS 宽 × dpr」的实际像素，保证清晰
      var scale = that.previewCssW * that.dpr / CardRenderer.CARD_W;
      var size = CardRenderer.render(that.canvasNode, that.collectOpts(logo, scale));
      var h = Math.round(that.previewCssW * size.height / size.width);
      if (h !== that._lastH) {
        that._lastH = h;
        // 画布高度变化会改变固定预览区的总高，setData 完成后重新测量
        that.setData({ canvasH: h + 'px' }, function () { that.updatePreviewH(); });
      }
    });
  },

  scheduleRender: function () {
    var that = this;
    if (this._timer) clearTimeout(this._timer);
    this._timer = setTimeout(function () { that.renderPreview(); }, 150);
  },

  /* ---------- 控件事件 ---------- */

  onMode: function (e) {
    this.setData({ mode: e.currentTarget.dataset.mode });
    this.renderPreview();
  },

  onStyle: function (e) {
    this.setData({ style: e.currentTarget.dataset.style });
    this.renderPreview();
  },

  onFont: function (e) {
    var key = e.currentTarget.dataset.font;
    if (key === this.data.fontFamily) return;
    // 黑体或已加载的字体直接切换；未加载的网络字体先下载再切
    if (!WEB_FONTS[key] || this._fontReady[key]) {
      this.setData({ fontFamily: key });
      this.renderPreview();
      return;
    }
    var that = this;
    wx.showLoading({ title: '字体加载中…', mask: true });
    this.ensureFont(key).then(function (ok) {
      wx.hideLoading();
      if (!ok) {
        // 加载失败不出错：仍切换选择，渲染栈自动回退系统字体，下次进入会重试
        wx.showToast({ title: '字体加载失败，已回退系统字体', icon: 'none' });
      }
      that.setData({ fontFamily: key });
      that.renderPreview();
    });
  },

  onText: function (e) {
    this.setData({ text: e.detail.value });
    this.scheduleRender();
  },

  onSign1: function (e) {
    this.setData({ sign1: e.detail.value });
    this.scheduleRender();
  },

  onSign2: function (e) {
    this.setData({ sign2: e.detail.value });
    this.scheduleRender();
  },

  onBrand: function (e) {
    this.setData({ brand: e.detail.value });
    this.scheduleRender();
  },

  // 输入框聚焦期禁止面板滚动：全屏高 scroll-view 内的原生 input 聚焦时，
  // 微信对焦点定位计算出错会导致已输入文字上浮错位（错位到吸顶预览区），
  // 禁滚可规避；失焦恢复滚动。textarea 同理。
  onFieldFocus: function () {
    if (!this.data.inputFocus) this.setData({ inputFocus: true });
  },

  onFieldBlur: function () {
    if (this.data.inputFocus) this.setData({ inputFocus: false });
  },

  onSizeChanging: function (e) {
    this.setData({ fontSize: e.detail.value });
    this.scheduleRender();
  },

  onSizeChange: function (e) {
    this.setData({ fontSize: e.detail.value });
    this.renderPreview();
  },

  onChooseLogo: function () {
    var that = this;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['compressed'],
      success: function (res) {
        var f = res.tempFiles && res.tempFiles[0];
        if (!f) return;
        that._logoImgs = {};
        // 临时文件重启后可能失效，转存为持久文件以便下次恢复；失败则退回临时路径
        wx.saveFile({
          tempFilePath: f.tempFilePath,
          success: function (sv) {
            that.setData({ logoPath: sv.savedFilePath });
            that.renderPreview();
          },
          fail: function () {
            that.setData({ logoPath: f.tempFilePath });
            that.renderPreview();
          }
        });
      }
    });
  },

  onClearLogo: function () {
    this._logoImgs = {};
    this.setData({ logoPath: '' });
    this.renderPreview();
  },

  /* ---------- 保存到相册 ---------- */

  onSave: function () {
    var that = this;
    if (this.data.saving || !this.exportNode) return;
    this.setData({ saving: true });
    wx.showLoading({ title: '生成中…', mask: true });
    this.getLogo('export', this.exportNode).then(function (logo) {
      // 导出：scale = 1，即 1080px 宽高清 PNG（与 web 版一致）
      CardRenderer.render(that.exportNode, that.collectOpts(logo, 1));
      // 小程序导出画布用 wx.canvasToTempFilePath 传节点（节点自身无 toTempFilePath 方法，那是小游戏接口）
      wx.canvasToTempFilePath({
        canvas: that.exportNode,
        success: function (r) {
          wx.saveImageToPhotosAlbum({
            filePath: r.tempFilePath,
            success: function () {
              that._done();
              wx.showToast({ title: '已保存到相册', icon: 'success' });
            },
            fail: function (err) {
              that._done();
              that._handleSaveFail(err);
            }
          });
        },
        fail: function (err) {
          that._done();
          console.warn('[save] canvasToTempFilePath 导出失败', err);
          wx.showToast({ title: '生成失败，请重试', icon: 'none' });
        }
      });
    }).catch(function (e) {
      that._done();
      console.warn('[save] 渲染或 Logo 加载异常', e);
      wx.showToast({ title: '生成失败，请重试', icon: 'none' });
    });
  },

  _done: function () {
    wx.hideLoading();
    this.setData({ saving: false });
  },

  _handleSaveFail: function (err) {
    var msg = (err && err.errMsg) || '';
    // 隐私协议类失败（微信隐私新规后 saveImageToPhotosAlbum 属隐私接口）：
    // - 未在 mp 后台声明相册权限：fail api scope is not declared in the privacy agreement
    // - 用户未同意隐私授权：fail privacy permission is not authorized
    if (msg.indexOf('privacy') > -1) {
      if (msg.indexOf('not declared') > -1) {
        console.warn('[save] 相册权限未在《用户隐私保护指引》声明，请到 mp 后台配置', err);
        wx.showToast({ title: '保存失败，请重试', icon: 'none' });
        return;
      }
      // 拉起隐私授权弹窗，用户同意后自动重试保存
      var that = this;
      wx.requirePrivacyAuthorize({
        success: function () { that.onSave(); },
        fail: function () { /* 用户拒绝隐私授权，不提示 */ }
      });
      return;
    }
    if (msg.indexOf('auth') > -1 || msg.indexOf('deny') > -1 || msg.indexOf('authorize') > -1) {
      wx.showModal({
        title: '需要相册权限',
        content: '请在设置中允许保存图片到你的相册。',
        confirmText: '去设置',
        cancelText: '取消',
        success: function (r) {
          if (r.confirm) wx.openSetting();
        }
      });
    } else if (msg.indexOf('cancel') > -1) {
      // 用户取消，不提示
    } else {
      console.warn('[save] saveImageToPhotosAlbum 未识别的失败原因', err);
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    }
  }
});
