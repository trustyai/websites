/* V槽 CMS 多语言后台 */
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  let data = {};
  let lang = 'zh';
  let currentSec = 'brand';
  let dirty = false;

  const SEC_TITLES = { dashboard: '仪表盘', brand: '品牌与导航', hero: '首页文案', wizard: '智能选型', products: '产品管理', contact: '联系页', chat: '在线客服', inbox: '收件箱', media: '媒体库', tools: '翻译与备份', account: '账号安全' };

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
    const sec = $('#secProducts'); sec.innerHTML = '';
    const l = L(); l.productsSection = l.productsSection || {}; l.products = l.products || [];
    const c1 = card('【' + lang + '】板块文案');
    c1.appendChild(field('标签', l.productsSection, 'tag'));
    c1.appendChild(field('标题', l.productsSection, 'title', { textarea: true, rows: 2, hint: '换行用回车，*星号*高亮' }));
    c1.appendChild(field('副标题', l.productsSection, 'subtitle'));
    sec.appendChild(c1);

    l.products.forEach((p, i) => {
      const c = card('');
      const head = document.createElement('div'); head.className = 'li-head';
      const title = document.createElement('span'); title.className = 'li-title prod-collapse'; title.textContent = '📦 ' + (p.name || '产品') + ' （点击展开/收起）';
      head.appendChild(title);
      const acts = document.createElement('div'); acts.className = 'li-actions';
      acts.appendChild(iconBtn('↑', '', () => moveItem(l.products, i, -1, renderProducts)));
      acts.appendChild(iconBtn('↓', '', () => moveItem(l.products, i, 1, renderProducts)));
      const sync = iconBtn('🔁', '', () => syncProductMedia(p)); sync.title = '把图集/封面/价格同步到所有语言'; acts.appendChild(sync);
      acts.appendChild(iconBtn('✕', 'del', () => { if (confirm('删除该产品？')) { l.products.splice(i, 1); markDirty(); renderProducts(); } }));
      head.appendChild(acts); c.appendChild(head);

      const body = document.createElement('div'); body.className = 'prod-body';
      if (p._collapsed) body.style.display = 'none';
      title.addEventListener('click', () => { p._collapsed = !p._collapsed; body.style.display = p._collapsed ? 'none' : ''; });

      const g1 = document.createElement('div'); g1.className = 'grid2';
      g1.appendChild(field('产品名称', p, 'name')); g1.appendChild(field('网址标识 slug', p, 'slug', { placeholder: 'manual' }));
      body.appendChild(g1);
      const g2 = document.createElement('div'); g2.className = 'grid2';
      g2.appendChild(field('徽章文字', p, 'badge', { placeholder: '入门级' }));
      g2.appendChild(field('徽章样式class', p, 'badgeClass', { placeholder: 'entry/pro/expert/highend/portable/industrial' }));
      body.appendChild(g2);
      body.appendChild(field('副标题（详情页）', p, 'subtitle', { textarea: true, rows: 2 }));
      body.appendChild(field('首页卡片描述', p, 'cardDesc', { textarea: true, rows: 2 }));
      const g3 = document.createElement('div'); g3.className = 'grid2';
      g3.appendChild(csvField('首页卡片标签(逗号)', p, 'cardTags'));
      g3.appendChild(csvField('选型匹配(逗号)', p, 'match', { hint: 'thin/medium/thick/custom, small/large' }));
      body.appendChild(g3);

      // 封面图（卡片）
      const coverRow = document.createElement('div'); coverRow.className = 'row';
      coverRow.innerHTML = '<label class="lbl">首页卡片封面图 URL</label>';
      coverRow.appendChild(field('', p, 'cardImage', { placeholder: '/uploads/xxx.jpg 或图片直链' }));
      const coverUp = document.createElement('label'); coverUp.className = 'btn ghost'; coverUp.textContent = '上传封面图';
      const cfi = document.createElement('input'); cfi.type = 'file'; cfi.accept = 'image/*'; cfi.className = 'hidden';
      cfi.addEventListener('change', async () => { if (!cfi.files[0]) return; coverUp.textContent = '上传中...'; try { const r = await uploadFile(cfi.files[0]); p.cardImage = r.url; markDirty(); renderProducts(); } catch (e) { toast(e.message, 'bad'); } });
      coverUp.appendChild(cfi); coverRow.appendChild(coverUp);
      coverRow.appendChild(pickBtn('从媒体库选', (f) => { p.cardImage = f.url; markDirty(); renderProducts(); }));
      body.appendChild(coverRow);

      // 价格
      p.price = p.price || {};
      const pc = document.createElement('div'); pc.innerHTML = '<label class="lbl">价格</label>';
      const pg = document.createElement('div'); pg.className = 'grid3';
      pg.appendChild(field('主价格', p.price, 'main', { placeholder: '¥8,800' }));
      pg.appendChild(field('后缀', p.price, 'cny', { placeholder: '起' }));
      pg.appendChild(field('副价格', p.price, 'usd', { placeholder: '约 $1,210 USD' }));
      pc.appendChild(pg);
      const pg2 = document.createElement('div'); pg2.className = 'grid2';
      pg2.appendChild(field('价格标签', p.price, 'label', { placeholder: '参考价格' }));
      pg2.appendChild(field('价格备注', p.price, 'note'));
      pc.appendChild(pg2); body.appendChild(pc);

      const g4 = document.createElement('div'); g4.className = 'grid2';
      g4.appendChild(field('主按钮文字', p, 'ctaPrimary')); g4.appendChild(field('次按钮文字', p, 'ctaSecondary'));
      body.appendChild(g4);

      // 交付标签
      const dc = document.createElement('div'); dc.innerHTML = '<label class="lbl">交付标签</label>'; p.delivery = p.delivery || [];
      renderList(dc, p.delivery, { label: (x, i) => '标签 ' + (i + 1), rerender: renderProducts, addLabel: '+ 交付标签', makeDefault: () => ({ text: '', green: false }), fields: (x, host) => {
        const g = document.createElement('div'); g.className = 'grid2'; g.appendChild(field('文字', x, 'text', { placeholder: '✅ 现货供应' }));
        g.appendChild(field('高亮绿色', x, 'green', { select: true, options: [{ value: 'false', label: '否' }, { value: 'true', label: '是' }], onInput: (v) => { x.green = v === 'true'; } })); host.appendChild(g);
      } }); body.appendChild(dc);

      // 信任徽章
      const tc = document.createElement('div'); tc.className = 'row'; tc.innerHTML = '<label class="lbl">信任徽章</label>';
      tc.appendChild(csvField('（逗号分隔）', p, 'trustBadges', { placeholder: '✅ CE认证, 💯 30天退货' })); body.appendChild(tc);

      // 卖点/优势 benefits
      const bc = document.createElement('div'); bc.innerHTML = '<label class="lbl">核心优势（图标+文字）</label>'; p.benefits = p.benefits || [];
      renderList(bc, p.benefits, { label: (x, i) => '优势 ' + (i + 1), rerender: renderProducts, addLabel: '+ 优势', makeDefault: () => ({ icon: '🎯', text: '' }), fields: (x, host) => {
        const g = document.createElement('div'); g.className = 'grid2'; g.appendChild(field('图标', x, 'icon')); g.appendChild(field('文字', x, 'text')); host.appendChild(g);
      } }); body.appendChild(bc);

      // 亮点
      body.appendChild(field('亮点标题', p, 'highlightsTitle', { placeholder: '🔥 核心亮点' }));
      body.appendChild(field('产品亮点（每行一条）', { v: (p.highlights || []).join('\n') }, 'v', { textarea: true, rows: 4, onInput: (val) => { p.highlights = val.split('\n').map((s) => s.trim()).filter(Boolean); } }));

      // 参数
      body.appendChild(field('参数标题', p, 'specsTitle', { placeholder: '📋 技术规格' }));
      const spc = document.createElement('div'); spc.innerHTML = '<label class="lbl">技术参数</label>'; p.specs = p.specs || [];
      renderList(spc, p.specs, { label: (x, i) => '参数 ' + (i + 1), rerender: renderProducts, addLabel: '+ 参数', makeDefault: () => ({ k: '', v: '' }), fields: (x, host) => {
        const g = document.createElement('div'); g.className = 'grid2'; g.appendChild(field('名称', x, 'k')); g.appendChild(field('值', x, 'v')); host.appendChild(g);
      } }); body.appendChild(spc);

      // 相关推荐
      body.appendChild(field('相关推荐标题', p, 'relatedTitle'));
      const rc = document.createElement('div'); rc.innerHTML = '<label class="lbl">相关产品（slug 对应其它产品的网址标识）</label>'; p.related = p.related || [];
      renderList(rc, p.related, { label: (x, i) => '推荐 ' + (i + 1), rerender: renderProducts, addLabel: '+ 相关产品', makeDefault: () => ({ slug: '', name: '', note: '' }), fields: (x, host) => {
        const g = document.createElement('div'); g.className = 'grid3'; g.appendChild(field('slug', x, 'slug')); g.appendChild(field('名称', x, 'name')); g.appendChild(field('备注', x, 'note')); host.appendChild(g);
      } }); body.appendChild(rc);

      // 图集
      const gc = document.createElement('div'); gc.className = 'row'; gc.innerHTML = '<label class="lbl">详情页图集（图片/视频，第一个为主图）</label>';
      p.gallery = p.gallery || [];
      mediaEditor(gc, p.gallery, renderProducts, 'image/*,video/*');
      gc.appendChild(pickBtn('从媒体库添加', (f) => { p.gallery.push({ type: f.type, src: f.url, alt: '' }); markDirty(); renderProducts(); }));
      body.appendChild(gc);

      c.appendChild(body); sec.appendChild(c);
    });
    const add = document.createElement('button'); add.className = 'add-btn'; add.type = 'button'; add.textContent = '+ 添加产品';
    add.addEventListener('click', () => { l.products.push({ id: 'p' + Date.now(), slug: 'p' + Date.now(), name: '新产品', badge: '', gallery: [], specs: [], benefits: [], delivery: [], highlights: [], related: [], cardTags: [], match: [], price: {} }); markDirty(); renderProducts(); });
    sec.appendChild(add);
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
    const c1 = card('【' + lang + '】客服信息');
    const g = document.createElement('div'); g.className = 'grid2'; g.appendChild(field('客服名称', ch, 'agentName')); g.appendChild(field('头像文字', ch, 'avatar'));
    c1.appendChild(g);
    c1.appendChild(field('状态文字', ch, 'status'));
    c1.appendChild(field('欢迎语', ch, 'greeting', { textarea: true, rows: 2 }));
    c1.appendChild(field('兜底回复（无匹配时）', ch, 'fallback', { textarea: true, rows: 2 }));
    sec.appendChild(c1);
    const c2 = card('快捷问题'); ch.quickChips = ch.quickChips || [];
    ch.quickChips.forEach((q, i) => {
      const it = document.createElement('div'); it.className = 'list-item'; it.style.cssText = 'display:flex;gap:0.5rem;align-items:center';
      const f = field('', { v: q }, 'v', { onInput: (val) => { ch.quickChips[i] = val; } }); f.style.cssText = 'flex:1;margin:0'; it.appendChild(f);
      it.appendChild(iconBtn('✕', 'del', () => { ch.quickChips.splice(i, 1); markDirty(); renderChat(); })); c2.appendChild(it);
    });
    const addChip = document.createElement('button'); addChip.className = 'add-btn'; addChip.type = 'button'; addChip.textContent = '+ 快捷问题';
    addChip.addEventListener('click', () => { ch.quickChips.push('新问题'); markDirty(); renderChat(); }); c2.appendChild(addChip);
    sec.appendChild(c2);

    const c3 = card('自动回复规则'); hint(c3, '用户消息包含任一关键词即回复对应内容；都不匹配用兜底回复'); ch.replies = ch.replies || [];
    renderList(c3, ch.replies, { label: (x, i) => '规则 ' + (i + 1), rerender: renderChat, addLabel: '+ 回复规则', makeDefault: () => ({ keywords: [], text: '' }), fields: (x, host) => {
      host.appendChild(csvField('关键词（逗号）', x, 'keywords')); host.appendChild(field('回复内容', x, 'text', { textarea: true, rows: 2 }));
    } }); sec.appendChild(c3);
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
    sec.appendChild(cs);
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
    const unread = (leadsCache || []).filter((l) => !l.read).length;
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
    const unread = leads.filter((l) => !l.read).length;
    const c1 = card('概览');
    const g = document.createElement('div'); g.className = 'stat-grid';
    const stat = (n, l) => '<div class="stat"><div class="n">' + n + '</div><div class="l">' + l + '</div></div>';
    g.innerHTML = stat(langs.length, '语言') + stat((defL.products || []).length, '产品(默认语言)') + stat(files.length, '媒体文件') + stat(unread, '未读询价');
    c1.appendChild(g);
    const quick = document.createElement('div'); quick.className = 'quick';
    langs.forEach((l) => { const a = document.createElement('a'); a.className = 'btn ghost'; a.target = '_blank'; a.href = (l.code === (data.defaultLang || 'zh') ? '/' : '/' + l.code); a.textContent = '🔎 ' + (l.label || l.code); quick.appendChild(a); });
    c1.appendChild(quick);
    sec.appendChild(c1);

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

  // ============ 收件箱 ============
  async function renderInbox() {
    const sec = $('#secInbox'); sec.innerHTML = '';
    const c = card('询价 / 留言');
    const bar = document.createElement('div'); bar.style.cssText = 'display:flex;gap:0.5rem;margin-bottom:0.8rem';
    const refresh = document.createElement('button'); refresh.className = 'btn ghost'; refresh.textContent = '↻ 刷新'; refresh.addEventListener('click', () => renderInbox());
    const exp = document.createElement('button'); exp.className = 'btn ghost'; exp.textContent = '导出 CSV';
    bar.appendChild(refresh); bar.appendChild(exp); c.appendChild(bar);
    const listHost = document.createElement('div'); listHost.innerHTML = '<div style="color:var(--muted)">加载中...</div>'; c.appendChild(listHost);
    sec.appendChild(c);
    const leads = await loadLeads(true); updateInboxBadge();
    exp.addEventListener('click', () => {
      const rows = [['时间', '姓名', '邮箱', '公司', '语言', '页面', '内容']].concat(leads.map((l) => [new Date(l.time).toLocaleString(), l.name, l.email, l.company, l.lang, l.page, (l.message || '').replace(/\n/g, ' ')]));
      const csv = '\ufeff' + rows.map((r) => r.map((x) => '"' + String(x == null ? '' : x).replace(/"/g, '""') + '"').join(',')).join('\n');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'leads.csv'; a.click();
    });
    if (!leads.length) { listHost.innerHTML = '<div style="color:var(--muted)">还没有收到询价。前台联系页的表单提交后会显示在这里。</div>'; return; }
    listHost.innerHTML = '';
    leads.forEach((l) => {
      const el = document.createElement('div'); el.className = 'lead' + (l.read ? '' : ' unread');
      const contact = [l.email, l.company].filter(Boolean).join(' · ');
      el.innerHTML = '<div class="lh"><b>' + esc(l.name || '(未填姓名)') + '</b>' +
        (contact ? '<span class="meta">' + esc(contact) + '</span>' : '') +
        '<span class="meta">' + esc(new Date(l.time).toLocaleString()) + ' · ' + esc(l.lang || '') + '</span><span class="acts"></span></div>' +
        '<div class="msg">' + esc(l.message || '') + '</div>';
      const acts = el.querySelector('.acts');
      const rd = document.createElement('button'); rd.className = 'icon-btn'; rd.textContent = l.read ? '↺' : '✓'; rd.title = l.read ? '标为未读' : '标为已读';
      rd.addEventListener('click', async () => { await fetch('/api/leads/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: l.id, read: !l.read }) }); leadsCache = null; renderInbox(); });
      const del = document.createElement('button'); del.className = 'icon-btn del'; del.textContent = '✕';
      del.addEventListener('click', async () => { if (!confirm('删除该条询价？')) return; await fetch('/api/leads', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: l.id }) }); leadsCache = null; renderInbox(); });
      acts.appendChild(rd); acts.appendChild(del); listHost.appendChild(el);
    });
  }

  const RENDERERS = { dashboard: renderDashboard, brand: renderBrand, hero: renderHero, wizard: renderWizard, products: renderProducts, contact: renderContact, chat: renderChat, inbox: renderInbox, media: renderMedia, tools: renderTools, account: renderAccount };
  function renderSection(sec) { if (RENDERERS[sec]) RENDERERS[sec](); }

  function renderLangTabs() {
    const host = $('#langTabs'); host.innerHTML = '';
    (data.langs || []).forEach((lg) => {
      const b = document.createElement('button'); b.className = 'lang-tab' + (lg.code === lang ? ' active' : ''); b.textContent = lg.label || lg.code;
      b.addEventListener('click', () => { lang = lg.code; renderLangTabs(); updatePreview(); renderSection(currentSec); });
      host.appendChild(b);
    });
  }

  function switchSection(sec) {
    currentSec = sec;
    $$('.menu-item').forEach((m) => m.classList.toggle('active', m.dataset.sec === sec));
    $$('.section').forEach((s) => s.classList.toggle('active', s.dataset.sec === sec));
    $('#secTitle').textContent = SEC_TITLES[sec] || '';
    $('#langTabs').style.display = ['dashboard', 'inbox', 'media', 'account'].indexOf(sec) > -1 ? 'none' : '';
    updatePreview();
    renderSection(sec);
  }

  async function save() {
    const btn = $('#saveBtn'); btn.textContent = '保存中...'; btn.disabled = true;
    try {
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

  async function loadContent() {
    const res = await fetch('/api/content'); data = await res.json();
    if (!data || typeof data !== 'object') data = {};
    data.langs = data.langs || [{ code: 'zh', label: '中文', dir: 'ltr' }];
    data.settings = data.settings || {};
    lang = data.defaultLang || (data.langs[0] && data.langs[0].code) || 'zh';
    leadsCache = null; uploadsCache = null;
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
      try { const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: $('#loginUser').value, password: $('#loginPass').value }) }); const j = await res.json(); if (!res.ok) throw new Error(j.error || '登录失败'); showApp(); await loadContent(); } catch (err) { $('#loginErr').textContent = err.message; }
    });
    document.addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); if (!$('#appView').classList.contains('hidden')) save(); } });
    window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
  }

  async function boot() {
    bindGlobal();
    try { const res = await fetch('/api/session'); const j = await res.json(); if (j.authed) { showApp(); await loadContent(); } else showLogin(); } catch (e) { showLogin(); }
  }
  boot();
})();
