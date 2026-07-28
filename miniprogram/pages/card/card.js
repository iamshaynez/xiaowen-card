var CardRenderer = require('../../utils/card-renderer.js');

// 用户输入持久化（wx.setStorageSync，下次打开自动恢复）
var STORAGE_KEY = 'card-settings-v1';

Page({
  data: {
    mode: 'quote',          // quote 金句 / long 长文
    style: 'paper',         // paper / ink / cinnabar / vertical / moon / indigo / tea / bamboo
    text: '人生如逆旅，我亦是行人。',
    signature: '小文 记',
    brand: '小文卡片 · 每日一句',
    fontFamily: 'serif',    // serif 宋体 / kai 楷体 / hei 黑体
    fontSize: 56,
    logoPath: '',
    canvasH: '400px',
    saving: false,
    styles: [
      { key: 'paper', name: '冷灰笺' },
      { key: 'ink', name: '玄黑卡' },
      { key: 'cinnabar', name: '朱砂签' },
      { key: 'vertical', name: '竖排墨' },
      { key: 'moon', name: '月白笺' },
      { key: 'indigo', name: '黛蓝卡' },
      { key: 'tea', name: '茶烟笺' },
      { key: 'bamboo', name: '竹青笺' }
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
    this._lastH = 0;
    this.restoreSettings();
  },

  /* ---------- 输入持久化 ---------- */

  saveSettings: function () {
    var d = this.data;
    try {
      wx.setStorageSync(STORAGE_KEY, {
        mode: d.mode,
        style: d.style,
        text: d.text,
        signature: d.signature,
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
    if (['paper', 'ink', 'cinnabar', 'vertical', 'moon', 'indigo', 'tea', 'bamboo'].indexOf(s.style) > -1) patch.style = s.style;
    if (['serif', 'kai', 'hei'].indexOf(s.fontFamily) > -1) patch.fontFamily = s.fontFamily;
    if (typeof s.fontSize === 'number') patch.fontSize = Math.max(28, Math.min(88, s.fontSize));
    if (typeof s.text === 'string' && s.text) patch.text = s.text;
    if (typeof s.signature === 'string') patch.signature = s.signature;
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
      });
  },

  /* ---------- 渲染 ---------- */

  collectOpts: function (logo, scale) {
    var d = this.data;
    return {
      style: d.style,
      mode: d.mode,
      text: d.text,
      signature: d.signature,
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
        that.setData({ canvasH: h + 'px' });
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
    this.setData({ fontFamily: e.currentTarget.dataset.font });
    this.renderPreview();
  },

  onText: function (e) {
    this.setData({ text: e.detail.value });
    this.scheduleRender();
  },

  onSign: function (e) {
    this.setData({ signature: e.detail.value });
    this.scheduleRender();
  },

  onBrand: function (e) {
    this.setData({ brand: e.detail.value });
    this.scheduleRender();
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
      that.exportNode.toTempFilePath({
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
        fail: function () {
          that._done();
          wx.showToast({ title: '生成失败，请重试', icon: 'none' });
        }
      });
    }).catch(function () {
      that._done();
      wx.showToast({ title: '生成失败，请重试', icon: 'none' });
    });
  },

  _done: function () {
    wx.hideLoading();
    this.setData({ saving: false });
  },

  _handleSaveFail: function (err) {
    var msg = (err && err.errMsg) || '';
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
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    }
  }
});
