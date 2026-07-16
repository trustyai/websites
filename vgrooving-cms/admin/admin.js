/* V槽 CMS 多语言后台 */
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  let data = {};
  let lang = 'zh';
  let currentSec = 'brand';
  let dirty = false;
  let editIdx = null; // 产品编辑：null=列表视图，数字=编辑第 N 个产品
  let me = null; // 当前登录用户 {id,username,name,role}
  let usersCache = null;
  let acctEditing = null; // 账号管理：null=列表，'new' 或 用户对象=编辑表单
  const prodFilter = { q: '', cat: '', owner: '' };
  let prodTab = 'normal'; // normal | featured | deleted

  // 通用选择弹窗：返回 Promise<选中值 | null>
  function chooseModal(title, options) {
    return new Promise((resolve) => {
      const mask = document.createElement('div'); mask.className = 'picker-mask';
      mask.innerHTML = '<div class="picker-box" style="width:min(420px,92vw)"><div class="picker-head"><b>' + esc(title) + '</b><button class="icon-btn" data-x>✕</button></div><div style="padding:1rem"><select class="inp" data-sel>' + options.map((o) => '<option value="' + esc(o.value) + '">' + esc(o.label) + '</option>').join('') + '</select><div style="margin-top:1rem;display:flex;gap:0.5rem;justify-content:flex-end"><button class="btn ghost" data-cancel>取消</button><button class="btn" data-ok>确定</button></div></div></div>';
      document.body.appendChild(mask);
      const done = (v) => { mask.remove(); resolve(v); };
      mask.querySelector('[data-x]').addEventListener('click', () => done(null));
      mask.querySelector('[data-cancel]').addEventListener('click', () => done(null));
      mask.querySelector('[data-ok]').addEventListener('click', () => done(mask.querySelector('[data-sel]').value));
      mask.addEventListener('click', (e) => { if (e.target === mask) done(null); });
    });
  }

  async function loadUsers(force) {
    if (usersCache && !force) return usersCache;
    try { const r = await fetch('/api/users'); if (!r.ok) { usersCache = []; return usersCache; } usersCache = (await r.json()).users || []; }
    catch (e) { usersCache = []; }
    return usersCache;
  }
  function isAdmin() { return me && me.role === 'admin'; }
  const ROLE_LABEL = { admin: '管理员', sales: '业务员', editor: '制作员' };

    const SEC_TITLES = { dashboard: '仪表盘', brand: '品牌与导航', hero: '首页文案', wizard: '智能选型', products: '产品管理', contact: '联系页', chat: '在线客服', chats: '聊天记录', inbox: '商机中心', media: '媒体库', tools: '翻译与备份', accounts: '账号管理', account: '账号安全' };
  const LEAD_SOURCE_LABEL = { chat: '智能询盘', form: '表单询盘', product: '产品询盘' };
  function sourceLabel(s) { return LEAD_SOURCE_LABEL[s] || s || '表单询盘'; }
  function sourceBadge(s) {
    const colors = { chat: '#2563eb', form: '#16a34a', product: '#d97706' };
    return '<span style="display:inline-block;padding:0.12rem 0.45rem;border-radius:4px;font-size:0.72rem;background:' + (colors[s] || '#64748b') + ';color:#fff">' + esc(sourceLabel(s)) + '</span>';
  }
  const LEAD_STATUS_LABEL = { new: '未处理', following: '跟进中', replied: '已回复', won: '已成交', closed: '已关闭' };
  const LEAD_STATUS_KEYS = ['new', 'following', 'replied', 'won', 'closed'];
  function statusLabel(st) { return LEAD_STATUS_LABEL[st] || LEAD_STATUS_LABEL.new; }
  function statusBadge(st) {
    const colors = { new: 'var(--danger)', following: '#d97706', replied: '#2563eb', won: '#16a34a', closed: 'var(--muted)' };
    return '<span style="display:inline-block;padding:0.1rem 0.45rem;border-radius:4px;font-size:0.72rem;background:' + (colors[st] || 'var(--muted)') + ';color:#fff">' + esc(statusLabel(st)) + '</span>';
  }

  // 简易富文本编辑器（无依赖，基于 contenteditable）
  function richEditor(obj, key) {
    const wrap = document.createElement('div'); wrap.className = 'row';
    const tb = document.createElement('div'); tb.className = 'rte-tb';
    const area = document.createElement('div'); area.className = 'rte-area'; area.contentEditable = 'true';
    area.innerHTML = obj[key] || '';
    const cmd = (c, label, val) => { const b = document.createElement('button'); b.type = 'button'; b.title = label; b.innerHTML = label; b.addEventListener('mousedown', (e) => { e.preventDefault(); if (c === 'createLink') { const u = prompt('链接地址', 'https://'); if (u) document.execCommand(c, false, u); } else document.execCommand(c, false, val || null); area.focus(); obj[key] = area.innerHTML; markDirty(); }); return b; };
    [['bold', '<b>B</b>'], ['italic', '<i>I</i>'], ['underline', '<u>U</u>'], ['insertUnorderedList', '•'], ['insertOrderedList', '1.'], ['formatBlock', 'H', 'h3'], ['createLink', '🔗'], ['removeFormat', '⌫']].forEach((a) => tb.appendChild(cmd(a[0], a[1], a[2])));
    area.addEventListener('input', () => { obj[key] = area.innerHTML; markDirty(); });
    wrap.appendChild(tb); wrap.appendChild(area);
    return wrap;
  }

  // ---------- 后台配色主题（存浏览器本地，不影响前台） ----------
  const ADMIN_THEMES = {
    graphite: { name: '🌫 石墨灰', vars: { '--bg': '#1e222a', '--panel': '#272c36', '--panel-2': '#313742', '--border': '#3d4552', '--text': '#e8ebf0', '--muted': '#9aa4b2' } },
    dark: { name: '🌑 深邃黑', vars: { '--bg': '#0f1720', '--panel': '#161f2b', '--panel-2': '#1d2836', '--border': '#2a3646', '--text': '#e6edf3', '--muted': '#8b9bb0' } },
    navy: { name: '🌌 午夜蓝', vars: { '--bg': '#101c30', '--panel': '#16263f', '--panel-2': '#1e3352', '--border': '#2c456b', '--text': '#e6edf6', '--muted': '#8ba0bd' } },
    slate: { name: '🪨 岩板灰', vars: { '--bg': '#2b2f36', '--panel': '#353a43', '--panel-2': '#3f454f', '--border': '#4c535f', '--text': '#eceef2', '--muted': '#a7aeb9' } },
    light: { name: '☀️ 浅色', vars: { '--bg': '#f1f4f8', '--panel': '#ffffff', '--panel-2': '#f5f8fb', '--border': '#dde3ea', '--text': '#1a2230', '--muted': '#6b7684' } },
    beige: { name: '📜 暖米色', vars: { '--bg': '#f3efe7', '--panel': '#fffdf8', '--panel-2': '#f7f2e9', '--border': '#e6ded0', '--text': '#2b2822', '--muted': '#7a7264' } },
  };
  function currentThemeKey() { try { return localStorage.getItem('vg_admin_theme') || 'graphite'; } catch (e) { return 'graphite'; } }
  function applyAdminTheme(key) {
    const t = ADMIN_THEMES[key] || ADMIN_THEMES.graphite;
    Object.entries(t.vars).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
    try { localStorage.setItem('vg_admin_theme', key); } catch (e) {}
  }
  function initThemeSel() {
    const s = $('#themeSel'); if (!s) return;
    s.innerHTML = Object.entries(ADMIN_THEMES).map(([k, t]) => '<option value="' + k + '">' + t.name + '</option>').join('');
    s.value = currentThemeKey();
    s.addEventListener('change', () => applyAdminTheme(s.value));
  }

  function langPrefix(code) { return code === (data.defaultLang || 'zh') ? '' : '/' + code; }
  function updatePreview() { const a = $('#previewBtn'); if (a) a.href = (langPrefix(lang) || '/') + (langPrefix(lang) ? '/' : ''); }
  function deepClone(o) { return JSON.parse(JSON.stringify(o || {})); }

  function L() { data.i18n = data.i18n || {}; data.i18n[lang] = data.i18n[lang] || {}; return data.i18n[lang]; }
  function esc(s) { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }
  function toast(m, k) { const t = $('#toast'); t.textContent = m; t.className = 'show ' + (k || ''); setTimeout(() => (t.className = k || ''), 2200); }
  function markDirty() { dirty = true; const h = $('#saveHint'); h.textContent = '有未保存的修改'; h.classList.add('dirty'); }
  function markClean() { dirty = false; const h = $('#saveHint'); h.textContent = '已保存'; h.classList.remove('dirty'); }

  function field(label, obj, key, opts) {
    opts = opts || {};
    const wrap = document.createElement('div'); wrap.className = 'row';
    let ctl;
    if (opts.textarea) { ctl = document.createElement('textarea'); ctl.rows = opts.rows || 3; }
    else if (opts.select) {
      ctl = document.createElement('select');
      (opts.options || []).forEach((o) => { const op = document.createElement('option'); op.value = o.value; op.textContent = o.label; ctl.appendChild(op); });
    } else { ctl = document.createElement('input'); ctl.type = opts.type || 'text'; }
    ctl.className = 'inp';
    ctl.value = obj[key] != null ? obj[key] : (opts.default != null ? opts.default : '');
    if (opts.placeholder) ctl.placeholder = opts.placeholder;
    ctl.addEventListener('input', () => { obj[key] = ctl.value; markDirty(); if (opts.onInput) opts.onInput(ctl.value); });
    ctl.addEventListener('change', () => { obj[key] = ctl.value; markDirty(); if (opts.onInput) opts.onInput(ctl.value); });
    if (label) { const l = document.createElement('label'); l.className = 'lbl'; l.textContent = label; wrap.appendChild(l); }
    wrap.appendChild(ctl);
    if (opts.hint) { const h = document.createElement('div'); h.className = 'hint'; h.style.margin = '0.3rem 0 0'; h.textContent = opts.hint; wrap.appendChild(h); }
    return wrap;
  }
  // 逗号分隔数组字段
  function csvField(label, obj, key, opts) {
    opts = opts || {};
    return field(label, { v: (obj[key] || []).join(', ') }, 'v', Object.assign({}, opts, {
      onInput: (val) => { obj[key] = val.split(/[,，]/).map((s) => s.trim()).filter(Boolean); },
    }));
  }
  function card(title) { const c = document.createElement('div'); c.className = 'card'; if (title) { const h = document.createElement('h3'); h.textContent = title; c.appendChild(h); } return c; }
  function hint(c, text) { const h = document.createElement('div'); h.className = 'hint'; h.textContent = text; c.appendChild(h); return h; }
  function iconBtn(t, cls, fn) { const b = document.createElement('button'); b.type = 'button'; b.className = 'icon-btn ' + (cls || ''); b.textContent = t; b.addEventListener('click', fn); return b; }
  function moveItem(arr, i, d, rerender) { const j = i + d; if (j < 0 || j >= arr.length) return; const t = arr[i]; arr[i] = arr[j]; arr[j] = t; markDirty(); rerender(); }

  // 通用列表编辑器
  function renderList(host, arr, opts) {
    arr = arr || [];
    arr.forEach((item, i) => {
      const it = document.createElement('div'); it.className = 'list-item';
      const head = document.createElement('div'); head.className = 'li-head';
      const title = document.createElement('span'); title.className = 'li-title'; title.textContent = opts.label ? opts.label(item, i) : '#' + (i + 1);
      head.appendChild(title);
      const acts = document.createElement('div'); acts.className = 'li-actions';
      if (opts.sortable !== false) {
        acts.appendChild(iconBtn('↑', '', () => moveItem(arr, i, -1, opts.rerender)));
        acts.appendChild(iconBtn('↓', '', () => moveItem(arr, i, 1, opts.rerender)));
      }
      acts.appendChild(iconBtn('✕', 'del', () => { if (!opts.confirm || confirm(opts.confirm)) { arr.splice(i, 1); markDirty(); opts.rerender(); } }));
      head.appendChild(acts); it.appendChild(head);
      opts.fields(item, it, i);
      host.appendChild(it);
    });
    const add = document.createElement('button'); add.className = 'add-btn'; add.type = 'button'; add.textContent = opts.addLabel || '+ 添加';
    add.addEventListener('click', () => { arr.push(opts.makeDefault ? opts.makeDefault() : {}); markDirty(); opts.rerender(); });
    host.appendChild(add);
  }

  async function uploadFile(file) {
    const fd = new FormData(); fd.append('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || '上传失败'); }
    return res.json();
  }
  // 媒体列表编辑（图片/视频）
  function mediaEditor(container, arr, rerender, accept) {
    const list = document.createElement('div'); list.className = 'media-list';
    (arr || []).forEach((m, i) => {
      const th = document.createElement('div'); th.className = 'media-thumb';
      th.innerHTML = (m.type === 'video' ? '<video src="' + esc(m.src) + '" muted></video><span class="mt-type">视频</span>' : '<img src="' + esc(m.src) + '"><span class="mt-type">图片</span>');
      const del = document.createElement('div'); del.className = 'mt-del'; del.textContent = '✕';
      del.addEventListener('click', () => { arr.splice(i, 1); markDirty(); rerender(); });
      th.appendChild(del); list.appendChild(th);
    });
    container.appendChild(list);
    const up = document.createElement('label'); up.className = 'btn ghost'; up.textContent = '+ 上传' + (accept && accept.indexOf('video') > -1 ? '图片/视频' : '图片');
    const fi = document.createElement('input'); fi.type = 'file'; fi.accept = accept || 'image/*'; fi.className = 'hidden';
    fi.addEventListener('change', async () => {
      if (!fi.files[0]) return; up.textContent = '上传中...';
      try { const r = await uploadFile(fi.files[0]); arr.push({ type: r.type, src: r.url, alt: '' }); markDirty(); rerender(); }
      catch (e) { toast(e.message, 'bad'); }
      up.textContent = '+ 上传';
    });
    up.appendChild(fi); container.appendChild(up);
  }

  // ============ 各分区 ============
  function renderBrand() {
    const sec = $('#secBrand'); sec.innerHTML = '';
    data.brand = data.brand || {};
    // 全局
    const c0 = card('全局设置（所有语言共用）');
    const logoRow = document.createElement('div'); logoRow.className = 'row';
    logoRow.innerHTML = '<label class="lbl">Logo 图片</label>';
    const flex = document.createElement('div'); flex.style.cssText = 'display:flex;align-items:center;gap:0.6rem';
    const prev = document.createElement('div'); prev.className = 'logo-preview';
    prev.innerHTML = data.brand.logo ? '<img src="' + esc(data.brand.logo) + '">' : '<span style="color:var(--muted);font-size:0.8rem">未设置</span>';
    const up = document.createElement('label'); up.className = 'btn ghost'; up.textContent = '上传 Logo';
    const fi = document.createElement('input'); fi.type = 'file'; fi.accept = 'image/*'; fi.className = 'hidden';
    fi.addEventListener('change', async () => { if (!fi.files[0]) return; up.textContent = '上传中...'; try { const r = await uploadFile(fi.files[0]); data.brand.logo = r.url; markDirty(); renderBrand(); } catch (e) { toast(e.message, 'bad'); } });
    up.appendChild(fi); flex.appendChild(prev); flex.appendChild(up);
    flex.appendChild(pickBtn('从媒体库选', (f) => { data.brand.logo = f.url; markDirty(); renderBrand(); }));
    logoRow.appendChild(flex); c0.appendChild(logoRow);
    c0.appendChild(field('默认语言', data, 'defaultLang', { select: true, options: (data.langs || []).map((l) => ({ value: l.code, label: l.code + ' · ' + l.label })) }));
    sec.appendChild(c0);

    // 语言列表（共用）
    const cL = card('语言列表（共用）');
    hint(cL, '语言切换器里显示的名称与文字方向（rtl 用于阿拉伯语等从右到左的语言）');
    data.langs = data.langs || [];
    renderList(cL, data.langs, {
      label: (l) => l.code, rerender: renderBrand, confirm: '删除该语言？该语言下的所有内容也会失效',
      fields: (l, host) => {
        const g = document.createElement('div'); g.className = 'grid3';
        g.appendChild(field('代码', l, 'code', { placeholder: 'en' }));
        g.appendChild(field('显示名称', l, 'label', { placeholder: 'English' }));
        g.appendChild(field('方向', l, 'dir', { select: true, options: [{ value: 'ltr', label: '从左到右 ltr' }, { value: 'rtl', label: '从右到左 rtl' }] }));
        host.appendChild(g);
      },
      addLabel: '+ 添加语言', makeDefault: () => ({ code: 'xx', label: '新语言', dir: 'ltr' }),
    });
    sec.appendChild(cL);

    // 当前语言品牌与导航
    const l = L();
    const c1 = card('【' + lang + '】品牌与导航');
    c1.appendChild(field('品牌名称（文字 Logo / 页脚显示）', l, 'brandName'));
    l.nav = l.nav || { links: [], cta: '' };
    c1.appendChild(field('导航按钮文字', l.nav, 'cta'));
    const navHost = document.createElement('div'); navHost.className = 'row';
    navHost.innerHTML = '<label class="lbl">导航菜单</label>';
    hint(navHost, '锚点链接如 #need-section / #all-products；含“在线咨询/Inquiry”等且链接为 # 时会自动打开客服窗口');
    renderList(navHost, l.nav.links, {
      label: (x, i) => '菜单 ' + (i + 1), rerender: renderBrand,
      fields: (x, host) => { const g = document.createElement('div'); g.className = 'grid2'; g.appendChild(field('文字', x, 'label')); g.appendChild(field('链接', x, 'href')); host.appendChild(g); },
      addLabel: '+ 添加菜单', makeDefault: () => ({ label: '新菜单', href: '#' }),
    });
    c1.appendChild(navHost);
    sec.appendChild(c1);
  }

  function renderHero() {
    const sec = $('#secHero'); sec.innerHTML = '';
    const l = L(); l.hero = l.hero || {};
    const h = l.hero;
    const c1 = card('【' + lang + '】首屏文案');
    c1.appendChild(field('小标签', h, 'eyebrow'));
    c1.appendChild(field('大标题', h, 'title', { textarea: true, rows: 2, hint: '用 *星号* 包住要高亮的文字；换行用回车。例：找到*最适合*\\n你的*开槽机*' }));
    c1.appendChild(field('副标题', h, 'subtitle', { textarea: true, rows: 2 }));
    c1.appendChild(field('按钮文字', h, 'cta'));
    sec.appendChild(c1);
    const cSeo = card('SEO（搜索引擎显示）');
    hint(cSeo, '影响该语言首页在搜索结果/分享时显示的标题与描述');
    l.meta = l.meta || {};
    cSeo.appendChild(field('页面标题', l.meta, 'title'));
    cSeo.appendChild(field('页面描述', l.meta, 'description', { textarea: true, rows: 2, placeholder: '一句话介绍，约 60-120 字，用于搜索结果摘要' }));
    sec.appendChild(cSeo);
    const c2 = card('数据指标');
    h.stats = h.stats || [];
    renderList(c2, h.stats, {
      label: (x, i) => '指标 ' + (i + 1), rerender: renderHero,
      fields: (x, host) => { const g = document.createElement('div'); g.className = 'grid2'; g.appendChild(field('数值', x, 'num')); g.appendChild(field('说明', x, 'label')); host.appendChild(g); },
      addLabel: '+ 添加指标', makeDefault: () => ({ num: '', label: '' }),
    });
    sec.appendChild(c2);
  }

  function renderWizard() {
    const sec = $('#secWizard'); sec.innerHTML = '';
    const l = L(); l.wizard = l.wizard || {};
    const w = l.wizard;
    const c1 = card('【' + lang + '】板块文案');
    c1.appendChild(field('标签', w, 'tag'));
    c1.appendChild(field('标题', w, 'title', { textarea: true, rows: 2, hint: '换行用回车，*星号*高亮' }));
    c1.appendChild(field('副标题', w, 'subtitle'));
    const g = document.createElement('div'); g.className = 'grid2';
    g.appendChild(field('步骤1 标题', w, 'step1')); g.appendChild(field('步骤2 标题', w, 'step2'));
    g.appendChild(field('步骤3 标题', w, 'step3')); g.appendChild(field('步骤4 标题', w, 'step4'));
    c1.appendChild(g);
    c1.appendChild(field('推荐结果标题', w, 'resultTitle'));
    sec.appendChild(c1);

    const mkGroup = (title, key, addLabel, def, fieldsFn) => {
      const c = card(title); w[key] = w[key] || [];
      renderList(c, w[key], { label: (x, i) => '#' + (i + 1), rerender: renderWizard, addLabel, makeDefault: def, fields: fieldsFn });
      sec.appendChild(c);
    };
    mkGroup('步骤1 · 材料', 'materials', '+ 添加材料', () => ({ key: 'new', icon: '📦', name: '', desc: '' }), (x, host) => {
      const g = document.createElement('div'); g.className = 'grid2'; g.appendChild(field('标识key', x, 'key')); g.appendChild(field('图标', x, 'icon'));
      host.appendChild(g); host.appendChild(field('名称', x, 'name')); host.appendChild(field('说明', x, 'desc'));
    });
    mkGroup('步骤2 · 厚度', 'thickness', '+ 添加厚度', () => ({ key: 'thin', icon: '📐', title: '', desc: '' }), (x, host) => {
      const g = document.createElement('div'); g.className = 'grid3';
      g.appendChild(field('标识key', x, 'key', { hint: 'thin/medium/thick/custom' })); g.appendChild(field('图标', x, 'icon')); g.appendChild(field('标题', x, 'title'));
      host.appendChild(g); host.appendChild(field('说明', x, 'desc'));
    });
    mkGroup('步骤3 · 产量规模', 'scale', '+ 添加规模', () => ({ key: 'small', icon: '1️⃣', title: '', desc: '' }), (x, host) => {
      const g = document.createElement('div'); g.className = 'grid3';
      g.appendChild(field('标识key', x, 'key', { hint: 'small/medium/large' })); g.appendChild(field('图标', x, 'icon')); g.appendChild(field('标题', x, 'title'));
      host.appendChild(g); host.appendChild(field('说明', x, 'desc'));
    });
    mkGroup('步骤4 · 特殊功能', 'features', '+ 添加功能', () => ({ key: 'new', label: '' }), (x, host) => {
      const g = document.createElement('div'); g.className = 'grid2'; g.appendChild(field('标识key', x, 'key')); g.appendChild(field('文字', x, 'label')); host.appendChild(g);
    });
  }

  function renderProducts() {
    const l = L(); l.productsSection = l.productsSection || {}; l.products = l.products || [];
    if (editIdx != null && l.products[editIdx]) return renderProductEditor(l.products[editIdx], l.products);
    editIdx = null;
    renderProductList(l);
  }

  function ownerName(id) { if (!id) return '—'; const u = (usersCache || []).find((x) => x.id === id || x.username === id); return u ? u.name : id; }
  function fmtTime(ms) { if (!ms) return '—'; const d = new Date(ms); const p = (n) => (n < 10 ? '0' + n : n); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); }

  function canAll() { return me && (me.role === 'admin' || me.role === 'editor'); }
  function getCats() { const l = L(); l.categories = l.categories || []; return l.categories; }

  // 分类管理卡片（一级 + 二级），仅管理员/制作员
  function renderCategoryManager(sec) {
    const l = L(); l.categories = l.categories || [];
    const c = card('产品分类管理');
    hint(c, '在这里维护产品分类（可含二级分类）；发布产品时从下拉选择，无需每次手填。二级分类用逗号分隔。');
    renderList(c, l.categories, {
      label: (x, i) => '分类 ' + (i + 1), rerender: renderProducts, addLabel: '+ 添加分类', makeDefault: () => ({ name: '新分类', subs: [] }),
      fields: (x, host) => { host.appendChild(field('分类名称', x, 'name')); host.appendChild(csvField('二级分类（逗号分隔，可留空）', x, 'subs')); },
    });
    sec.appendChild(c);
  }

  // ---------- 产品列表（表格） ----------
  function renderProductList(l) {
    const sec = $('#secProducts'); sec.innerHTML = '';
    if (canAll()) {
      const c1 = card('【' + lang + '】板块文案');
      c1.appendChild(field('标签', l.productsSection, 'tag'));
      c1.appendChild(field('标题', l.productsSection, 'title', { textarea: true, rows: 2, hint: '换行用回车，*星号*高亮' }));
      c1.appendChild(field('副标题', l.productsSection, 'subtitle'));
      sec.appendChild(c1);
      renderCategoryManager(sec);
    }

    const c2 = card('产品列表');
    const catNames = getCats().map((c) => c.name);
    const owners = [...new Set(l.products.map((p) => p.owner).filter(Boolean))];

    // 标签页：普通 / 卖点 / 已删除
    const counts = { normal: l.products.filter((p) => !p.deleted).length, featured: l.products.filter((p) => !p.deleted && p.featured).length, deleted: l.products.filter((p) => p.deleted).length };
    const tabs = document.createElement('div'); tabs.className = 'ptabs';
    [['normal', '普通产品'], ['featured', '卖点产品'], ['deleted', '已删除']].forEach(([k, lbl]) => {
      const b = document.createElement('button'); b.className = 'ptab' + (prodTab === k ? ' active' : ''); b.textContent = lbl + ' (' + counts[k] + ')';
      b.addEventListener('click', () => { prodTab = k; renderProducts(); });
      tabs.appendChild(b);
    });
    c2.appendChild(tabs);

    // 工具栏
    const tb = document.createElement('div'); tb.className = 'ptoolbar';
    const searchInp = document.createElement('input'); searchInp.className = 'inp'; searchInp.placeholder = '搜索产品名称/ID…'; searchInp.value = prodFilter.q;
    const catSel = document.createElement('select'); catSel.className = 'inp'; catSel.innerHTML = '<option value="">所有分类</option>' + catNames.map((c) => '<option' + (prodFilter.cat === c ? ' selected' : '') + '>' + esc(c) + '</option>').join('');
    tb.appendChild(searchInp); tb.appendChild(catSel);
    let ownerSel = null;
    if (canAll()) { ownerSel = document.createElement('select'); ownerSel.className = 'inp'; ownerSel.innerHTML = '<option value="">所有负责人</option>' + owners.map((o) => '<option value="' + esc(o) + '"' + (prodFilter.owner === o ? ' selected' : '') + '>' + esc(ownerName(o)) + '</option>').join(''); tb.appendChild(ownerSel); }
    const count = document.createElement('span'); count.className = 'count';
    const grow = document.createElement('span'); grow.className = 'grow';
    tb.appendChild(count); tb.appendChild(grow);
    if (canAll()) { const exBtn = document.createElement('button'); exBtn.className = 'btn ghost'; exBtn.textContent = '⬇ 导出'; exBtn.addEventListener('click', exportExcel); const imLabel = document.createElement('label'); imLabel.className = 'btn ghost'; imLabel.textContent = '⬆ 导入'; const imFi = document.createElement('input'); imFi.type = 'file'; imFi.accept = '.xlsx,.xls,.csv'; imFi.className = 'hidden'; imFi.addEventListener('change', () => { if (imFi.files[0]) importExcel(imFi.files[0]); imFi.value = ''; }); imLabel.appendChild(imFi); tb.appendChild(exBtn); tb.appendChild(imLabel); }
    const pubBtn = document.createElement('button'); pubBtn.className = 'btn'; pubBtn.textContent = '发布新产品'; tb.appendChild(pubBtn);
    c2.appendChild(tb);

    // 批量操作栏
    const bulk = document.createElement('div'); bulk.className = 'ptoolbar';
    const mkBulk = (label, cls, fn) => { const b = document.createElement('button'); b.className = 'btn ' + (cls || 'ghost'); b.textContent = label; b.addEventListener('click', fn); return b; };
    const checkedIdx = () => Array.from(tbody.querySelectorAll('tr')).filter((tr) => tr.style.display !== 'none' && tr.querySelector('.pchk').checked).map((tr) => +tr.dataset.idx);
    if (prodTab === 'deleted') {
      bulk.appendChild(mkBulk('恢复所选', '', () => { const ix = checkedIdx(); if (!ix.length) return toast('请先勾选', 'bad'); ix.forEach((i) => { l.products[i].deleted = false; }); markDirty(); renderProducts(); }));
      bulk.appendChild(mkBulk('彻底删除', 'ghost', () => { const ix = checkedIdx().sort((a, b) => b - a); if (!ix.length) return toast('请先勾选', 'bad'); if (!confirm('彻底删除选中的 ' + ix.length + ' 个产品？不可恢复')) return; ix.forEach((i) => l.products.splice(i, 1)); markDirty(); renderProducts(); }));
    } else {
      bulk.appendChild(mkBulk('调整分类', '', async () => { const ix = checkedIdx(); if (!ix.length) return toast('请先勾选', 'bad'); const v = await chooseModal('批量调整分类', [{ value: '', label: '（清空分类）' }].concat(catNames.map((c) => ({ value: c, label: c })))); if (v === null) return; ix.forEach((i) => { l.products[i].category = v; }); markDirty(); renderProducts(); }));
      if (canAll()) bulk.appendChild(mkBulk('调整负责人', '', async () => { const ix = checkedIdx(); if (!ix.length) return toast('请先勾选', 'bad'); const v = await chooseModal('批量调整负责人', [{ value: '', label: '未分配' }].concat((usersCache || []).map((u) => ({ value: u.id, label: u.name })))); if (v === null) return; ix.forEach((i) => { l.products[i].owner = v; }); markDirty(); renderProducts(); }));
      bulk.appendChild(mkBulk(prodTab === 'featured' ? '取消卖点' : '设为卖点', '', () => { const ix = checkedIdx(); if (!ix.length) return toast('请先勾选', 'bad'); ix.forEach((i) => { l.products[i].featured = prodTab !== 'featured'; }); markDirty(); renderProducts(); }));
      bulk.appendChild(mkBulk('删除所选', 'ghost', () => { const ix = checkedIdx(); if (!ix.length) return toast('请先勾选', 'bad'); if (!confirm('删除选中的 ' + ix.length + ' 个产品？（进入「已删除」可恢复）')) return; ix.forEach((i) => { l.products[i].deleted = true; }); markDirty(); renderProducts(); }));
    }
    c2.appendChild(bulk);

    // 表格
    const table = document.createElement('table'); table.className = 'ptable';
    table.innerHTML = '<thead><tr><th><input type="checkbox" id="pAll"></th><th>产品图片</th><th>产品</th>' + (canAll() ? '<th>负责人</th>' : '') + '<th>发布时间</th><th>更新时间</th><th class="pt-ops">操作</th></tr></thead>';
    const tbody = document.createElement('tbody'); table.appendChild(tbody);
    l.products.forEach((p, i) => {
      const inTab = prodTab === 'deleted' ? p.deleted : (prodTab === 'featured' ? (!p.deleted && p.featured) : !p.deleted);
      if (!inTab) return;
      const cover = p.cardImage || (p.gallery && p.gallery[0] && p.gallery[0].src) || '';
      const tr = document.createElement('tr'); tr.dataset.idx = i;
      tr.dataset.name = ((p.name || '') + ' ' + (p.slug || '') + ' ' + (p.id || '')).toLowerCase(); tr.dataset.cat = p.category || ''; tr.dataset.owner = p.owner || '';
      tr.innerHTML =
        '<td><input type="checkbox" class="pchk"></td>' +
        '<td><div class="pt-thumb">' + (cover ? '<img src="' + esc(cover) + '">' : '📦') + '</div></td>' +
        '<td><div class="pt-name">' + esc(p.name || '(未命名)') + (p.featured ? ' ⭐' : '') + '</div><div class="pt-sub">' + (p.category ? esc(p.category) + (p.subCategory ? ' / ' + esc(p.subCategory) : '') + ' · ' : '') + '/' + esc(p.slug || p.id || '') + '</div></td>' +
        (canAll() ? '<td>' + esc(ownerName(p.owner)) + '</td>' : '') +
        '<td class="pt-sub">' + fmtTime(p.createdAt) + '</td>' +
        '<td class="pt-sub">' + fmtTime(p.updatedAt || p.createdAt) + '</td>' +
        '<td class="pt-ops"></td>';
      const ops = tr.querySelector('.pt-ops');
      if (prodTab === 'deleted') {
        const bR = document.createElement('button'); bR.textContent = '恢复'; bR.addEventListener('click', () => { p.deleted = false; markDirty(); renderProducts(); });
        const bP = document.createElement('button'); bP.className = 'del'; bP.textContent = '彻底删除'; bP.addEventListener('click', () => { if (confirm('彻底删除「' + (p.name || '') + '」？不可恢复')) { l.products.splice(i, 1); markDirty(); renderProducts(); } });
        ops.appendChild(bR); ops.appendChild(bP);
      } else {
        const bEdit = document.createElement('button'); bEdit.textContent = '编辑'; bEdit.addEventListener('click', () => { editIdx = i; renderProducts(); window.scrollTo(0, 0); });
        const bCopy = document.createElement('button'); bCopy.textContent = '复制'; bCopy.addEventListener('click', () => duplicateProduct(l.products, i));
        const bDel = document.createElement('button'); bDel.className = 'del'; bDel.textContent = '删除'; bDel.addEventListener('click', () => { if (confirm('删除产品「' + (p.name || '') + '」？（进入「已删除」可恢复）')) { p.deleted = true; markDirty(); renderProducts(); } });
        ops.appendChild(bEdit); ops.appendChild(bCopy); ops.appendChild(bDel);
        tr.querySelector('.pt-name').addEventListener('click', () => { editIdx = i; renderProducts(); window.scrollTo(0, 0); });
      }
      tbody.appendChild(tr);
    });
    c2.appendChild(table);
    sec.appendChild(c2);

    function applyFilter() {
      const q = prodFilter.q.toLowerCase(); let shown = 0;
      tbody.querySelectorAll('tr').forEach((tr) => {
        const ok = (!q || tr.dataset.name.indexOf(q) > -1) && (!prodFilter.cat || tr.dataset.cat === prodFilter.cat) && (!prodFilter.owner || tr.dataset.owner === prodFilter.owner);
        tr.style.display = ok ? '' : 'none'; if (ok) shown++;
      });
      count.textContent = '共 ' + shown + ' 个';
    }
    searchInp.addEventListener('input', () => { prodFilter.q = searchInp.value; applyFilter(); });
    catSel.addEventListener('change', () => { prodFilter.cat = catSel.value; applyFilter(); });
    if (ownerSel) ownerSel.addEventListener('change', () => { prodFilter.owner = ownerSel.value; applyFilter(); });
    $('#pAll', table).addEventListener('change', (e) => { tbody.querySelectorAll('tr').forEach((tr) => { if (tr.style.display !== 'none') tr.querySelector('.pchk').checked = e.target.checked; }); });
    pubBtn.addEventListener('click', () => {
      l.products.push({ id: 'p' + Date.now(), slug: 'p' + Date.now(), name: '新产品', category: '', subCategory: '', owner: (me && me.id) || '', createdAt: Date.now(), updatedAt: Date.now(), badge: '', gallery: [], specs: [], benefits: [], delivery: [], highlights: [], related: [], cardTags: [], match: [], price: {}, attrs: {}, trade: {}, customAttrs: [], description: '' });
      editIdx = l.products.length - 1; markDirty(); renderProducts(); window.scrollTo(0, 0);
    });
    applyFilter();
  }

  function duplicateProduct(list, i) {
    const src = list[i];
    const copy = deepClone(src);
    copy.id = 'p' + Date.now();
    copy.slug = (src.slug || src.id || 'p') + '-copy';
    copy.name = (src.name || '') + ' 副本';
    copy.createdAt = Date.now(); copy.updatedAt = Date.now();
    list.splice(i + 1, 0, copy); markDirty(); renderProducts();
    toast('已复制，可编辑后保存', 'ok');
  }

  // ---------- 单个产品编辑 ----------
  function renderProductEditor(p, list) {
    const sec = $('#secProducts'); sec.innerHTML = '';
    const bar = document.createElement('div'); bar.style.cssText = 'display:flex;align-items:center;gap:0.8rem;margin-bottom:1rem';
    const back = document.createElement('button'); back.className = 'btn ghost'; back.textContent = '← 返回产品列表';
    back.addEventListener('click', () => { editIdx = null; renderProducts(); window.scrollTo(0, 0); });
    const t = document.createElement('div'); t.style.cssText = 'font-weight:600'; t.textContent = '📦 ' + (p.name || '新产品') + '（' + lang + '）';
    bar.appendChild(back); bar.appendChild(t); sec.appendChild(bar);

    // 基本信息
    const cb = card('基本信息');
    const g1 = document.createElement('div'); g1.className = 'grid2';
    g1.appendChild(field('产品名称', p, 'name')); g1.appendChild(field('网址标识 slug', p, 'slug', { placeholder: 'manual' }));
    cb.appendChild(g1);
    const cats = getCats();
    const names = cats.map((c) => c.name);
    if (p.category && names.indexOf(p.category) === -1) names.unshift(p.category);
    const catOptions = [{ value: '', label: '未分类' }].concat(names.map((n) => ({ value: n, label: n })));
    const g1b = document.createElement('div'); g1b.className = 'grid2';
    g1b.appendChild(field('产品分类', p, 'category', { select: true, options: catOptions, onInput: () => { p.subCategory = ''; renderProducts(); } }));
    const cc = cats.find((c) => c.name === p.category);
    if (cc && (cc.subs || []).length) g1b.appendChild(field('二级分类', p, 'subCategory', { select: true, options: [{ value: '', label: '（无）' }].concat((cc.subs || []).map((s) => ({ value: s, label: s }))) }));
    else g1b.appendChild(document.createElement('div'));
    cb.appendChild(g1b);
    const g1c = document.createElement('div'); g1c.className = 'grid2';
    if (canAll()) {
      g1c.appendChild(field('负责人', p, 'owner', { select: true, options: [{ value: '', label: '未分配' }].concat((usersCache || []).map((u) => ({ value: u.id, label: u.name + '（' + (ROLE_LABEL[u.role] || u.role) + '）' }))) }));
    } else {
      const info = document.createElement('div'); info.className = 'row'; info.innerHTML = '<label class="lbl">负责人</label><div style="color:var(--muted);font-size:0.85rem;padding:0.4rem 0">' + esc((me && me.name) || '我') + '（本人）</div>'; g1c.appendChild(info);
    }
    g1c.appendChild(field('设为卖点产品', p, 'featured', { select: true, options: [{ value: 'false', label: '否' }, { value: 'true', label: '是' }], onInput: (v) => { p.featured = v === 'true'; } }));
    cb.appendChild(g1c);
    const g2 = document.createElement('div'); g2.className = 'grid2';
    g2.appendChild(field('徽章文字', p, 'badge', { placeholder: '入门级' }));
    g2.appendChild(field('徽章样式class', p, 'badgeClass', { placeholder: 'entry/pro/expert/highend/portable/industrial' }));
    cb.appendChild(g2);
    cb.appendChild(field('副标题（详情页标题下的介绍）', p, 'subtitle', { textarea: true, rows: 2 }));
    cb.appendChild(field('首页卡片描述', p, 'cardDesc', { textarea: true, rows: 2 }));
    const g3 = document.createElement('div'); g3.className = 'grid2';
    g3.appendChild(csvField('首页卡片标签(逗号)', p, 'cardTags'));
    g3.appendChild(csvField('选型匹配(逗号)', p, 'match', { hint: 'thin/medium/thick/custom, small/large' }));
    cb.appendChild(g3);
    const coverRow = document.createElement('div'); coverRow.className = 'row';
    coverRow.innerHTML = '<label class="lbl">首页卡片封面图</label>';
    if (p.cardImage) { const pv = document.createElement('div'); pv.className = 'logo-preview'; pv.style.marginBottom = '0.4rem'; pv.innerHTML = '<img src="' + esc(p.cardImage) + '">'; coverRow.appendChild(pv); }
    coverRow.appendChild(field('', p, 'cardImage', { placeholder: '/uploads/xxx.jpg 或图片直链' }));
    const coverUp = document.createElement('label'); coverUp.className = 'btn ghost'; coverUp.textContent = '上传封面图';
    const cfi = document.createElement('input'); cfi.type = 'file'; cfi.accept = 'image/*'; cfi.className = 'hidden';
    cfi.addEventListener('change', async () => { if (!cfi.files[0]) return; coverUp.textContent = '上传中...'; try { const r = await uploadFile(cfi.files[0]); p.cardImage = r.url; markDirty(); renderProducts(); } catch (e) { toast(e.message, 'bad'); } });
    coverUp.appendChild(cfi); coverRow.appendChild(coverUp);
    coverRow.appendChild(pickBtn('从媒体库选', (f) => { p.cardImage = f.url; markDirty(); renderProducts(); }));
    cb.appendChild(coverRow);
    sec.appendChild(cb);

    // 产品属性
    p.attrs = p.attrs || {};
    const cattr = card('产品属性');
    const ag = document.createElement('div'); ag.className = 'grid2';
    ag.appendChild(field('品牌', p.attrs, 'brand')); ag.appendChild(field('型号', p.attrs, 'model'));
    ag.appendChild(field('认证证书', p.attrs, 'cert', { placeholder: 'CE / ISO9001' })); ag.appendChild(field('原产地', p.attrs, 'origin', { placeholder: 'China' }));
    cattr.appendChild(ag);
    const cac = document.createElement('div'); cac.innerHTML = '<label class="lbl">自定义属性</label>'; p.customAttrs = p.customAttrs || [];
    renderList(cac, p.customAttrs, { label: (x, i) => '属性 ' + (i + 1), rerender: renderProducts, addLabel: '+ 自定义属性', makeDefault: () => ({ name: '', value: '' }), fields: (x, host) => {
      const g = document.createElement('div'); g.className = 'grid2'; g.appendChild(field('属性名', x, 'name', { placeholder: '如 电压' })); g.appendChild(field('属性值', x, 'value', { placeholder: '如 220V' })); host.appendChild(g);
    } }); cattr.appendChild(cac);
    sec.appendChild(cattr);

    // 图集（图片/视频）
    const cg = card('详情页图集（图片 / 视频，第一个为主图）');
    hint(cg, '支持上传视频（mp4/webm/mov，最大 300MB）与图片；也可从媒体库选择已上传的文件。');
    p.gallery = p.gallery || [];
    const gc = document.createElement('div');
    mediaEditor(gc, p.gallery, renderProducts, 'image/*,video/*');
    gc.appendChild(pickBtn('从媒体库添加', (f) => { p.gallery.push({ type: f.type, src: f.url, alt: '' }); markDirty(); renderProducts(); }));
    cg.appendChild(gc); sec.appendChild(cg);

    // 交易信息
    p.price = p.price || {}; p.trade = p.trade || {};
    const cp = card('交易信息');
    const pg = document.createElement('div'); pg.className = 'grid3';
    pg.appendChild(field('主价格', p.price, 'main', { placeholder: '¥8,800' }));
    pg.appendChild(field('后缀', p.price, 'cny', { placeholder: '起' }));
    pg.appendChild(field('副价格', p.price, 'usd', { placeholder: '约 $1,210 USD' }));
    cp.appendChild(pg);
    const pg2 = document.createElement('div'); pg2.className = 'grid2';
    pg2.appendChild(field('价格标签', p.price, 'label', { placeholder: '参考价格' }));
    pg2.appendChild(field('价格备注', p.price, 'note'));
    cp.appendChild(pg2);
    const tg = document.createElement('div'); tg.className = 'grid2';
    tg.appendChild(field('最小起订量', p.trade, 'moq', { placeholder: '1 套' }));
    tg.appendChild(field('供货能力', p.trade, 'supplyAbility', { placeholder: '100 套 / 月' }));
    cp.appendChild(tg);
    const tg2 = document.createElement('div'); tg2.className = 'grid2';
    tg2.appendChild(field('发货期限', p.trade, 'deliveryTime', { placeholder: '5-8 work days' }));
    tg2.appendChild(field('常规包装', p.trade, 'packaging', { placeholder: '木箱 / 托盘' }));
    cp.appendChild(tg2);
    cp.appendChild(csvField('付款方式（逗号分隔）', p.trade, 'payments', { placeholder: 'L/C, T/T, D/P, Western Union' }));
    const g4 = document.createElement('div'); g4.className = 'grid2';
    g4.appendChild(field('主按钮文字', p, 'ctaPrimary')); g4.appendChild(field('次按钮文字', p, 'ctaSecondary'));
    cp.appendChild(g4);
    hint(cp, '主按钮打开在线客服；次按钮优先下载下方「参数表文件」地址，未填则自动生成产品参数 txt。');
    cp.appendChild(field('参数表文件 URL（可选）', p, 'downloadUrl', { placeholder: '/uploads/xxx.pdf 或 https://...' }));
    sec.appendChild(cp);

    // 交付与信任
    const cd = card('交付标签与信任徽章');
    const dc = document.createElement('div'); dc.innerHTML = '<label class="lbl">交付标签</label>'; p.delivery = p.delivery || [];
    renderList(dc, p.delivery, { label: (x, i) => '标签 ' + (i + 1), rerender: renderProducts, addLabel: '+ 交付标签', makeDefault: () => ({ text: '', green: false }), fields: (x, host) => {
      const g = document.createElement('div'); g.className = 'grid2'; g.appendChild(field('文字', x, 'text', { placeholder: '✅ 现货供应' }));
      g.appendChild(field('高亮绿色', x, 'green', { select: true, options: [{ value: 'false', label: '否' }, { value: 'true', label: '是' }], onInput: (v) => { x.green = v === 'true'; } })); host.appendChild(g);
    } }); cd.appendChild(dc);
    const tc = document.createElement('div'); tc.className = 'row'; tc.innerHTML = '<label class="lbl">信任徽章</label>';
    tc.appendChild(csvField('（逗号分隔）', p, 'trustBadges', { placeholder: '✅ CE认证, 💯 30天退货' })); cd.appendChild(tc);
    sec.appendChild(cd);

    // 优势与亮点
    const ca = card('核心优势与亮点');
    const bc = document.createElement('div'); bc.innerHTML = '<label class="lbl">核心优势（图标+文字）</label>'; p.benefits = p.benefits || [];
    renderList(bc, p.benefits, { label: (x, i) => '优势 ' + (i + 1), rerender: renderProducts, addLabel: '+ 优势', makeDefault: () => ({ icon: '🎯', text: '' }), fields: (x, host) => {
      const g = document.createElement('div'); g.className = 'grid2'; g.appendChild(field('图标', x, 'icon')); g.appendChild(field('文字', x, 'text')); host.appendChild(g);
    } }); ca.appendChild(bc);
    ca.appendChild(field('亮点标题', p, 'highlightsTitle', { placeholder: '🔥 核心亮点' }));
    ca.appendChild(field('产品亮点（每行一条）', { v: (p.highlights || []).join('\n') }, 'v', { textarea: true, rows: 4, onInput: (val) => { p.highlights = val.split('\n').map((s) => s.trim()).filter(Boolean); } }));
    sec.appendChild(ca);

    // 技术参数
    const cs = card('技术参数');
    cs.appendChild(field('参数标题', p, 'specsTitle', { placeholder: '📋 技术规格' }));
    const spc = document.createElement('div'); p.specs = p.specs || [];
    renderList(spc, p.specs, { label: (x, i) => '参数 ' + (i + 1), rerender: renderProducts, addLabel: '+ 参数', makeDefault: () => ({ k: '', v: '' }), fields: (x, host) => {
      const g = document.createElement('div'); g.className = 'grid2'; g.appendChild(field('名称', x, 'k', { placeholder: '最大厚度' })); g.appendChild(field('值', x, 'v', { placeholder: '1-5mm' })); host.appendChild(g);
    } }); cs.appendChild(spc); sec.appendChild(cs);

    // 产品描述（富文本）
    const cdesc = card('产品描述');
    hint(cdesc, '富文本，可加粗/列表/链接等；显示在产品详情页下方。');
    cdesc.appendChild(richEditor(p, 'description'));
    sec.appendChild(cdesc);

    // 相关推荐
    const cr = card('相关推荐');
    cr.appendChild(field('相关推荐标题', p, 'relatedTitle'));
    const rc = document.createElement('div'); rc.innerHTML = '<label class="lbl">相关产品（slug 对应其它产品的网址标识）</label>'; p.related = p.related || [];
    renderList(rc, p.related, { label: (x, i) => '推荐 ' + (i + 1), rerender: renderProducts, addLabel: '+ 相关产品', makeDefault: () => ({ slug: '', name: '', note: '' }), fields: (x, host) => {
      const g = document.createElement('div'); g.className = 'grid3'; g.appendChild(field('slug', x, 'slug')); g.appendChild(field('名称', x, 'name')); g.appendChild(field('备注', x, 'note')); host.appendChild(g);
    } }); cr.appendChild(rc); sec.appendChild(cr);

    // 底部返回 + 保存
    const foot = document.createElement('div'); foot.style.cssText = 'display:flex;gap:0.6rem;margin-top:0.5rem';
    const back2 = document.createElement('button'); back2.className = 'btn ghost'; back2.textContent = '← 返回列表'; back2.addEventListener('click', () => { editIdx = null; renderProducts(); window.scrollTo(0, 0); });
    const save2 = document.createElement('button'); save2.className = 'btn'; save2.textContent = '保存全部修改'; save2.addEventListener('click', save);
    foot.appendChild(back2); foot.appendChild(save2); sec.appendChild(foot);
  }

  function syncProductMedia(p) {
    const key = p.slug || p.id;
    if (!confirm('把「' + (p.name || key) + '」的图集、封面图、价格同步到其它所有语言？（各语言里 slug/id 相同的产品会被覆盖这三项）')) return;
    let n = 0;
    Object.keys(data.i18n || {}).forEach((code) => {
      if (code === lang) return;
      const arr = (data.i18n[code].products) || [];
      const tp = arr.find((x) => (x.slug || x.id) === key);
      if (tp) { tp.gallery = deepClone(p.gallery); tp.cardImage = p.cardImage; tp.price = deepClone(p.price); n++; }
    });
    markDirty(); toast('已同步到 ' + n + ' 个语言', 'ok');
  }

  // ============ 产品 Excel 导入/导出 ============
  function prodToRow(p) {
    return {
      id: p.id || '', slug: p.slug || '', name: p.name || '', badge: p.badge || '', badgeClass: p.badgeClass || '',
      subtitle: p.subtitle || '', cardDesc: p.cardDesc || '',
      cardTags: (p.cardTags || []).join(', '), match: (p.match || []).join(', '),
      priceMain: (p.price && p.price.main) || '', priceCny: (p.price && p.price.cny) || '', priceUsd: (p.price && p.price.usd) || '', priceNote: (p.price && p.price.note) || '',
      ctaPrimary: p.ctaPrimary || '', ctaSecondary: p.ctaSecondary || '',
      trustBadges: (p.trustBadges || []).join(', '),
      highlightsTitle: p.highlightsTitle || '', highlights: (p.highlights || []).join(' | '),
      specsTitle: p.specsTitle || '', specs: (p.specs || []).map((s) => s.k + '=' + s.v).join(' | '),
    };
  }
  function applyRow(p, row) {
    const S = (k) => (row[k] == null ? '' : String(row[k]).trim());
    const arr = (k, sep) => S(k) ? S(k).split(sep).map((x) => x.trim()).filter(Boolean) : [];
    if (S('name')) p.name = S('name');
    if (S('slug')) p.slug = S('slug');
    p.badge = S('badge'); p.badgeClass = S('badgeClass'); p.subtitle = S('subtitle'); p.cardDesc = S('cardDesc');
    p.cardTags = arr('cardTags', /[,，]/); p.match = arr('match', /[,，]/); p.trustBadges = arr('trustBadges', /[,，]/);
    p.price = p.price || {}; p.price.main = S('priceMain'); p.price.cny = S('priceCny'); p.price.usd = S('priceUsd'); p.price.note = S('priceNote');
    p.ctaPrimary = S('ctaPrimary'); p.ctaSecondary = S('ctaSecondary');
    p.highlightsTitle = S('highlightsTitle'); p.highlights = arr('highlights', '|');
    p.specsTitle = S('specsTitle');
    p.specs = arr('specs', '|').map((kv) => { const i = kv.indexOf('='); return { k: (i > -1 ? kv.slice(0, i) : kv).trim(), v: (i > -1 ? kv.slice(i + 1) : '').trim() }; });
    return p;
  }
  function exportExcel() {
    if (!window.XLSX) return toast('Excel 组件未加载', 'bad');
    const wb = XLSX.utils.book_new();
    (data.langs || []).forEach((l) => {
      const rows = ((data.i18n[l.code] && data.i18n[l.code].products) || []).map(prodToRow);
      const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [prodToRow({})]);
      XLSX.utils.book_append_sheet(wb, ws, l.code.slice(0, 31));
    });
    XLSX.writeFile(wb, 'vgrooving-products-' + new Date().toISOString().slice(0, 10) + '.xlsx');
  }
  function importExcel(file) {
    if (!window.XLSX) return toast('Excel 组件未加载', 'bad');
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const wb = XLSX.read(rd.result, { type: 'array' });
        let updated = 0, added = 0;
        wb.SheetNames.forEach((sheet) => {
          const code = sheet.trim();
          if (!(data.i18n && data.i18n[code])) return; // 只导入已存在的语言
          const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet]);
          const list = data.i18n[code].products = data.i18n[code].products || [];
          rows.forEach((row) => {
            const key = String(row.slug || row.id || '').trim();
            if (!key && !row.name) return;
            let p = list.find((x) => (x.slug || x.id) === key || x.id === key);
            if (p) { applyRow(p, row); updated++; }
            else { p = applyRow({ id: key || 'p' + Date.now() + added, slug: key || undefined, gallery: [], benefits: [], delivery: [], related: [] }, row); if (!p.slug) p.slug = p.id; list.push(p); added++; }
          });
        });
        markDirty(); toast('导入完成：更新 ' + updated + ' 项，新增 ' + added + ' 项，请检查后保存', 'ok');
        renderProducts();
      } catch (e) { toast('导入失败：' + e.message, 'bad'); }
    };
    rd.readAsArrayBuffer(file);
  }

  function renderContact() {
    const sec = $('#secContact'); sec.innerHTML = '';
    const l = L(); l.contact = l.contact || {};
    const c = l.contact;
    const c1 = card('【' + lang + '】页面文案');
    c1.appendChild(field('标签', c, 'tag')); c1.appendChild(field('标题', c, 'title')); c1.appendChild(field('副标题', c, 'subtitle', { textarea: true, rows: 2 }));
    sec.appendChild(c1);

    const c2 = card('联系方式'); c.methods = c.methods || [];
    renderList(c2, c.methods, { label: (x, i) => '方式 ' + (i + 1), rerender: renderContact, addLabel: '+ 联系方式', makeDefault: () => ({ icon: '📧', label: '', value: '' }), fields: (x, host) => {
      const g = document.createElement('div'); g.className = 'grid3'; g.appendChild(field('图标', x, 'icon')); g.appendChild(field('标签', x, 'label')); g.appendChild(field('内容', x, 'value')); host.appendChild(g);
    } }); sec.appendChild(c2);

    const c3 = card('全球经销商 / 代理商');
    c3.appendChild(field('板块标题', c, 'distributorsTitle')); c.distributors = c.distributors || [];
    renderList(c3, c.distributors, { label: (x, i) => (x.flag || '') + ' ' + (x.name || '经销商'), rerender: renderContact, addLabel: '+ 经销商', makeDefault: () => ({ flag: '🌏', name: '', region: '', desc: '', contact: '' }), fields: (x, host) => {
      const g = document.createElement('div'); g.className = 'grid3'; g.appendChild(field('国旗', x, 'flag')); g.appendChild(field('名称', x, 'name')); g.appendChild(field('地区', x, 'region'));
      host.appendChild(g); host.appendChild(field('描述', x, 'desc')); host.appendChild(field('联系方式', x, 'contact'));
    } }); sec.appendChild(c3);

    const c4 = card('代理招募'); c.agent = c.agent || {};
    c4.appendChild(field('标题', c.agent, 'title')); c4.appendChild(field('描述', c.agent, 'desc', { textarea: true, rows: 2 }));
    const g = document.createElement('div'); g.className = 'grid2'; g.appendChild(field('主按钮', c.agent, 'primaryBtn')); g.appendChild(field('次按钮', c.agent, 'secondaryBtn')); c4.appendChild(g);
    sec.appendChild(c4);

    const c5 = card('询价表单');
    c5.appendChild(field('表单标题', c, 'formTitle'));
    c5.appendChild(field('字段占位符（每行一个：姓名/邮箱/公司/留言）', { v: (c.formFields || []).join('\n') }, 'v', { textarea: true, rows: 4, onInput: (val) => { c.formFields = val.split('\n').map((s) => s.trim()).filter(Boolean); } }));
    c5.appendChild(field('提交按钮文字', c, 'submitText'));
    sec.appendChild(c5);
  }

  function renderChat() {
    const sec = $('#secChat'); sec.innerHTML = '';
    const l = L(); l.chat = l.chat || {};
    const ch = l.chat;
    const tip = card('回复方式说明');
    tip.innerHTML = '<div class="hint" style="margin:0">① <b>固定话术（推荐先配）</b>：下方「自动回复规则」按关键词匹配，命中即回对应内容。<br>' +
      '② <b>AI 智能回复（可选）</b>：在「翻译与备份」里开启 AI 并填写 API Key；未命中关键词时，会调用大模型按客户问题生成回答，失败则用兜底回复。<br>' +
      '③ 若一直回同一句，多半是还没加规则，系统只用了欢迎语/兜底——请先添加规则并点「保存全部修改」。各语言需分别配置。</div>';
    sec.appendChild(tip);
    const c1 = card('【' + lang + '】客服信息');
    const g = document.createElement('div'); g.className = 'grid2'; g.appendChild(field('客服名称', ch, 'agentName')); g.appendChild(field('头像文字', ch, 'avatar'));
    c1.appendChild(g);
    c1.appendChild(field('状态文字', ch, 'status'));
    c1.appendChild(field('欢迎语', ch, 'greeting', { textarea: true, rows: 2 }));
    c1.appendChild(field('兜底回复（无匹配关键词、且未开 AI 时）', ch, 'fallback', { textarea: true, rows: 2, placeholder: '请留下您的邮箱/微信，或点击导航「联系我们」提交询盘，我们尽快报价。' }));
    sec.appendChild(c1);
    const c2 = card('快捷问题'); ch.quickChips = ch.quickChips || [];
    hint(c2, '访客一点即发送；请尽量让文案能命中下方关键词（如含「价格」「气动」）');
    ch.quickChips.forEach((q, i) => {
      const it = document.createElement('div'); it.className = 'list-item'; it.style.cssText = 'display:flex;gap:0.5rem;align-items:center';
      const f = field('', { v: q }, 'v', { onInput: (val) => { ch.quickChips[i] = val; } }); f.style.cssText = 'flex:1;margin:0'; it.appendChild(f);
      it.appendChild(iconBtn('✕', 'del', () => { ch.quickChips.splice(i, 1); markDirty(); renderChat(); })); c2.appendChild(it);
    });
    const addChip = document.createElement('button'); addChip.className = 'add-btn'; addChip.type = 'button'; addChip.textContent = '+ 快捷问题';
    addChip.addEventListener('click', () => { ch.quickChips.push('新问题'); markDirty(); renderChat(); }); c2.appendChild(addChip);
    sec.appendChild(c2);

    const c3 = card('自动回复规则（固定话术）');
    hint(c3, '用户消息包含任一关键词 → 回复对应内容。规则按从上到下优先匹配。');
    ch.replies = ch.replies || [];
    const seed = document.createElement('button'); seed.type = 'button'; seed.className = 'btn ghost'; seed.textContent = '一键填入中文示例规则';
    seed.style.marginBottom = '0.6rem';
    seed.addEventListener('click', () => {
      if (ch.replies.length && !confirm('将追加示例规则到当前列表，是否继续？')) return;
      const samples = [
        { keywords: ['价格', '报价', '多少钱', 'price', '多少'], text: '各型号参考价可在产品详情页查看（如气动机约 ¥28,000 起）。具体配置价格需按材料/产量评估，您方便留个邮箱或微信吗？我们发正式报价单。' },
        { keywords: ['气动', 'pneumatic'], text: '气动 V 槽成型机适合中小型企业日常生产，气动驱动稳定，带 6 档深度预设。详情：/products/pneumatic ，也可直接说下您的材料厚度和日产量，我帮您判断是否合适。' },
        { keywords: ['手动', '打样', 'manual'], text: '手动 V 槽打样机轻便灵活，适合设计工作室和小批量多款式。参考价约 ¥8,800 起。详情：/products/manual' },
        { keywords: ['CNC', '数控', '自动线', '大批量'], text: '大批量/高精度建议看 CNC 数控中心或全自动生产线。方便告诉我日产量和材料吗？我给您选型建议。' },
        { keywords: ['选型', '推荐', '哪个好', '怎么选'], text: '选型一般看三点：材料厚度、日产量、是否要自动化。薄材小批量→手动；中等批量→气动；大批量高精度→CNC/自动线。您目前加工什么材料、一天大概多少件？' },
        { keywords: ['质保', '售后', '保修', '安装'], text: '设备支持质保与售后响应，部分机型含安装调试。留下联系方式后，业务同事会按您所在地区说明联保与上门政策。' },
        { keywords: ['联系', '电话', '微信', '邮箱'], text: '您可以直接在网站「联系我们」提交询盘，或在此留下邮箱/微信/电话，我们会尽快人工跟进。' },
      ];
      ch.replies = (ch.replies || []).concat(samples);
      if (!ch.fallback) ch.fallback = '感谢咨询！请简单描述材料、厚度和产量，或留下邮箱/微信，我们安排业务员给您详细方案与报价。';
      markDirty(); renderChat(); toast('已填入示例，请检查后保存', 'ok');
    });
    c3.appendChild(seed);
    renderList(c3, ch.replies, { label: (x, i) => '规则 ' + (i + 1), rerender: renderChat, addLabel: '+ 回复规则', makeDefault: () => ({ keywords: [], text: '' }), fields: (x, host) => {
      host.appendChild(csvField('关键词（逗号）', x, 'keywords', { placeholder: '价格,报价,多少钱' })); host.appendChild(field('回复内容', x, 'text', { textarea: true, rows: 3 }));
    } }); sec.appendChild(c3);
  }

  // ============ 账号管理（多用户，仅管理员） ============
  async function renderAccounts() {
    const sec = $('#secAccounts'); sec.innerHTML = '';
    if (!isAdmin()) { sec.innerHTML = '<div class="card" style="color:var(--muted)">仅管理员可管理账号。</div>'; return; }
    if (acctEditing !== null) return renderAccountForm();
    sec.innerHTML = '<div class="card" style="color:var(--muted)">加载中...</div>';
    const users = await loadUsers(true);
    const defL = data.i18n[data.defaultLang || (data.langs[0] && data.langs[0].code)] || {};
    const prodCount = (u) => ((defL.products || []).filter((p) => p.owner === u.id || p.owner === u.username).length);
    sec.innerHTML = '';
    const c = card('账号列表');
    hint(c, '主账号（管理员）可管理所有内容与账号；业务员/制作员登录后同样可编辑内容，可作为产品「负责人」。');
    const addBtn = document.createElement('button'); addBtn.className = 'btn'; addBtn.textContent = '+ 新建账号'; addBtn.style.marginBottom = '0.8rem';
    addBtn.addEventListener('click', () => { acctEditing = 'new'; renderAccounts(); });
    c.appendChild(addBtn);
    const table = document.createElement('table'); table.className = 'ptable';
    table.innerHTML = '<thead><tr><th>账号名</th><th>姓名</th><th>角色</th><th>产品数</th><th>状态</th><th class="pt-ops">操作</th></tr></thead>';
    const tb = document.createElement('tbody'); table.appendChild(tb);
    users.forEach((u) => {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td>' + esc(u.username) + '</td><td>' + esc(u.name) + '</td>' +
        '<td><span class="badge-role ' + esc(u.role) + '">' + esc(ROLE_LABEL[u.role] || u.role) + '</span></td>' +
        '<td>' + prodCount(u) + '</td>' +
        '<td>' + (u.status === 'disabled' ? '<span class="badge-off">已停用</span>' : '正常') + '</td>' +
        '<td class="pt-ops"></td>';
      const ops = tr.querySelector('.pt-ops');
      const bEdit = document.createElement('button'); bEdit.textContent = '编辑'; bEdit.addEventListener('click', () => { acctEditing = u; renderAccounts(); });
      ops.appendChild(bEdit);
      if (u.id !== me.id) {
        const bTog = document.createElement('button'); bTog.textContent = u.status === 'disabled' ? '启用' : '停用';
        bTog.addEventListener('click', async () => { await saveAccount({ id: u.id, username: u.username, name: u.name, role: u.role, status: u.status === 'disabled' ? 'active' : 'disabled' }); });
        const bDel = document.createElement('button'); bDel.className = 'del'; bDel.textContent = '删除';
        bDel.addEventListener('click', async () => { if (!confirm('删除账号 ' + u.username + '？')) return; const r = await fetch('/api/users', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: u.id }) }); const j = await r.json(); if (!r.ok) return toast(j.error || '删除失败', 'bad'); toast('已删除', 'ok'); usersCache = null; renderAccounts(); });
        ops.appendChild(bTog); ops.appendChild(bDel);
      }
      tb.appendChild(tr);
    });
    c.appendChild(table); sec.appendChild(c);
  }
  function renderAccountForm() {
    const sec = $('#secAccounts'); sec.innerHTML = '';
    const isNew = acctEditing === 'new';
    const u = isNew ? { username: '', name: '', role: 'sales', status: 'active' } : acctEditing;
    const bar = document.createElement('div'); bar.style.cssText = 'margin-bottom:1rem';
    const back = document.createElement('button'); back.className = 'btn ghost'; back.textContent = '← 返回账号列表'; back.addEventListener('click', () => { acctEditing = null; renderAccounts(); });
    bar.appendChild(back); sec.appendChild(bar);
    const c = card(isNew ? '新建账号' : '编辑账号：' + u.username);
    const form = { username: u.username, name: u.name, role: u.role, status: u.status, password: '' };
    c.appendChild(field('账号名（邮箱，用于登录）', form, 'username', { placeholder: 'vivi@company.com' }));
    c.appendChild(field('用户姓名', form, 'name', { placeholder: 'Vivi' }));
    c.appendChild(field('角色', form, 'role', { select: true, options: [{ value: 'admin', label: '管理员（全部权限）' }, { value: 'sales', label: '业务员' }, { value: 'editor', label: '制作员' }] }));
    c.appendChild(field(isNew ? '密码（至少 6 位）' : '密码（留空则不修改）', form, 'password', { type: 'password' }));
    c.appendChild(field('状态', form, 'status', { select: true, options: [{ value: 'active', label: '正常' }, { value: 'disabled', label: '停用' }] }));
    const save = document.createElement('button'); save.className = 'btn'; save.textContent = '保存';
    save.addEventListener('click', () => saveAccount(Object.assign({ id: isNew ? undefined : u.id }, form)));
    c.appendChild(save); sec.appendChild(c);
  }
  async function saveAccount(payload) {
    const r = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const j = await r.json();
    if (!r.ok) return toast(j.error || '保存失败', 'bad');
    toast('已保存', 'ok'); usersCache = null; acctEditing = null; renderAccounts();
  }

  function renderAccount() {
    const sec = $('#secAccount'); sec.innerHTML = '';
    const c = card('修改登录密码');
    const cur = field('当前密码', {}, 'x', { type: 'password' });
    const n1 = field('新密码（至少 6 位）', {}, 'x', { type: 'password' });
    const n2 = field('确认新密码', {}, 'x', { type: 'password' });
    c.appendChild(cur); c.appendChild(n1); c.appendChild(n2);
    const btn = document.createElement('button'); btn.className = 'btn'; btn.textContent = '更新密码';
    btn.addEventListener('click', async () => {
      const current = $('input', cur).value, next = $('input', n1).value, confirmVal = $('input', n2).value;
      if (next !== confirmVal) return toast('两次新密码不一致', 'bad');
      try { const res = await fetch('/api/password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ current, next }) }); const j = await res.json(); if (!res.ok) throw new Error(j.error || '修改失败'); toast('密码已更新', 'ok'); $('input', cur).value = ''; $('input', n1).value = ''; $('input', n2).value = ''; } catch (e) { toast(e.message, 'bad'); }
    });
    c.appendChild(btn); sec.appendChild(c);
  }

  // ============ 媒体选择器 ============
  let uploadsCache = null;
  async function loadUploads(force) {
    if (uploadsCache && !force) return uploadsCache;
    const res = await fetch('/api/uploads');
    const j = await res.json().catch(() => ({ files: [] }));
    uploadsCache = j.files || [];
    return uploadsCache;
  }
  async function openPicker(cb) {
    const mask = $('#picker'); const grid = $('#pickerGrid');
    grid.innerHTML = '<div style="color:var(--muted);padding:1rem">加载中...</div>';
    mask.classList.remove('hidden');
    const files = await loadUploads(true);
    if (!files.length) { grid.innerHTML = '<div style="color:var(--muted);padding:1rem">媒体库为空，请先在「媒体库」或直接上传。</div>'; return; }
    grid.innerHTML = '';
    files.forEach((f) => {
      const el = document.createElement('div'); el.className = 'pk';
      el.innerHTML = f.type === 'video' ? '<video src="' + esc(f.url) + '" muted></video>' : '<img src="' + esc(f.url) + '">';
      el.addEventListener('click', () => { mask.classList.add('hidden'); cb(f); });
      grid.appendChild(el);
    });
  }
  function pickBtn(label, cb) { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn ghost'; b.style.marginLeft = '0.4rem'; b.textContent = label; b.addEventListener('click', () => openPicker(cb)); return b; }

  // ============ 媒体库 ============
  async function renderMedia() {
    const sec = $('#secMedia'); sec.innerHTML = '';
    const c = card('媒体库'); hint(c, '所有上传的图片/视频。可复制链接填到产品封面，或直接删除不用的文件。');
    const grid = document.createElement('div'); grid.className = 'media-grid';
    grid.innerHTML = '<div style="color:var(--muted)">加载中...</div>';
    c.appendChild(grid); sec.appendChild(c);
    const files = await loadUploads(true);
    if (!files.length) { grid.innerHTML = '<div style="color:var(--muted)">还没有上传任何文件。</div>'; return; }
    grid.innerHTML = '';
    files.forEach((f) => {
      const cell = document.createElement('div'); cell.className = 'media-cell';
      cell.innerHTML = '<div class="mc-thumb">' + (f.type === 'video' ? '<video src="' + esc(f.url) + '" muted></video>' : '<img src="' + esc(f.url) + '">') + '</div>' +
        '<div class="mc-info"><div class="mc-name">' + esc(f.name) + '<br>' + (f.size / 1024 > 1024 ? (f.size / 1048576).toFixed(1) + ' MB' : Math.round(f.size / 1024) + ' KB') + '</div><div class="mc-acts"></div></div>';
      const acts = cell.querySelector('.mc-acts');
      const copy = document.createElement('button'); copy.textContent = '复制链接';
      copy.addEventListener('click', () => { navigator.clipboard && navigator.clipboard.writeText(f.url); toast('已复制链接：' + f.url, 'ok'); });
      const del = document.createElement('button'); del.className = 'del'; del.textContent = '删除';
      del.addEventListener('click', async () => {
        if (!confirm('删除文件 ' + f.name + '？（若产品仍在引用会显示裂图）')) return;
        const res = await fetch('/api/uploads', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: f.name }) });
        if (res.ok) { toast('已删除', 'ok'); renderMedia(); } else { toast('删除失败', 'bad'); }
      });
      acts.appendChild(copy); acts.appendChild(del); grid.appendChild(cell);
    });
  }

  // ============ 翻译与备份 ============
  function renderTools() {
    const sec = $('#secTools'); sec.innerHTML = '';
    // 站点设置
    data.settings = data.settings || {};
    const cs = card('站点设置（SEO 与通知）');
    hint(cs, '网站网址用于生成 sitemap / 分享链接；通知 Webhook 填企业微信/钉钉/飞书群机器人地址，收到询价会自动推送。');
    cs.appendChild(field('网站网址', data.settings, 'siteUrl', { placeholder: 'https://vgrooving.com' }));
    cs.appendChild(field('通知 Webhook（可留空）', data.settings, 'notifyWebhook', { placeholder: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=...' }));
    cs.appendChild(field('统计代码（插入 <head>，如 Google Analytics / 百度统计）', data.settings, 'headHtml', { textarea: true, rows: 3, placeholder: '<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXX"></script> ...' }));
    sec.appendChild(cs);

    // AI 客服（可选）
    data.settings.aiChat = data.settings.aiChat || {};
    const ai = data.settings.aiChat;
    const cai = card('前台客服 AI 智能回复（可选）');
    hint(cai, '关闭时只用「在线客服」里的关键词固定话术。开启后：先匹配关键词，未命中再调用大模型（OpenAI 兼容接口，如官方 / 代理 / DeepSeek 等）。密钥仅保存在服务器，不会下发到前台。');
    cai.appendChild(field('启用 AI', ai, 'enabled', { select: true, options: [{ value: 'false', label: '关闭（仅固定话术）' }, { value: 'true', label: '开启' }], onInput: (v) => { ai.enabled = v === 'true'; } }));
    const aig = document.createElement('div'); aig.className = 'grid2';
    aig.appendChild(field('API 地址', ai, 'apiUrl', { placeholder: 'https://api.openai.com/v1' }));
    aig.appendChild(field('模型', ai, 'model', { placeholder: 'gpt-4o-mini' }));
    cai.appendChild(aig);
    cai.appendChild(field('API Key', ai, 'apiKey', { type: 'password', placeholder: 'sk-...' }));
    cai.appendChild(field('系统提示词（可留空用默认）', ai, 'systemPrompt', { textarea: true, rows: 3, placeholder: '你是 V槽PRO 售前客服…' }));
    const aiTest = document.createElement('button'); aiTest.type = 'button'; aiTest.className = 'btn ghost'; aiTest.textContent = '测试 AI 连通';
    aiTest.style.marginTop = '0.5rem';
    aiTest.addEventListener('click', async () => {
      await save();
      aiTest.disabled = true; aiTest.textContent = '测试中…';
      try {
        const r = await fetch('/api/chat/reply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: '你们气动机器大概什么价格？', lang: 'zh', history: [] }) });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || '失败');
        toast('回复来源: ' + (j.source || '?') + ' — ' + String(j.text || '').slice(0, 80), j.aiError ? 'bad' : 'ok');
        if (j.aiError) alert('AI 回落原因：' + j.aiError);
      } catch (e) { toast(e.message || '测试失败', 'bad'); }
      aiTest.disabled = false; aiTest.textContent = '测试 AI 连通';
    });
    cai.appendChild(aiTest);
    sec.appendChild(cai);

    // 邮件通知（SMTP）
    data.settings.smtp = data.settings.smtp || {};
    const sm = data.settings.smtp;
    const cm = card('询价邮件通知（SMTP）');
    hint(cm, '填好后，每条询价会同时发到「收件邮箱」。常见：QQ企业邮箱 smtp.exmail.qq.com 端口465；Gmail smtp.gmail.com 端口465。密码用邮箱的“授权码/应用专用密码”。');
    const sg = document.createElement('div'); sg.className = 'grid3';
    sg.appendChild(field('SMTP 服务器', sm, 'host', { placeholder: 'smtp.exmail.qq.com' }));
    sg.appendChild(field('端口', sm, 'port', { placeholder: '465' }));
    sg.appendChild(field('加密', sm, 'secure', { select: true, options: [{ value: 'true', label: 'SSL(465)' }, { value: 'false', label: 'STARTTLS(587)' }], onInput: (v) => { sm.secure = v === 'true'; } }));
    cm.appendChild(sg);
    const sg2 = document.createElement('div'); sg2.className = 'grid2';
    sg2.appendChild(field('登录账号', sm, 'user', { placeholder: 'sales@vgrooving.com' }));
    sg2.appendChild(field('授权码 / 密码', sm, 'pass', { type: 'password' }));
    cm.appendChild(sg2);
    const sg3 = document.createElement('div'); sg3.className = 'grid2';
    sg3.appendChild(field('发件人（可留空=登录账号）', sm, 'from', { placeholder: '"V槽PRO" <sales@vgrooving.com>' }));
    sg3.appendChild(field('收件邮箱（接收询价）', sm, 'to', { placeholder: 'sales@vgrooving.com' }));
    cm.appendChild(sg3);
    sec.appendChild(cm);
    // 添加新语言
    const c1 = card('添加新语言');
    hint(c1, '新增一门语言，并可选择“以某语言为模板复制内容”，省去从零开始。');
    const tmp = { code: '', label: '', dir: 'ltr', from: data.defaultLang || 'zh' };
    const g = document.createElement('div'); g.className = 'grid3';
    g.appendChild(field('语言代码', tmp, 'code', { placeholder: 'fr' }));
    g.appendChild(field('显示名称', tmp, 'label', { placeholder: 'Français' }));
    g.appendChild(field('方向', tmp, 'dir', { select: true, options: [{ value: 'ltr', label: 'ltr 从左到右' }, { value: 'rtl', label: 'rtl 从右到左' }] }));
    c1.appendChild(g);
    c1.appendChild(field('内容复制自', tmp, 'from', { select: true, options: (data.langs || []).map((l) => ({ value: l.code, label: l.code + ' · ' + l.label })) }));
    const addBtn = document.createElement('button'); addBtn.className = 'btn'; addBtn.textContent = '添加语言';
    addBtn.addEventListener('click', () => {
      const code = (tmp.code || '').trim();
      if (!code) return toast('请填写语言代码', 'bad');
      if ((data.langs || []).some((l) => l.code === code)) return toast('该语言代码已存在', 'bad');
      data.langs.push({ code, label: tmp.label || code, dir: tmp.dir || 'ltr' });
      data.i18n[code] = deepClone(data.i18n[tmp.from] || {});
      markDirty(); toast('已添加语言 ' + code + '，切到该语言即可翻译', 'ok');
      lang = code; renderLangTabs(); updatePreview(); renderTools();
    });
    c1.appendChild(addBtn); sec.appendChild(c1);

    // 翻译助手
    const c2 = card('翻译助手');
    hint(c2, '把某个语言的全部内容复制到「当前正在编辑的语言（' + lang + '）」，覆盖后再逐条翻译。');
    const t2 = { from: (data.langs[0] && data.langs[0].code) || 'zh' };
    c2.appendChild(field('复制来源语言', t2, 'from', { select: true, options: (data.langs || []).filter((l) => l.code !== lang).map((l) => ({ value: l.code, label: l.code + ' · ' + l.label })) }));
    const cpBtn = document.createElement('button'); cpBtn.className = 'btn'; cpBtn.textContent = '复制到当前语言（' + lang + '）';
    cpBtn.addEventListener('click', () => {
      if (t2.from === lang) return toast('来源与当前语言相同', 'bad');
      if (!confirm('用 ' + t2.from + ' 的全部内容覆盖当前语言 ' + lang + '？')) return;
      data.i18n[lang] = deepClone(data.i18n[t2.from] || {});
      markDirty(); toast('已复制，请逐条翻译后保存', 'ok'); switchSection('brand');
    });
    c2.appendChild(cpBtn); sec.appendChild(c2);

    // 备份与恢复
    const c3 = card('备份与恢复');
    hint(c3, '导出会下载当前全部内容的 JSON 备份；导入会用文件内容替换（导入后记得点“保存全部修改”）。');
    const exp = document.createElement('button'); exp.className = 'btn ghost'; exp.textContent = '⬇ 导出内容备份';
    exp.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = 'vgrooving-content-' + new Date().toISOString().slice(0, 10) + '.json'; a.click();
    });
    const impLabel = document.createElement('label'); impLabel.className = 'btn ghost'; impLabel.style.marginLeft = '0.5rem'; impLabel.textContent = '⬆ 导入内容';
    const impFi = document.createElement('input'); impFi.type = 'file'; impFi.accept = 'application/json,.json'; impFi.className = 'hidden';
    impFi.addEventListener('change', () => {
      const f = impFi.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = () => { try { const j = JSON.parse(rd.result); if (!j.i18n) throw new Error('不是有效的内容文件'); data = j; data.langs = data.langs || []; lang = data.defaultLang || (data.langs[0] && data.langs[0].code) || 'zh'; markDirty(); renderLangTabs(); switchSection('brand'); toast('已导入，请检查后点“保存全部修改”', 'ok'); } catch (e) { toast('导入失败：' + e.message, 'bad'); } };
      rd.readAsText(f);
    });
    impLabel.appendChild(impFi);
    c3.appendChild(exp); c3.appendChild(impLabel); sec.appendChild(c3);
  }

  // ============ 仪表盘 ============
  let leadsCache = null;
  async function loadLeads(force) {
    if (leadsCache && !force) return leadsCache;
    const res = await fetch('/api/leads');
    const j = await res.json().catch(() => ({ leads: [] }));
    leadsCache = j.leads || [];
    return leadsCache;
  }
  function updateInboxBadge() {
    const unread = (leadsCache || []).filter((l) => !l.read || l.status === 'new').length;
    const b = $('#inboxBadge');
    if (b) { b.textContent = unread || ''; b.style.display = unread ? 'inline-block' : 'none'; }
  }
  async function renderDashboard() {
    const sec = $('#secDashboard'); sec.innerHTML = '<div class="card" style="color:var(--muted)">加载中...</div>';
    const langs = data.langs || [];
    const defL = data.i18n[data.defaultLang || (langs[0] && langs[0].code)] || {};
    const files = await loadUploads(true).catch(() => []);
    const leads = await loadLeads(true).catch(() => []);
    updateInboxBadge();
    sec.innerHTML = '';
    const unread = leads.filter((l) => !l.read || l.status === 'new').length;
    const c1 = card('概览');
    const g = document.createElement('div'); g.className = 'stat-grid';
    const stat = (n, l) => '<div class="stat"><div class="n">' + n + '</div><div class="l">' + l + '</div></div>';
    const now = new Date();
    const newThisMonth = (defL.products || []).filter((p) => { if (!p.createdAt) return false; const d = new Date(p.createdAt); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth(); }).length;
    g.innerHTML = stat((defL.products || []).filter((p) => !p.deleted).length, '产品数') + stat(newThisMonth, '本月新增产品') + stat(files.length, '媒体文件') + stat(leads.length, '累计询盘') + stat(unread, '待跟进询盘') + stat(langs.length, '语言');
    c1.appendChild(g);
    const quick = document.createElement('div'); quick.className = 'quick';
    langs.forEach((l) => { const a = document.createElement('a'); a.className = 'btn ghost'; a.target = '_blank'; a.href = (l.code === (data.defaultLang || 'zh') ? '/' : '/' + l.code); a.textContent = '🔎 ' + (l.label || l.code); quick.appendChild(a); });
    c1.appendChild(quick);
    sec.appendChild(c1);

    // 业务员维度商机统计
    if (!me || me.role !== 'editor') {
      const leadStats = await fetch('/api/leads/stats').then((r) => r.json()).catch(() => null);
      if (leadStats && leadStats.byOwner) {
        const cS = card('业务员商机统计');
        hint(cS, '按负责人汇总询盘数量、本月新增、跟进状态与成交。业务员仅看自己的数据。');
        const tg = document.createElement('div'); tg.className = 'stat-grid';
        const t = leadStats.totals || {};
        tg.innerHTML = stat(t.total || 0, '可见询盘') + stat(t.thisMonth || 0, '本月新增') + stat(t.unread || 0, '未读') + stat(t.won || 0, '已成交') +
          stat((t.byStatus && t.byStatus.new) || 0, '未处理') + stat((t.byStatus && t.byStatus.following) || 0, '跟进中');
        cS.appendChild(tg);
        const table = document.createElement('table'); table.className = 'ptable'; table.style.marginTop = '0.8rem';
        table.innerHTML = '<thead><tr><th>业务员</th><th>合计</th><th>本月</th><th>未处理</th><th>跟进中</th><th>已回复</th><th>已成交</th><th>关闭</th></tr></thead>';
        const tb = document.createElement('tbody');
        (leadStats.byOwner || []).forEach((row) => {
          const tr = document.createElement('tr');
          const bs = row.byStatus || {};
          tr.innerHTML = '<td>' + esc(row.ownerName || '-') + '</td><td>' + row.total + '</td><td>' + row.thisMonth + '</td><td>' + (bs.new || 0) + '</td><td>' + (bs.following || 0) + '</td><td>' + (bs.replied || 0) + '</td><td>' + (bs.won || 0) + '</td><td>' + (bs.closed || 0) + '</td>';
          tb.appendChild(tr);
        });
        table.appendChild(tb); cS.appendChild(table);
        sec.appendChild(cS);
      }
    }

    // 访问统计
    const stats = await fetch('/api/stats').then((r) => r.json()).catch(() => null);
    if (stats) {
      const cV = card('访问统计');
      const g2 = document.createElement('div'); g2.className = 'stat-grid';
      g2.innerHTML = stat(stats.total || 0, '总访问量') + stat(stats.today || 0, '今日访问');
      cV.appendChild(g2);
      // 最近 14 天柱状
      const last = (stats.last30 || []).slice(-14);
      const max = Math.max(1, ...last.map((d) => d.count));
      const bars = document.createElement('div'); bars.style.cssText = 'display:flex;align-items:flex-end;gap:4px;height:90px;margin:0.6rem 0';
      bars.innerHTML = last.map((d) => '<div title="' + d.date + '：' + d.count + '" style="flex:1;background:var(--brand);border-radius:3px 3px 0 0;height:' + Math.round((d.count / max) * 100) + '%;min-height:3px"></div>').join('') || '<div style="color:var(--muted)">暂无数据</div>';
      cV.appendChild(bars);
      const lbl = document.createElement('div'); lbl.className = 'hint'; lbl.textContent = '最近 14 天每日访问量';
      cV.appendChild(lbl);
      // 热门页面
      if ((stats.topPaths || []).length) {
        const tp = document.createElement('div'); tp.style.marginTop = '0.8rem';
        tp.innerHTML = '<div class="lbl" style="margin-bottom:0.4rem">热门页面</div>' + stats.topPaths.slice(0, 8).map((p) => {
          const label = p.key === 'home' ? '首页' : p.key === 'contact' ? '联系页' : p.key.replace('product:', '产品：');
          return '<div class="prog-row"><span class="name" style="width:auto;flex:1">' + esc(label) + '</span><span>' + p.count + '</span></div>';
        }).join('');
        cV.appendChild(tp);
      }
      sec.appendChild(cV);
    }

    // 各语言完成度（有多少产品填了图集或封面）
    const c2 = card('各语言产品完成度');
    hint(c2, '统计每个语言里“已配图（图集或封面）”的产品占比，帮助你发现还没翻译/配图的语言');
    langs.forEach((l) => {
      const ps = (data.i18n[l.code] && data.i18n[l.code].products) || [];
      const done = ps.filter((p) => (p.gallery && p.gallery.length) || p.cardImage).length;
      const pct = ps.length ? Math.round((done / ps.length) * 100) : 0;
      const row = document.createElement('div'); row.className = 'prog-row';
      row.innerHTML = '<span class="name">' + esc(l.label || l.code) + '</span><span class="prog-bar"><i style="width:' + pct + '%"></i></span><span>' + done + '/' + ps.length + '</span>';
      c2.appendChild(row);
    });
    sec.appendChild(c2);
  }

  // ============ 聊天记录（前台 AI 自动回复会话） ============
  async function renderChats() {
    const sec = $('#secChats'); sec.innerHTML = '';
    const c = card('前台客服聊天记录');
    hint(c, '访客与网站 AI 自动回复的对话会实时上报到这里，便于业务员查看意向。制作员不可见。');
    const bar = document.createElement('div'); bar.style.cssText = 'display:flex;gap:0.5rem;margin-bottom:0.8rem;flex-wrap:wrap';
    const refresh = document.createElement('button'); refresh.className = 'btn ghost'; refresh.textContent = '↻ 刷新';
    bar.appendChild(refresh); c.appendChild(bar);
    const layout = document.createElement('div'); layout.style.cssText = 'display:grid;grid-template-columns:minmax(240px,320px) 1fr;gap:0.8rem;min-height:360px';
    const listHost = document.createElement('div'); listHost.style.cssText = 'border:1px solid var(--border);border-radius:8px;overflow:auto;max-height:70vh';
    const detailHost = document.createElement('div'); detailHost.style.cssText = 'border:1px solid var(--border);border-radius:8px;padding:0.8rem;overflow:auto;max-height:70vh;background:var(--panel-2)';
    detailHost.innerHTML = '<div style="color:var(--muted)">选择左侧会话查看完整对话</div>';
    layout.appendChild(listHost); layout.appendChild(detailHost); c.appendChild(layout); sec.appendChild(c);

    async function loadList() {
      listHost.innerHTML = '<div style="padding:0.8rem;color:var(--muted)">加载中...</div>';
      const res = await fetch('/api/chats');
      if (res.status === 403) { listHost.innerHTML = '<div style="padding:0.8rem;color:var(--muted)">无权限查看聊天记录</div>'; return; }
      const j = await res.json().catch(() => ({ chats: [] }));
      const chats = j.chats || [];
      if (!chats.length) { listHost.innerHTML = '<div style="padding:0.8rem;color:var(--muted)">暂无聊天记录。访客在前台打开客服并发送消息后会出现在这里。</div>'; return; }
      listHost.innerHTML = '';
      chats.forEach((ch) => {
        const item = document.createElement('div');
        item.style.cssText = 'padding:0.7rem 0.8rem;border-bottom:1px solid var(--border);cursor:pointer';
        item.innerHTML = '<div style="font-weight:500;font-size:0.88rem">' + esc((ch.preview || '(无用户消息)').slice(0, 60)) + '</div>' +
          '<div class="pt-sub">' + esc(new Date(ch.updatedAt).toLocaleString()) + ' · ' + (ch.messageCount || 0) + ' 条 · ' + esc(ch.lang || '-') + '</div>' +
          '<div class="pt-sub">' + esc(ch.page || '') + '</div>';
        item.addEventListener('click', async () => {
          Array.from(listHost.children).forEach((el) => { el.style.background = ''; });
          item.style.background = 'rgba(230,0,18,0.06)';
          detailHost.innerHTML = '<div style="color:var(--muted)">加载中...</div>';
          const dr = await fetch('/api/chats/' + encodeURIComponent(ch.id));
          const dj = await dr.json().catch(() => ({}));
          const full = dj.chat;
          if (!full) { detailHost.innerHTML = '<div style="color:var(--muted)">加载失败</div>'; return; }
          let html = '<div style="display:flex;justify-content:space-between;gap:0.5rem;margin-bottom:0.6rem;flex-wrap:wrap">' +
            '<div><b>会话详情</b><div class="pt-sub">' + esc(full.page || '') + ' · IP ' + esc(full.ip || '-') + '</div></div>';
          if (isAdmin()) {
            html += '<button class="btn ghost del" id="chatDelBtn" type="button">删除会话</button>';
          }
          html += '</div><div id="chatThread"></div>';
          detailHost.innerHTML = html;
          const thread = detailHost.querySelector('#chatThread');
          (full.messages || []).forEach((m) => {
            const row = document.createElement('div');
            const isAgent = m.role === 'agent';
            row.style.cssText = 'display:flex;margin:0.35rem 0;' + (isAgent ? '' : 'justify-content:flex-end');
            row.innerHTML = '<div style="max-width:85%;padding:0.5rem 0.7rem;border-radius:8px;font-size:0.88rem;white-space:pre-wrap;' +
              (isAgent ? 'background:var(--bg);border:1px solid var(--border)' : 'background:var(--brand);color:#fff') + '">' +
              '<div style="opacity:.7;font-size:0.7rem;margin-bottom:0.15rem">' + (isAgent ? 'AI 客服' : '访客') + ' · ' + esc(new Date(m.time).toLocaleString()) + '</div>' +
              esc(m.text || '') + '</div>';
            thread.appendChild(row);
          });
          const delBtn = detailHost.querySelector('#chatDelBtn');
          if (delBtn) delBtn.addEventListener('click', async () => {
            if (!confirm('删除该会话？')) return;
            await fetch('/api/chats', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: ch.id }) });
            toast('已删除', 'ok'); detailHost.innerHTML = '<div style="color:var(--muted)">已删除</div>'; loadList();
          });
        });
        listHost.appendChild(item);
      });
    }
    refresh.addEventListener('click', loadList);
    loadList();
  }

  // ============ 商机中心（询盘 + AI 对话） ============
  let inboxFilter = 'all'; // status
  let inboxSource = 'all'; // chat|form|product|all
  let inboxOpenId = null;
  async function renderInbox() {
    const sec = $('#secInbox'); sec.innerHTML = '';
    const wrap = $('#appView .content'); if (wrap) wrap.classList.add('wide');
    const c = card('商机中心');
    hint(c, '智能询盘 = 前台 AI 客服会话；表单/产品询盘 = 联系页或产品页提交。点「查看对话」可看 AI 聊了什么。');
    const tabs = document.createElement('div'); tabs.className = 'opp-tabs';
    const leads = await loadLeads(true); updateInboxBadge();
    const counts = {
      all: leads.length,
      chat: leads.filter((l) => l.source === 'chat').length,
      form: leads.filter((l) => l.source === 'form' || !l.source).length,
      product: leads.filter((l) => l.source === 'product').length,
    };
    [
      ['all', '全部商机'],
      ['chat', '智能询盘'],
      ['form', '表单询盘'],
      ['product', '产品询盘'],
    ].forEach(([key, label]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn ' + (inboxSource === key ? '' : 'ghost');
      b.textContent = label + ' (' + (counts[key] || 0) + ')';
      b.addEventListener('click', () => { inboxSource = key; renderInbox(); });
      tabs.appendChild(b);
    });
    c.appendChild(tabs);
    const bar = document.createElement('div'); bar.className = 'ptoolbar';
    const refresh = document.createElement('button'); refresh.className = 'btn ghost'; refresh.textContent = '↻ 刷新'; refresh.addEventListener('click', () => { leadsCache = null; renderInbox(); });
    const exp = document.createElement('button'); exp.className = 'btn ghost'; exp.textContent = '导出 CSV';
    const filterSel = document.createElement('select'); filterSel.className = 'inp'; filterSel.style.width = 'auto';
    filterSel.innerHTML = '<option value="all">全部状态</option>' + LEAD_STATUS_KEYS.map((k) => '<option value="' + k + '"' + (inboxFilter === k ? ' selected' : '') + '>' + statusLabel(k) + '</option>').join('');
    filterSel.value = inboxFilter;
    filterSel.addEventListener('change', () => { inboxFilter = filterSel.value; renderInbox(); });
    bar.appendChild(refresh); bar.appendChild(exp); bar.appendChild(filterSel); c.appendChild(bar);
    const host = document.createElement('div'); host.innerHTML = '<div style="color:var(--muted)">加载中...</div>'; c.appendChild(host);
    sec.appendChild(c);
    const canAssign = isAdmin();
    let filtered = leads.slice();
    if (inboxSource === 'chat') filtered = filtered.filter((l) => l.source === 'chat');
    else if (inboxSource === 'form') filtered = filtered.filter((l) => l.source === 'form' || !l.source);
    else if (inboxSource === 'product') filtered = filtered.filter((l) => l.source === 'product');
    if (inboxFilter !== 'all') filtered = filtered.filter((l) => (l.status || 'new') === inboxFilter);
    exp.addEventListener('click', () => {
      const rows = [['时间', '来源', '标题', '状态', '姓名', '邮箱', '电话', '地区', '公司', '产品', '语言', '负责人', '内容']].concat(leads.map((l) => [
        new Date(l.time).toLocaleString(), sourceLabel(l.source), l.title || '', statusLabel(l.status || 'new'),
        l.name, l.email, l.phone, l.country, l.company, l.product, l.lang, ownerName(l.owner),
        (l.message || '').replace(/\n/g, ' '),
      ]));
      const csv = '\ufeff' + rows.map((r) => r.map((x) => '"' + String(x == null ? '' : x).replace(/"/g, '""') + '"').join(',')).join('\n');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'leads.csv'; a.click();
    });
    if (!leads.length) { host.innerHTML = '<div style="color:var(--muted)">暂无商机。访客与 AI 聊天或提交表单后会出现在这里。</div>'; return; }
    if (!filtered.length) { host.innerHTML = '<div style="color:var(--muted)">当前筛选下没有商机。</div>'; return; }
    host.innerHTML = '';
    const scroll = document.createElement('div'); scroll.className = 'table-scroll';
    const table = document.createElement('table'); table.className = 'ptable';
    table.innerHTML = '<thead><tr><th style="min-width:180px">询盘标题</th><th>类型</th><th style="min-width:150px">买家信息</th><th style="min-width:160px">产品</th><th>状态</th><th>负责人</th><th style="min-width:120px">时间</th><th class="pt-ops">操作</th></tr></thead>';
    const tb = document.createElement('tbody'); table.appendChild(tb);
    filtered.forEach((l) => {
      const tr = document.createElement('tr'); if (!l.read || l.status === 'new') tr.style.fontWeight = '500';
      const title = l.title || (l.source === 'chat' ? '在线客服咨询' : (l.message || '').slice(0, 40));
      const img = l.productImage
        ? '<img src="' + esc(l.productImage) + '" alt="" style="width:44px;height:44px;object-fit:cover;border-radius:6px;border:1px solid var(--border);flex-shrink:0">'
        : '<div style="width:44px;height:44px;border-radius:6px;background:var(--panel-2);border:1px solid var(--border);flex-shrink:0"></div>';
      tr.innerHTML =
        '<td>' + (l.read ? '' : '<span style="color:var(--brand)">● </span>') +
        '<a href="#" class="lead-title-link" style="color:inherit;font-weight:600">' + esc(title) + '</a>' +
        '<div class="pt-sub" style="margin-top:0.25rem;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc((l.message || '').replace(/\n/g, ' ')) + '</div></td>' +
        '<td>' + sourceBadge(l.source || 'form') + '</td>' +
        '<td style="font-size:0.85rem;line-height:1.45">' +
        '<div><b>' + esc(l.name || '(未留姓名)') + '</b></div>' +
        (l.email ? '<div class="pt-sub">' + esc(l.email) + '</div>' : '') +
        (l.phone ? '<div class="pt-sub">' + esc(l.phone) + '</div>' : '') +
        (l.country || l.company ? '<div class="pt-sub">' + esc([l.country, l.company].filter(Boolean).join(' · ')) + '</div>' : '') +
        '</td>' +
        '<td><div style="display:flex;gap:0.5rem;align-items:center">' + img +
        '<div style="min-width:0"><div style="font-size:0.85rem">' + esc(l.product || '—') + '</div>' +
        (l.productPrice ? '<div class="pt-sub">' + esc(l.productPrice) + '</div>' : '') + '</div></div></td>' +
        '<td class="pt-status"></td>' +
        '<td class="pt-owner"></td>' +
        '<td class="pt-sub">' + esc(new Date(l.updatedAt || l.time).toLocaleString()) +
        '<div style="opacity:.7;margin-top:0.15rem">发生 ' + esc(new Date(l.time).toLocaleDateString()) + '</div></td>' +
        '<td class="pt-ops"></td>';
      const titleLink = tr.querySelector('.lead-title-link');
      titleLink.addEventListener('click', (e) => { e.preventDefault(); inboxOpenId = l.id; showLeadDetail(l); });
      const stTd = tr.querySelector('.pt-status');
      const stSel = document.createElement('select'); stSel.className = 'inp'; stSel.style.cssText = 'min-width:96px;width:auto';
      stSel.innerHTML = LEAD_STATUS_KEYS.map((k) => '<option value="' + k + '"' + ((l.status || 'new') === k ? ' selected' : '') + '>' + statusLabel(k) + '</option>').join('');
      stSel.addEventListener('change', async () => {
        const r = await fetch('/api/leads/status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: l.id, status: stSel.value }) });
        if (!r.ok) { toast('更新失败', 'bad'); return; }
        l.status = stSel.value; toast('状态已更新', 'ok'); leadsCache = null; updateInboxBadge();
      });
      stTd.appendChild(stSel);
      const ownerTd = tr.querySelector('.pt-owner');
      if (canAssign) {
        const sel = document.createElement('select'); sel.className = 'inp'; sel.style.cssText = 'min-width:100px;width:auto';
        sel.innerHTML = '<option value="">未分配</option>' + (usersCache || []).filter((u) => u.role !== 'editor').map((u) => '<option value="' + esc(u.id) + '"' + (l.owner === u.id ? ' selected' : '') + '>' + esc(u.name) + '</option>').join('');
        sel.addEventListener('change', async () => { await fetch('/api/leads/assign', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: l.id, owner: sel.value }) }); l.owner = sel.value; toast('已分配', 'ok'); });
        ownerTd.appendChild(sel);
      } else { ownerTd.textContent = ownerName(l.owner); }
      const ops = tr.querySelector('.pt-ops');
      if (l.source === 'chat' || l.chatId || l.sessionId) {
        const viewChat = document.createElement('button'); viewChat.type = 'button'; viewChat.textContent = '查看对话';
        viewChat.addEventListener('click', () => showLeadChat(l));
        ops.appendChild(viewChat);
      }
      const open = document.createElement('button'); open.type = 'button'; open.textContent = '回复买家';
      open.addEventListener('click', () => { inboxOpenId = l.id; showLeadDetail(l); });
      const del = document.createElement('button'); del.type = 'button'; del.className = 'del'; del.textContent = '删除';
      del.addEventListener('click', async () => { if (!confirm('删除该条商机？')) return; await fetch('/api/leads', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: l.id }) }); leadsCache = null; renderInbox(); });
      ops.appendChild(open); ops.appendChild(del);
      tb.appendChild(tr);
    });
    scroll.appendChild(table); host.appendChild(scroll);
    if (inboxOpenId) {
      const openLead = leads.find((x) => x.id === inboxOpenId);
      if (openLead) showLeadDetail(openLead);
    }
  }

  function ensureModal(id) {
    let panel = document.getElementById(id);
    if (!panel) {
      panel = document.createElement('div');
      panel.id = id;
      panel.className = 'modal-mask hidden';
      document.body.appendChild(panel);
    }
    return panel;
  }

  async function showLeadChat(l) {
    const panel = ensureModal('leadChatPanel');
    panel.classList.remove('hidden');
    panel.innerHTML =
      '<div class="modal-box chat-box">' +
      '<div class="modal-head" style="padding:0.95rem 1.1rem;margin:0;border-bottom:1px solid var(--border)">' +
      '<div><div style="font-weight:600;font-size:1rem">' + esc(l.name || '访客') + ' <span style="font-weight:400;color:var(--muted)">· AI 接待记录</span></div>' +
      '<div class="badge-row">' + sourceBadge(l.source || 'chat') + '</div>' +
      '<div class="pt-sub">' + esc([l.country, l.email, l.phone].filter(Boolean).join(' · ')) + '</div></div>' +
      '<button class="btn ghost" type="button" id="leadChatClose">关闭</button></div>' +
      (l.product ? '<div class="prod-mini" style="margin:0;border:none;border-radius:0;border-bottom:1px solid var(--border)">' +
        (l.productImage ? '<img src="' + esc(l.productImage) + '" alt="">' : '') +
        '<div><div style="font-weight:500">' + esc(l.product) + '</div>' +
        (l.productPrice ? '<div class="pt-sub">' + esc(l.productPrice) + '</div>' : '') + '</div></div>' : '') +
      '<div id="leadChatThread" style="flex:1;overflow:auto;padding:0.95rem 1.1rem;min-height:260px;background:var(--panel)"><div class="pt-sub">加载对话中…</div></div>' +
      '<div style="padding:0.75rem 1.1rem;border-top:1px solid var(--border);display:flex;gap:0.5rem">' +
      '<button class="btn" type="button" id="leadChatToReply">回复买家</button>' +
      '<button class="btn ghost" type="button" id="leadChatClose2">关闭</button></div></div>';
    const close = () => { panel.classList.add('hidden'); panel.onclick = null; };
    panel.querySelector('#leadChatClose').addEventListener('click', close);
    panel.querySelector('#leadChatClose2').addEventListener('click', close);
    panel.onclick = (e) => { if (e.target === panel) close(); };
    panel.querySelector('#leadChatToReply').addEventListener('click', () => { close(); showLeadDetail(l); });
    const thread = panel.querySelector('#leadChatThread');
    try {
      const r = await fetch('/api/leads/' + encodeURIComponent(l.id));
      const j = await r.json();
      const msgs = ((j.chat && j.chat.messages) || []);
      if (!msgs.length) { thread.innerHTML = '<div class="pt-sub">暂无聊天消息。也可到左侧「聊天记录」查看原始会话。</div>'; return; }
      thread.innerHTML = '';
      msgs.forEach((m) => {
        const row = document.createElement('div');
        const isAgent = m.role === 'agent';
        row.style.cssText = 'display:flex;margin:0.4rem 0;' + (isAgent ? 'justify-content:flex-end' : '');
        row.innerHTML = '<div style="max-width:78%;padding:0.55rem 0.75rem;border-radius:10px;font-size:0.88rem;white-space:pre-wrap;' +
          (isAgent ? 'background:var(--brand);color:#fff' : 'background:var(--panel-2);border:1px solid var(--border)') + '">' +
          '<div style="opacity:.75;font-size:0.68rem;margin-bottom:0.15rem">' + (isAgent ? 'AI 客服' : '买家') +
          (m.time ? ' · ' + esc(new Date(m.time).toLocaleString()) : '') + '</div>' + esc(m.text || '') + '</div>';
        thread.appendChild(row);
      });
      await fetch('/api/leads/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: l.id, read: true }) });
      l.read = true; updateInboxBadge();
    } catch (e) {
      thread.innerHTML = '<div style="color:var(--danger)">加载失败</div>';
    }
  }

  function showLeadDetail(l) {
    const panel = ensureModal('leadDetailPanel');
    panel.classList.remove('hidden');
    panel.innerHTML = '';
    const box = document.createElement('div');
    box.className = 'modal-box';
    box.innerHTML =
      '<div class="modal-head">' +
      '<div><h3>' + esc(l.title || l.name || '商机跟进') + '</h3>' +
      '<div class="badge-row">' + statusBadge(l.status || 'new') + sourceBadge(l.source || 'form') + '</div></div>' +
      '<button class="btn ghost" type="button" id="leadClose">关闭</button></div>' +
      '<div class="buyer-grid">' +
      '<div><div class="bk">姓名</div><div class="bv">' + esc(l.name || '—') + '</div></div>' +
      '<div><div class="bk">邮箱</div><div class="bv">' + esc(l.email || '—') + '</div></div>' +
      '<div><div class="bk">电话</div><div class="bv">' + esc(l.phone || '—') + '</div></div>' +
      '<div><div class="bk">地区/语言</div><div class="bv">' + esc(l.country || l.lang || '—') + '</div></div>' +
      (l.company ? '<div><div class="bk">公司</div><div class="bv">' + esc(l.company) + '</div></div>' : '') +
      '<div><div class="bk">来源页</div><div class="bv">' + esc(l.page || '—') + '</div></div>' +
      '</div>' +
      (l.product ? '<div class="prod-mini">' +
        (l.productImage ? '<img src="' + esc(l.productImage) + '" alt="">' : '') +
        '<div><div style="font-weight:500">' + esc(l.product) + '</div>' +
        (l.productPrice ? '<div class="pt-sub">' + esc(l.productPrice) + '</div>' : '') + '</div></div>' : '') +
      '<div class="lbl">询盘摘要</div><div class="msg-box">' + esc(l.message || '（无内容）') + '</div>' +
      ((l.source === 'chat' || l.chatId || l.sessionId)
        ? '<div style="margin-bottom:0.9rem"><button class="btn ghost" type="button" id="leadOpenChat">💬 查看 AI 完整对话</button></div>' : '') +
      '<div class="lbl">内部备注</div><textarea class="inp" id="leadNote" rows="2" style="margin-bottom:0.65rem">' + esc(l.note || '') + '</textarea>' +
      '<div style="display:flex;gap:0.5rem;margin-bottom:1rem;flex-wrap:wrap;align-items:center">' +
      '<button class="btn ghost" type="button" id="leadSaveNote">保存备注/状态</button>' +
      '<select class="inp" id="leadStatusSel" style="width:auto;min-width:120px">' +
      LEAD_STATUS_KEYS.map((k) => '<option value="' + k + '"' + ((l.status || 'new') === k ? ' selected' : '') + '>' + statusLabel(k) + '</option>').join('') +
      '</select></div>' +
      '<div class="lbl">回复记录</div><div id="leadReplies" style="margin-bottom:0.8rem"></div>' +
      '<div class="lbl">写回复' + (l.email ? '（可邮件发给 ' + esc(l.email) + '）' : '（无邮箱，仅内部记录）') + '</div>' +
      '<textarea class="inp" id="leadReplyText" rows="4" style="margin:0.35rem 0 0.55rem" placeholder="输入回复内容…"></textarea>' +
      '<label style="display:flex;align-items:center;gap:0.4rem;margin-bottom:0.65rem;font-size:0.88rem">' +
      '<input type="checkbox" id="leadSendMail"' + (l.email ? ' checked' : ' disabled') + '> 同时发送邮件给买家（需已配置 SMTP）</label>' +
      '<button class="btn" type="button" id="leadSendReply">提交回复</button>';
    panel.appendChild(box);
    const repliesEl = box.querySelector('#leadReplies');
    function renderReplies() {
      const list = l.replies || [];
      if (!list.length) { repliesEl.innerHTML = '<div class="pt-sub">暂无回复</div>'; return; }
      repliesEl.innerHTML = list.slice().reverse().map((r) =>
        '<div style="border:1px solid var(--border);border-radius:8px;padding:0.55rem 0.7rem;margin-bottom:0.4rem;background:var(--panel-2)">' +
        '<div class="pt-sub">' + esc(r.byName || '业务员') + ' · ' + esc(new Date(r.time).toLocaleString()) +
        (r.emailed ? ' · <span style="color:#16a34a">已发邮件</span>' : '') +
        (r.emailError ? ' · <span style="color:var(--danger)">邮件失败：' + esc(r.emailError) + '</span>' : '') +
        '</div><div style="white-space:pre-wrap;margin-top:0.25rem">' + esc(r.text || '') + '</div></div>'
      ).join('');
    }
    renderReplies();
    const close = () => { panel.classList.add('hidden'); inboxOpenId = null; panel.onclick = null; };
    box.querySelector('#leadClose').addEventListener('click', close);
    panel.onclick = (e) => { if (e.target === panel) close(); };
    const openChatBtn = box.querySelector('#leadOpenChat');
    if (openChatBtn) openChatBtn.addEventListener('click', () => { close(); showLeadChat(l); });
    box.querySelector('#leadSaveNote').addEventListener('click', async () => {
      const status = box.querySelector('#leadStatusSel').value;
      const note = box.querySelector('#leadNote').value;
      const r = await fetch('/api/leads/status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: l.id, status, note }) });
      if (!r.ok) return toast('保存失败', 'bad');
      l.status = status; l.note = note; toast('已保存', 'ok');
      // 不整页重绘，避免弹窗闪烁；仅刷新角标
      leadsCache = null; loadLeads(true).then(updateInboxBadge);
    });
    box.querySelector('#leadSendReply').addEventListener('click', async () => {
      const text = box.querySelector('#leadReplyText').value.trim();
      if (!text) return toast('请填写回复内容', 'bad');
      const sendEmail = box.querySelector('#leadSendMail').checked;
      const btn = box.querySelector('#leadSendReply'); btn.disabled = true; btn.textContent = '提交中...';
      const r = await fetch('/api/leads/reply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: l.id, text, sendEmail }) });
      const j = await r.json().catch(() => ({}));
      btn.disabled = false; btn.textContent = '提交回复';
      if (!r.ok) return toast(j.error || '回复失败', 'bad');
      if (j.lead) Object.assign(l, j.lead);
      else { l.replies = (l.replies || []).concat([j.reply]); l.status = 'replied'; }
      box.querySelector('#leadReplyText').value = '';
      if (sendEmail && j.emailSent) toast('回复已保存并发送邮件', 'ok');
      else if (sendEmail && j.emailError) toast('回复已保存，但邮件失败：' + j.emailError, 'bad');
      else toast('回复已保存', 'ok');
      leadsCache = null; renderReplies();
      box.querySelector('#leadStatusSel').value = l.status || 'replied';
    });
  }

  const RENDERERS = { dashboard: renderDashboard, brand: renderBrand, hero: renderHero, wizard: renderWizard, products: renderProducts, contact: renderContact, chat: renderChat, chats: renderChats, inbox: renderInbox, media: renderMedia, tools: renderTools, accounts: renderAccounts, account: renderAccount };
  function renderSection(sec) { if (RENDERERS[sec]) RENDERERS[sec](); }

  function renderLangTabs() {
    const host = $('#langTabs'); host.innerHTML = '';
    (data.langs || []).forEach((lg) => {
      const b = document.createElement('button'); b.className = 'lang-tab' + (lg.code === lang ? ' active' : ''); b.textContent = lg.label || lg.code;
      b.addEventListener('click', () => { lang = lg.code; editIdx = null; renderLangTabs(); updatePreview(); renderSection(currentSec); });
      host.appendChild(b);
    });
  }

  function switchSection(sec) {
    currentSec = sec;
    editIdx = null; // 每次切换菜单回到产品列表视图
    $$('.menu-item').forEach((m) => m.classList.toggle('active', m.dataset.sec === sec));
    $$('.section').forEach((s) => s.classList.toggle('active', s.dataset.sec === sec));
    $('#secTitle').textContent = SEC_TITLES[sec] || '';
    if (sec === 'products') editIdx = null;
    if (sec === 'accounts') acctEditing = null;
    // 商机中心用宽内容区，离开时还原，避免其它页被拉太宽
    const contentWrap = $('#appView .content');
    if (contentWrap) contentWrap.classList.toggle('wide', sec === 'inbox');
    $('#langTabs').style.display = ['dashboard', 'inbox', 'chats', 'media', 'accounts', 'account'].indexOf(sec) > -1 ? 'none' : '';
    updatePreview();
    renderSection(sec);
  }

  async function save() {
    const btn = $('#saveBtn'); btn.textContent = '保存中...'; btn.disabled = true;
    try {
      // 编辑中的产品记更新时间
      if (editIdx != null && data.i18n[lang] && data.i18n[lang].products && data.i18n[lang].products[editIdx]) {
        data.i18n[lang].products[editIdx].updatedAt = Date.now();
      }
      // 清除临时字段
      const clone = JSON.parse(JSON.stringify(data));
      Object.values(clone.i18n || {}).forEach((L) => (L.products || []).forEach((p) => { delete p._collapsed; delete p.breadcrumb; }));
      const res = await fetch('/api/content', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(clone) });
      if (res.status === 401) { showLogin(); throw new Error('登录已过期，请重新登录'); }
      if (!res.ok) throw new Error('保存失败');
      markClean(); toast('已保存全部修改', 'ok');
    } catch (e) { toast(e.message, 'bad'); }
    btn.textContent = '保存全部修改'; btn.disabled = false;
  }

  function showLogin() { $('#loginView').classList.remove('hidden'); $('#appView').classList.add('hidden'); }
  function showApp() { $('#loginView').classList.add('hidden'); $('#appView').classList.remove('hidden'); }
  function allowedSecs() {
    if (!me || me.role === 'admin') return null; // 全部
    if (me.role === 'editor') return ['dashboard', 'brand', 'hero', 'wizard', 'products', 'contact', 'chat', 'media', 'tools', 'account']; // 制作员：看不到询盘/聊天记录
    return ['dashboard', 'products', 'inbox', 'chats', 'media', 'account']; // 业务员：含自己的询盘 + 聊天记录
  }
  function updateMenusForRole() {
    const allow = allowedSecs();
    $$('.menu-item').forEach((m) => { m.style.display = (!allow || allow.indexOf(m.dataset.sec) > -1) ? '' : 'none'; });
  }

  async function loadContent() {
    const res = await fetch('/api/admin/content'); data = await res.json();
    if (!data || typeof data !== 'object') data = {};
    data.langs = data.langs || [{ code: 'zh', label: '中文', dir: 'ltr' }];
    data.settings = data.settings || {};
    lang = data.defaultLang || (data.langs[0] && data.langs[0].code) || 'zh';
    leadsCache = null; uploadsCache = null; usersCache = null;
    await loadUsers(true).catch(() => {});
    updateMenusForRole();
    renderLangTabs(); switchSection('dashboard'); markClean();
    loadLeads(true).then(updateInboxBadge).catch(() => {});
  }

  function bindGlobal() {
    $$('.menu-item').forEach((m) => m.addEventListener('click', () => switchSection(m.dataset.sec)));
    $('#saveBtn').addEventListener('click', save);
    $('#pickerClose').addEventListener('click', () => $('#picker').classList.add('hidden'));
    $('#picker').addEventListener('click', (e) => { if (e.target.id === 'picker') $('#picker').classList.add('hidden'); });
    $('#logoutBtn').addEventListener('click', async () => { await fetch('/api/logout', { method: 'POST' }); showLogin(); });
    $('#loginForm').addEventListener('submit', async (e) => {
      e.preventDefault(); $('#loginErr').textContent = '';
      try { const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: $('#loginUser').value, password: $('#loginPass').value }) }); const j = await res.json(); if (!res.ok) throw new Error(j.error || '登录失败'); me = j.user || null; showApp(); await loadContent(); } catch (err) { $('#loginErr').textContent = err.message; }
    });
    document.addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); if (!$('#appView').classList.contains('hidden')) save(); } });
    window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
  }

  async function boot() {
    applyAdminTheme(currentThemeKey());
    bindGlobal();
    initThemeSel();
    try { const res = await fetch('/api/session'); const j = await res.json(); if (j.authed) { me = j.user || null; showApp(); await loadContent(); } else showLogin(); } catch (e) { showLogin(); }
  }
  boot();
})();
