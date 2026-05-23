/* ============================================================
   i18n — 国际化
   ============================================================ */
(function() {
  var I18N = {
    current: 'zh-CN',

    data: {
      'zh-CN': {
        /* 工具栏 */
        'toolbar.track-label': '当前轨:',
        'toolbar.add-track': '+轨',
        'toolbar.del-track': '-轨',
        'toolbar.track-color': '轨道颜色',
        'toolbar.reset': '重置',
        'toolbar.reset-current': '重置当前轨道',
        'toolbar.reset-all': '重置所有轨道',
        'toolbar.import-midi': '导入 MIDI',
        'toolbar.theme': '主题',
        'toolbar.save': '保存',
        'toolbar.load': '加载',
        'toolbar.export': '导出音频',
        'toolbar.play': '播放/暂停',
        'toolbar.stop': '停止',
        'toolbar.record': '录制 Talkbox',
        'toolbar.metronome': '节拍器',
        'toolbar.lang': '语言',

        /* 左面板 */
        'section.formant': '共振峰',
        'section.carrier': '载波',
        'section.preset': '音色预设',
        'formant.advanced': '高级',
        'formant.simple': '简易',
        'carrier.sawtooth': '锯齿',
        'carrier.square': '方波',
        'carrier.triangle': '三角',
        'carrier.sine': '正弦',
        'knob.porta': '滑音',
        'knob.attack': 'Attack',
        'knob.release': 'Release',
        'knob.volume': '音量',
        'knob.intensity': '默认乐句强度',

        /* 钢琴窗工具栏 */
        'pr.select': '选择/移动',
        'pr.draw': '绘制音符',
        'pr.eraser': '擦除',
        'pr.snap': '网格吸附',
        'pr.quantize': '量化',
        'pr.delete': '删除选中',
        'pr.zoom-in': '放大',
        'pr.zoom-out': '缩小',

        /* MIDI 弹窗 */
        'midi.title-ai': 'AI 生成 Talkbox MIDI 提示词',
        'midi.desc-ai': '将此提示词复制到 ChatGPT / Claude 等 AI 工具中，上传你的 MP3 人声文件，即可自动生成 Talkbox 风格 MIDI 文件。',
        'midi.copy': '复制提示词',
        'midi.copied': '已复制',
        'midi.title-import': '导入 MIDI 文件',
        'midi.drop-text': '拖拽 .mid 文件到此处',
        'midi.drop-sub': '或',
        'midi.drop-link': '点击选择文件',
        'midi.desc-import': '导入后 MIDI 音符将自动填充到当前轨道的钢琴窗中。',
        'midi.close': '关闭',

        /* 主题弹窗 */
        'theme.header': '主题色',
        'theme.custom': '自定义',

        /* 快捷键面板 */
        'sc.playback': '播放控制',
        'sc.tools': '工具切换',
        'sc.edit': '编辑',
        'sc.project': '项目',
        'sc.help': '帮助',
        'sc.play': '播放 / 暂停',
        'sc.record': '录制',
        'sc.metronome': '节拍器',
        'sc.draw': '画笔工具',
        'sc.select': '选择工具',
        'sc.eraser': '橡皮擦',
        'sc.quantize': '量化音符',
        'sc.delete': '删除选中',
        'sc.save': '保存项目',
        'sc.new': '新建项目',
        'sc.tutorial': '教程引导',

        /* 状态栏/动态文本 */
        'status.ready': '就绪 | 点击钢琴窗开始',
        'status.imported': '已导入 {n} 个音符',
        'status.recording': '录制中...',
        'status.playing': '播放中',
        'status.saved': '已保存: {name}',
        'status.loaded': '已加载: {name}',
        'status.init-audio': '正在初始化...',
        'status.no-notes': '当前轨道无音符',
        'status.rendering': '正在离线渲染...',
        'status.export-done': '导出完成',
        'status.export-fail': '导出失败',
        'status.init-fail': '初始化失败',

        /* 确认/弹窗 */
        'confirm.reset-current': '将清空当前轨道「{name}」的全部音符，此操作不可撤销。确定继续？',
        'confirm.reset-all': '将清空所有 {n} 个轨道，仅保留第 1 轨（Track 1）。此操作不可撤销。确定继续？',
        'alert.midi-parse': 'MIDI 解析失败: ',
        'alert.mic': '麦克风不可用',
        'alert.load-fail': '加载项目文件失败',
        'alert.save-fail': '保存项目文件失败',
        'alert.export-fail': '导出音频失败',
        'alert.no-projects': '没有保存的项目',

        /* 项目管理 */
        'project.prompt-save-name': '项目名称:',
        'project.default-name': '我的项目',
        'project.prompt-load': '选择项目序号:',

        /* 预设 */
        'preset.classic': 'Classic',
        'preset.bright': 'Bright',
        'preset.deep': 'Deep',
        'preset.nasal': 'Nasal',
        'preset.robot': 'Robot',
        'preset.warm': 'Warm',

        /* Tooltips */
        'tip.vowel-a': '元音 /a/，口腔张开，F1 较高 F2 适中',
        'tip.vowel-e': '元音 /e/，舌位靠前，F2 较高',
        'tip.vowel-i': '元音 /i/，舌位最高最前，F1 低 F2 极高',
        'tip.vowel-o': '元音 /o/，圆唇后元音，F1 和 F2 均较低',
        'tip.vowel-u': '元音 /u/，圆唇高后元音，F1/F2 均为最低',
        'tip.vowel-ae': '元音 /æ/，介于 a 和 e 之间',
        'tip.vowel-oo': '元音 /ʊ/，介于 u 和 o 之间',
        'tip.vowel-er': '儿化元音 /ɚ/，卷舌特征共振峰',
        'tip.vowel-off': '关闭共振峰滤波，输出原始载波音色',
        'tip.f1': '第一共振峰频率，塑造元音的基础音色特征',
        'tip.f2': '第二共振峰频率，影响元音的明亮度和辨识度',
        'tip.f3': '第三共振峰频率，为元音添加高频细节质感',
        'tip.q': '共振峰品质因数（带宽），值越小共振峰越尖锐突出',
        'tip.mix': '共振峰滤波信号与原始载波的混合比例',
        'tip.wave-sawtooth': '富含奇偶次谐波，音色明亮有力，经典 Talkbox 音色',
        'tip.wave-square': '仅含奇次谐波，音色空洞具有电子感',
        'tip.wave-triangle': '谐波较少，音色柔和接近正弦波',
        'tip.wave-sine': '纯基频无谐波，音色最纯净',
        'tip.porta': '相邻音符之间的滑音过渡时间，模拟 Talkbox 管子的自然滑音',
        'tip.attack': '音量包络起音时间，控制音符从无声到最大音量的速度',
        'tip.release': '音量包络释音时间，控制音符结束后音量衰减的速度',
        'tip.volume': '合成器最终输出音量',
        'tip.intensity': '控制共振峰滤波的响应深度，值越高元音特征越明显',

        'np.intensity': '强度',
        'np.vowel': '元音',
        'np.volume': '音量',
        'np.wave': '载波',
        'np.wave-global': '全局',
        'np.porta': '滑音',
        'np.attack': 'Attack',
        'np.release': 'Release',
        'np.vowel-global': '全局',

        /* 快捷键提示栏 */
        'shortcut.undo': '撤销',
        'shortcut.redo': '重做',
        'shortcut.delete': '删除选中',
        'shortcut.select-all': '全选',
        'shortcut.deselect': '取消选择',
      },

      'en': {
        'toolbar.track-label': 'Track:',
        'toolbar.add-track': '+Track',
        'toolbar.del-track': '-Track',
        'toolbar.track-color': 'Track Color',
        'toolbar.reset': 'Reset',
        'toolbar.reset-current': 'Reset Current Track',
        'toolbar.reset-all': 'Reset All Tracks',
        'toolbar.import-midi': 'Import MIDI',
        'toolbar.theme': 'Theme',
        'toolbar.save': 'Save',
        'toolbar.load': 'Load',
        'toolbar.export': 'Export Audio',
        'toolbar.play': 'Play/Pause',
        'toolbar.stop': 'Stop',
        'toolbar.record': 'Record Talkbox',
        'toolbar.metronome': 'Metronome',
        'toolbar.lang': 'Language',

        'section.formant': 'Formant',
        'section.carrier': 'Carrier',
        'section.preset': 'Presets',
        'formant.advanced': 'Advanced',
        'formant.simple': 'Simple',
        'carrier.sawtooth': 'Sawtooth',
        'carrier.square': 'Square',
        'carrier.triangle': 'Triangle',
        'carrier.sine': 'Sine',
        'knob.porta': 'Glide',
        'knob.attack': 'Attack',
        'knob.release': 'Release',
        'knob.volume': 'Volume',
        'knob.intensity': 'Default Intensity',

        'pr.select': 'Select/Move',
        'pr.draw': 'Draw Notes',
        'pr.eraser': 'Erase',
        'pr.snap': 'Snap to Grid',
        'pr.quantize': 'Quantize',
        'pr.delete': 'Delete Selected',
        'pr.zoom-in': 'Zoom In',
        'pr.zoom-out': 'Zoom Out',

        'midi.title-ai': 'AI-Generated Talkbox MIDI Prompt',
        'midi.desc-ai': 'Copy this prompt to ChatGPT, Claude, or other AI tools, upload your MP3 vocal file, and generate a Talkbox-style MIDI file automatically.',
        'midi.copy': 'Copy Prompt',
        'midi.copied': 'Copied',
        'midi.title-import': 'Import MIDI File',
        'midi.drop-text': 'Drag .mid file here',
        'midi.drop-sub': 'or',
        'midi.drop-link': 'click to browse',
        'midi.desc-import': 'Imported MIDI notes will be filled into the current track\'s piano roll.',
        'midi.close': 'Close',

        'theme.header': 'Theme Color',
        'theme.custom': 'Custom',

        'sc.playback': 'Playback',
        'sc.tools': 'Tools',
        'sc.edit': 'Editing',
        'sc.project': 'Project',
        'sc.help': 'Help',
        'sc.play': 'Play / Pause',
        'sc.record': 'Record',
        'sc.metronome': 'Metronome',
        'sc.draw': 'Draw Tool',
        'sc.select': 'Select Tool',
        'sc.eraser': 'Eraser',
        'sc.quantize': 'Quantize Notes',
        'sc.delete': 'Delete Selected',
        'sc.undo': 'Undo',
        'sc.redo': 'Redo',
        'sc.select-all': 'Select All',
        'sc.deselect': 'Deselect',
        'sc.save': 'Save Project',
        'sc.new': 'New Project',
        'sc.tutorial': 'Tutorial',

        'status.ready': 'Ready | Click piano roll to start',
        'status.imported': 'Imported {n} notes',
        'status.recording': 'Recording...',
        'status.playing': 'Playing',
        'status.saved': 'Saved: {name}',
        'status.loaded': 'Loaded: {name}',
        'status.init-audio': 'Initializing...',
        'status.no-notes': 'No notes in current track',
        'status.rendering': 'Offline rendering...',
        'status.export-done': 'Export complete',
        'status.export-fail': 'Export failed',
        'status.init-fail': 'Initialization failed',

        'confirm.reset-current': 'This will clear all notes from track "{name}". This action cannot be undone. Continue?',
        'confirm.reset-all': 'This will clear all {n} tracks, keeping only Track 1. This action cannot be undone. Continue?',
        'alert.midi-parse': 'MIDI parse error: ',
        'alert.mic': 'Microphone unavailable',
        'alert.load-fail': 'Failed to load project file',
        'alert.save-fail': 'Failed to save project file',
        'alert.export-fail': 'Failed to export audio',
        'alert.no-projects': 'No saved projects',

        /* Project */
        'project.prompt-save-name': 'Project name:',
        'project.default-name': 'My Project',
        'project.prompt-load': 'Select project:',

        'preset.classic': 'Classic',
        'preset.bright': 'Bright',
        'preset.deep': 'Deep',
        'preset.nasal': 'Nasal',
        'preset.robot': 'Robot',
        'preset.warm': 'Warm',

        /* Tooltips */
        'tip.vowel-a': 'Vowel /a/, open mouth, high F1, moderate F2',
        'tip.vowel-e': 'Vowel /e/, front tongue position, high F2',
        'tip.vowel-i': 'Vowel /i/, highest front tongue, low F1, very high F2',
        'tip.vowel-o': 'Vowel /o/, rounded back vowel, low F1 and F2',
        'tip.vowel-u': 'Vowel /u/, rounded high back vowel, lowest F1/F2',
        'tip.vowel-ae': 'Vowel /æ/, between a and e',
        'tip.vowel-oo': 'Vowel /ʊ/, between u and o',
        'tip.vowel-er': 'R-colored vowel /ɚ/, retroflex formant',
        'tip.vowel-off': 'Bypass formant filter, output raw carrier',
        'tip.f1': 'First formant frequency, shapes basic vowel character',
        'tip.f2': 'Second formant frequency, affects brightness and distinction',
        'tip.f3': 'Third formant frequency, adds high-frequency texture',
        'tip.q': 'Formant quality factor (bandwidth), lower = sharper peaks',
        'tip.mix': 'Mix ratio between formant-filtered and raw carrier signal',
        'tip.wave-sawtooth': 'Rich in all harmonics, bright and powerful — classic Talkbox tone',
        'tip.wave-square': 'Odd harmonics only, hollow electronic character',
        'tip.wave-triangle': 'Few harmonics, soft tone close to sine wave',
        'tip.wave-sine': 'Pure fundamental, no harmonics — cleanest tone',
        'tip.porta': 'Glide time between adjacent notes, mimics natural Talkbox tube slide',
        'tip.attack': 'Envelope attack time, controls fade-in speed from silence to max volume',
        'tip.release': 'Envelope release time, controls fade-out speed after note ends',
        'tip.volume': 'Final output volume of the synthesizer',
        'tip.intensity': 'Depth of formant filter response — higher values make vowel character more pronounced',

        'np.intensity': 'Intensity',
        'np.vowel': 'Vowel',
        'np.volume': 'Volume',
        'np.wave': 'Wave',
        'np.wave-global': 'Global',
        'np.porta': 'Porta',
        'np.attack': 'Attack',
        'np.release': 'Release',
        'np.vowel-global': 'Global',

        }
    },

    t: function(key, params) {
      var str = this.data[this.current][key];
      if (str === undefined) return key;
      if (params) {
        for (var k in params) {
          str = str.replace('{' + k + '}', params[k]);
        }
      }
      return str;
    },

    setLang: function(lang) {
      this.current = lang;
      localStorage.setItem('talkbox_lang', lang);
      this.apply();
    },

    apply: function() {
      var self = this;

      // data-i18n → textContent
      document.querySelectorAll('[data-i18n]').forEach(function(el) {
        el.textContent = self.t(el.dataset.i18n);
      });

      // data-i18n-title → title
      document.querySelectorAll('[data-i18n-title]').forEach(function(el) {
        el.title = self.t(el.dataset.i18nTitle);
      });

      // data-i18n-tip → data-tip（help icon tooltips）
      document.querySelectorAll('[data-i18n-tip]').forEach(function(el) {
        el.dataset.tip = self.t(el.dataset.i18nTip);
      });

      // placeholder
      document.querySelectorAll('[data-i18n-placeholder]').forEach(function(el) {
        el.placeholder = self.t(el.dataset.i18nPlaceholder);
      });

      // 触发自定义事件，app.js 可监听来更新动态文本
      document.dispatchEvent(new CustomEvent('i18n-changed', { detail: { lang: self.current } }));
    },

    init: function() {
      var saved = localStorage.getItem('talkbox_lang');
      if (saved && this.data[saved]) this.current = saved;
      this.apply();
    }
  };

  window.I18N = I18N;
})();