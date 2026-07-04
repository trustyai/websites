/* V槽 CMS 后台逻辑 */
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  let data = {};
  let dirty = false;

  const SEC_TITLES = {
    brand: '品牌与主题',
    hero: '首页文案',
    adv: '核心优势',
    products: '产品管理',
    contact: '联系与页脚',
    chat: '在线客服',
    account: '账号安全',
  };

  function toast(msg, kind) {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'show ' + (kind || '');
    setTimeout(() => (t.className = kind || ''), 2200);
  }

  function markDirty() {
    dirty = true;
    const h = $('#saveHint');
    h.textContent = '有未保存的修改';
    h.classList.add('dirty');
  }
  function markClean() {
    dirty = false;
    const h = $('#saveHint');
    h.textContent = '已保存';
    h.classList.remove('dirty');
  }

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  // 通用：创建绑定输入
  function field(label, obj, key, opts) {
    opts = opts || {};
    const wrap = document.createElement('div');
    wrap.className = 'row';
    const id = 'f' + Math.random().toString(36).slice(2, 8);
    let control;
    if (opts.textarea) {
      control = document.createElement('textarea');
      control.rows = opts.rows || 3;
    } else {
      control = document.createElement('input');
      control.type = opts.type || 'text';
    }
    control.className = 'inp';
    control.id = id;
    control.value = obj[key] != null ? obj[key] : '';
    if (opts.placeholder) control.placeholder = opts.placeholder;
    control.addEventListener('input', () => {
      obj[key] = control.value;
      markDirty();
      if (opts.onInput) opts.onInput(control.value);
    });
    wrap.innerHTML = '<label class="lbl" for="' + id + '">' + esc(label) + '</label>';
    wrap.appendChild(control);
    if (opts.hint) {
      const h = document.createElement('div');
      h.className = 'hint';
      h.style.marginTop = '0.3rem';
      h.textContent = opts.hint;
      wrap.appendChild(h);
    }
    return wrap;
  }

  function card(title) {
    const c = document.createElement('div');
    c.className = 'card';
    if (title) {
      const h = document.createElement('h3');
      h.textContent = title;
      c.appendChild(h);
    }
    return c;
  }

  function iconBtn(txt, cls, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'icon-btn ' + (cls || '');
    b.textContent = txt;
    b.addEventListener('click', onClick);
    return b;
  }

  // 上传文件 -> 返回 {url,type}
  async function uploadFile(file) {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e.error || '上传失败');
    }
    return res.json();
  }

  // ---------- 品牌与主题 ----------
  function renderBrand() {
    const sec = $('#secBrand');
    sec.innerHTML = '';
    data.brand = data.brand || {};
    const b = data.brand;

    const c1 = card('品牌信息');
    c1.appendChild(field('品牌名称', b, 'name'));
    c1.appendChild(field('导航按钮文字', b, 'navCta', { placeholder: '如：免费获取报价' }));

    // Logo 上传
    const logoRow = document.createElement('div');
    logoRow.className = 'row';
    logoRow.innerHTML = '<label class="lbl">Logo 图片</label>';
    const preview = document.createElement('div');
    preview.className = 'logo-preview';
    preview.innerHTML = b.logo ? '<img src="' + esc(b.logo) + '">' : '<span style="color:var(--muted);font-size:0.8rem">未设置</span>';
    const upBtn = document.createElement('label');
    upBtn.className = 'btn ghost';
    upBtn.style.marginLeft = '0.6rem';
    upBtn.textContent = '上传 Logo';
    const fileInp = document.createElement('input');
    fileInp.type = 'file';
    fileInp.accept = 'image/*';
    fileInp.className = 'hidden';
    fileInp.addEventListener('change', async () => {
      if (!fileInp.files[0]) return;
      upBtn.textContent = '上传中...';
      try {
        const r = await uploadFile(fileInp.files[0]);
        b.logo = r.url;
        markDirty();
        renderBrand();
      } catch (e) {
        toast(e.message, 'bad');
      }
      upBtn.textContent = '上传 Logo';
    });
    upBtn.appendChild(fileInp);
    const flex = document.createElement('div');
    flex.style.display = 'flex';
    flex.style.alignItems = 'center';
    flex.appendChild(preview);
    flex.appendChild(upBtn);
    logoRow.appendChild(flex);
    c1.appendChild(logoRow);
    sec.appendChild(c1);

    // 导航菜单
    const c2 = card('导航菜单');
    const navHint = document.createElement('div');
    navHint.className = 'hint';
    navHint.textContent = '链接可填页面锚点，如 #need-section / #advantages / #all-products / #contact';
    c2.appendChild(navHint);
    b.navLinks = b.navLinks || [];
    b.navLinks.forEach((lnk, i) => {
      const item = document.createElement('div');
      item.className = 'list-item';
      const head = document.createElement('div');
      head.className = 'li-head';
      head.innerHTML = '<span class="li-title">菜单 ' + (i + 1) + '</span>';
      const acts = document.createElement('div');
      acts.className = 'li-actions';
      acts.appendChild(iconBtn('↑', '', () => moveItem(b.navLinks, i, -1, renderBrand)));
      acts.appendChild(iconBtn('↓', '', () => moveItem(b.navLinks, i, 1, renderBrand)));
      acts.appendChild(iconBtn('✕', 'del', () => { b.navLinks.splice(i, 1); markDirty(); renderBrand(); }));
      head.appendChild(acts);
      item.appendChild(head);
      const g = document.createElement('div');
      g.className = 'grid2';
      g.appendChild(field('文字', lnk, 'label'));
      g.appendChild(field('链接', lnk, 'href'));
      item.appendChild(g);
      c2.appendChild(item);
    });
    const addNav = document.createElement('button');
    addNav.className = 'add-btn';
    addNav.type = 'button';
    addNav.textContent = '+ 添加菜单项';
    addNav.addEventListener('click', () => { b.navLinks.push({ label: '新菜单', href: '#' }); markDirty(); renderBrand(); });
    c2.appendChild(addNav);
    sec.appendChild(c2);

    // 主题选择
    const c3 = card('主题风格');
    const th = document.createElement('div');
    th.className = 'hint';
    th.textContent = '点击切换整站配色与字体，前台立即生效（保存后永久）。';
    c3.appendChild(th);
    const grid = document.createElement('div');
    grid.className = 'theme-grid';
    const themes = window.VG_THEMES || {};
    Object.entries(themes).forEach(([key, t]) => {
      const tc = document.createElement('div');
      tc.className = 'theme-card' + ((data.theme || 'green') === key ? ' selected' : '');
      tc.innerHTML =
        '<div class="theme-swatch">' +
        '<span style="background:' + t.vars['--primary'] + '"></span>' +
        '<span style="background:' + t.vars['--accent'] + '"></span>' +
        '<span style="background:' + t.vars['--dark'] + '"></span>' +
        '</div><div class="tc-name">' + esc(t.name) + '</div>' +
        '<div class="tc-desc">' + esc(t.desc || '') + '</div>';
      tc.addEventListener('click', () => {
        data.theme = key;
        markDirty();
        renderBrand();
      });
      grid.appendChild(tc);
    });
    c3.appendChild(grid);
    sec.appendChild(c3);
  }

  // ---------- 首页文案 ----------
  function renderHero() {
    const sec = $('#secHero');
    sec.innerHTML = '';
    data.hero = data.hero || {};
    const h = data.hero;
    const c1 = card('首屏文案');
    c1.appendChild(field('小标签（eyebrow）', h, 'eyebrow'));
    c1.appendChild(field('大标题', h, 'title', { hint: '第一个空格之后的文字会自动换行并用主题色高亮。例：找到最适合 你的开槽机' }));
    c1.appendChild(field('副标题', h, 'subtitle', { textarea: true }));
    const g = document.createElement('div');
    g.className = 'grid2';
    g.appendChild(field('按钮文字', h, 'cta'));
    g.appendChild(field('按钮链接', h, 'ctaHref', { placeholder: '#need-section' }));
    c1.appendChild(g);
    sec.appendChild(c1);

    const c2 = card('数据指标（4 个）');
    h.stats = h.stats || [];
    h.stats.forEach((s, i) => {
      const item = document.createElement('div');
      item.className = 'list-item';
      const head = document.createElement('div');
      head.className = 'li-head';
      head.innerHTML = '<span class="li-title">指标 ' + (i + 1) + '</span>';
      const acts = document.createElement('div');
      acts.className = 'li-actions';
      acts.appendChild(iconBtn('↑', '', () => moveItem(h.stats, i, -1, renderHero)));
      acts.appendChild(iconBtn('↓', '', () => moveItem(h.stats, i, 1, renderHero)));
      acts.appendChild(iconBtn('✕', 'del', () => { h.stats.splice(i, 1); markDirty(); renderHero(); }));
      head.appendChild(acts);
      item.appendChild(head);
      const gg = document.createElement('div');
      gg.className = 'grid2';
      gg.appendChild(field('数值', s, 'num', { placeholder: '如 5000+' }));
      gg.appendChild(field('说明', s, 'label', { placeholder: '如 全球客户' }));
      item.appendChild(gg);
      c2.appendChild(item);
    });
    const addStat = document.createElement('button');
    addStat.className = 'add-btn';
    addStat.type = 'button';
    addStat.textContent = '+ 添加指标';
    addStat.addEventListener('click', () => { h.stats.push({ num: '', label: '' }); markDirty(); renderHero(); });
    c2.appendChild(addStat);
    sec.appendChild(c2);
  }

  // ---------- 核心优势 ----------
  function renderAdv() {
    const sec = $('#secAdv');
    sec.innerHTML = '';
    data.advantages = data.advantages || { items: [] };
    const a = data.advantages;
    const c1 = card('板块标题');
    c1.appendChild(field('标签', a, 'tag'));
    c1.appendChild(field('标题', a, 'title', { hint: '第一个空格之后的文字会高亮' }));
    c1.appendChild(field('副标题', a, 'subtitle'));
    sec.appendChild(c1);

    const c2 = card('优势条目');
    a.items = a.items || [];
    a.items.forEach((it, i) => {
      const item = document.createElement('div');
      item.className = 'list-item';
      const head = document.createElement('div');
      head.className = 'li-head';
      head.innerHTML = '<span class="li-title">优势 ' + (i + 1) + '</span>';
      const acts = document.createElement('div');
      acts.className = 'li-actions';
      acts.appendChild(iconBtn('↑', '', () => moveItem(a.items, i, -1, renderAdv)));
      acts.appendChild(iconBtn('↓', '', () => moveItem(a.items, i, 1, renderAdv)));
      acts.appendChild(iconBtn('✕', 'del', () => { a.items.splice(i, 1); markDirty(); renderAdv(); }));
      head.appendChild(acts);
      item.appendChild(head);
      const g = document.createElement('div');
      g.className = 'grid2';
      g.appendChild(field('图标（emoji）', it, 'icon', { placeholder: '如 🏭' }));
      g.appendChild(field('标题', it, 'title'));
      item.appendChild(g);
      item.appendChild(field('描述', it, 'desc', { textarea: true, rows: 2 }));
      c2.appendChild(item);
    });
    const add = document.createElement('button');
    add.className = 'add-btn';
    add.type = 'button';
    add.textContent = '+ 添加优势';
    add.addEventListener('click', () => { a.items.push({ icon: '⭐', title: '新优势', desc: '' }); markDirty(); renderAdv(); });
    c2.appendChild(add);
    sec.appendChild(c2);
  }

  // ---------- 产品管理 ----------
  function renderProducts() {
    const sec = $('#secProducts');
    sec.innerHTML = '';
    data.products = data.products || { items: [] };
    const pr = data.products;
    const c1 = card('板块标题');
    c1.appendChild(field('标签', pr, 'tag'));
    c1.appendChild(field('标题', pr, 'title', { hint: '第一个空格之后的文字会高亮' }));
    c1.appendChild(field('副标题', pr, 'subtitle'));
    sec.appendChild(c1);

    pr.items = pr.items || [];
    pr.items.forEach((p, i) => {
      const c = card('');
      const head = document.createElement('div');
      head.className = 'li-head';
      head.innerHTML = '<span class="li-title">📦 ' + esc(p.name || '产品') + '</span>';
      const acts = document.createElement('div');
      acts.className = 'li-actions';
      acts.appendChild(iconBtn('↑', '', () => moveItem(pr.items, i, -1, renderProducts)));
      acts.appendChild(iconBtn('↓', '', () => moveItem(pr.items, i, 1, renderProducts)));
      acts.appendChild(iconBtn('✕', 'del', () => { if (confirm('确定删除该产品？')) { pr.items.splice(i, 1); markDirty(); renderProducts(); } }));
      head.appendChild(acts);
      c.appendChild(head);

      const g = document.createElement('div');
      g.className = 'grid2';
      g.appendChild(field('产品名称', p, 'name'));
      g.appendChild(field('标签徽章', p, 'badge', { placeholder: '如 入门级' }));
      c.appendChild(g);
      c.appendChild(field('描述', p, 'desc', { textarea: true, rows: 2 }));

      // tags 以逗号分隔
      const tagRow = field('标签（逗号分隔）', { v: (p.tags || []).join(', ') }, 'v', {
        placeholder: '灰纸板, 卡纸, 小批量',
        onInput: (val) => { p.tags = val.split(/[,，]/).map((s) => s.trim()).filter(Boolean); },
      });
      c.appendChild(tagRow);

      // 选型匹配标签
      const matchRow = field('选型匹配（逗号分隔，用于智能选型推荐）', { v: (p.match || []).join(', ') }, 'v', {
        placeholder: 'thin, medium, thick, custom, small, large',
        hint: '厚度: thin(薄) medium(中) thick(厚) custom(超厚)；规模: small large',
        onInput: (val) => { p.match = val.split(/[,，]/).map((s) => s.trim()).filter(Boolean); },
      });
      c.appendChild(matchRow);

      // 媒体
      const mediaWrap = document.createElement('div');
      mediaWrap.className = 'row';
      mediaWrap.innerHTML = '<label class="lbl">图片 / 视频（第一个作为封面）</label>';
      const list = document.createElement('div');
      list.className = 'media-list';
      p.media = p.media || [];
      p.media.forEach((m, mi) => {
        const th = document.createElement('div');
        th.className = 'media-thumb';
        th.innerHTML =
          (m.type === 'video'
            ? '<video src="' + esc(m.src) + '" muted></video><span class="mt-type">视频</span>'
            : '<img src="' + esc(m.src) + '"><span class="mt-type">图片</span>') +
          '';
        const del = document.createElement('div');
        del.className = 'mt-del';
        del.textContent = '✕';
        del.addEventListener('click', () => { p.media.splice(mi, 1); markDirty(); renderProducts(); });
        th.appendChild(del);
        list.appendChild(th);
      });
      mediaWrap.appendChild(list);
      const upLabel = document.createElement('label');
      upLabel.className = 'btn ghost';
      upLabel.textContent = '+ 上传图片/视频';
      const fi = document.createElement('input');
      fi.type = 'file';
      fi.accept = 'image/*,video/*';
      fi.className = 'hidden';
      fi.addEventListener('change', async () => {
        if (!fi.files[0]) return;
        upLabel.textContent = '上传中...';
        try {
          const r = await uploadFile(fi.files[0]);
          p.media.push({ type: r.type, src: r.url, alt: p.name || '' });
          markDirty();
          renderProducts();
        } catch (e) {
          toast(e.message, 'bad');
        }
        upLabel.textContent = '+ 上传图片/视频';
      });
      upLabel.appendChild(fi);
      mediaWrap.appendChild(upLabel);
      c.appendChild(mediaWrap);
      sec.appendChild(c);
    });

    const add = document.createElement('button');
    add.className = 'add-btn';
    add.type = 'button';
    add.textContent = '+ 添加产品';
    add.addEventListener('click', () => {
      pr.items.push({ id: 'p' + Date.now(), name: '新产品', badge: '', desc: '', tags: [], match: [], media: [] });
      markDirty();
      renderProducts();
    });
    sec.appendChild(add);
  }

  // ---------- 联系与页脚 ----------
  function renderContact() {
    const sec = $('#secContact');
    sec.innerHTML = '';
    data.contact = data.contact || {};
    data.footer = data.footer || {};
    const c = data.contact;
    const c1 = card('行动号召（CTA）');
    c1.appendChild(field('标签', c, 'tag'));
    c1.appendChild(field('标题', c, 'title', { hint: '第一个空格之后的文字会高亮' }));
    c1.appendChild(field('副标题', c, 'subtitle', { textarea: true, rows: 2 }));
    c1.appendChild(field('按钮文字', c, 'ctaText'));
    sec.appendChild(c1);

    const c2 = card('联系方式');
    const g = document.createElement('div');
    g.className = 'grid2';
    g.appendChild(field('电话', c, 'phone'));
    g.appendChild(field('邮箱', c, 'email'));
    c2.appendChild(g);
    c2.appendChild(field('微信', c, 'wechat'));
    sec.appendChild(c2);

    const c3 = card('页脚');
    c3.appendChild(field('版权信息', data.footer, 'copyright'));
    sec.appendChild(c3);
  }

  // ---------- 在线客服 ----------
  function renderChat() {
    const sec = $('#secChat');
    sec.innerHTML = '';
    data.chat = data.chat || {};
    const ch = data.chat;
    const c1 = card('客服信息');
    const g = document.createElement('div');
    g.className = 'grid2';
    g.appendChild(field('客服名称', ch, 'agentName'));
    g.appendChild(field('头像文字（1 字）', ch, 'avatar', { placeholder: '李' }));
    c1.appendChild(g);
    c1.appendChild(field('状态文字', ch, 'status', { placeholder: '在线 · 通常1分钟内回复' }));
    c1.appendChild(field('欢迎语', ch, 'greeting', { textarea: true, rows: 2 }));
    c1.appendChild(field('兜底回复（无匹配时）', ch, 'fallback', { textarea: true, rows: 2 }));
    sec.appendChild(c1);

    const c2 = card('快捷问题');
    ch.quickChips = ch.quickChips || [];
    ch.quickChips.forEach((q, i) => {
      const item = document.createElement('div');
      item.className = 'list-item';
      item.style.display = 'flex';
      item.style.gap = '0.5rem';
      item.style.alignItems = 'center';
      const f = field('', { v: q }, 'v', { onInput: (val) => { ch.quickChips[i] = val; } });
      f.style.flex = '1';
      f.style.margin = '0';
      item.appendChild(f);
      item.appendChild(iconBtn('✕', 'del', () => { ch.quickChips.splice(i, 1); markDirty(); renderChat(); }));
      c2.appendChild(item);
    });
    const addChip = document.createElement('button');
    addChip.className = 'add-btn';
    addChip.type = 'button';
    addChip.textContent = '+ 添加快捷问题';
    addChip.addEventListener('click', () => { ch.quickChips.push('新问题'); markDirty(); renderChat(); });
    c2.appendChild(addChip);
    sec.appendChild(c2);

    const c3 = card('自动回复规则');
    const hint = document.createElement('div');
    hint.className = 'hint';
    hint.textContent = '当用户消息包含任一关键词时，回复对应内容；都不匹配则用兜底回复。';
    c3.appendChild(hint);
    ch.replies = ch.replies || [];
    ch.replies.forEach((r, i) => {
      const item = document.createElement('div');
      item.className = 'list-item';
      const head = document.createElement('div');
      head.className = 'li-head';
      head.innerHTML = '<span class="li-title">规则 ' + (i + 1) + '</span>';
      const acts = document.createElement('div');
      acts.className = 'li-actions';
      acts.appendChild(iconBtn('✕', 'del', () => { ch.replies.splice(i, 1); markDirty(); renderChat(); }));
      head.appendChild(acts);
      item.appendChild(head);
      item.appendChild(field('关键词（逗号分隔）', { v: (r.keywords || []).join(', ') }, 'v', {
        onInput: (val) => { r.keywords = val.split(/[,，]/).map((s) => s.trim()).filter(Boolean); },
      }));
      item.appendChild(field('回复内容', r, 'text', { textarea: true, rows: 2 }));
      c3.appendChild(item);
    });
    const addRule = document.createElement('button');
    addRule.className = 'add-btn';
    addRule.type = 'button';
    addRule.textContent = '+ 添加回复规则';
    addRule.addEventListener('click', () => { ch.replies.push({ keywords: [], text: '' }); markDirty(); renderChat(); });
    c3.appendChild(addRule);
    sec.appendChild(c3);
  }

  // ---------- 账号安全 ----------
  function renderAccount() {
    const sec = $('#secAccount');
    sec.innerHTML = '';
    const c = card('修改登录密码');
    const cur = field('当前密码', {}, 'current', { type: 'password' });
    const n1 = field('新密码（至少 6 位）', {}, 'next', { type: 'password' });
    const n2 = field('确认新密码', {}, 'confirm', { type: 'password' });
    c.appendChild(cur);
    c.appendChild(n1);
    c.appendChild(n2);
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.textContent = '更新密码';
    btn.addEventListener('click', async () => {
      const current = $('input', cur).value;
      const next = $('input', n1).value;
      const confirmVal = $('input', n2).value;
      if (next !== confirmVal) return toast('两次输入的新密码不一致', 'bad');
      try {
        const res = await fetch('/api/password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ current, next }),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || '修改失败');
        toast('密码已更新', 'ok');
        $('input', cur).value = '';
        $('input', n1).value = '';
        $('input', n2).value = '';
      } catch (e) {
        toast(e.message, 'bad');
      }
    });
    c.appendChild(btn);
    sec.appendChild(c);
  }

  function moveItem(arr, i, dir, rerender) {
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
    markDirty();
    rerender();
  }

  function renderAll() {
    renderBrand();
    renderHero();
    renderAdv();
    renderProducts();
    renderContact();
    renderChat();
    renderAccount();
  }

  // ---------- 导航切换 ----------
  function switchSection(sec) {
    $$('.menu-item').forEach((m) => m.classList.toggle('active', m.dataset.sec === sec));
    $$('.section').forEach((s) => s.classList.toggle('active', s.dataset.sec === sec));
    $('#secTitle').textContent = SEC_TITLES[sec] || '';
  }

  // ---------- 保存 ----------
  async function save() {
    const btn = $('#saveBtn');
    btn.textContent = '保存中...';
    btn.disabled = true;
    try {
      const res = await fetch('/api/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.status === 401) { showLogin(); throw new Error('登录已过期，请重新登录'); }
      if (!res.ok) throw new Error('保存失败');
      markClean();
      toast('已保存全部修改', 'ok');
    } catch (e) {
      toast(e.message, 'bad');
    }
    btn.textContent = '保存全部修改';
    btn.disabled = false;
  }

  // ---------- 登录 / 会话 ----------
  function showLogin() {
    $('#loginView').classList.remove('hidden');
    $('#appView').classList.add('hidden');
  }
  function showApp() {
    $('#loginView').classList.add('hidden');
    $('#appView').classList.remove('hidden');
  }

  async function loadContent() {
    const res = await fetch('/api/content');
    data = await res.json();
    if (!data || typeof data !== 'object') data = {};
    renderAll();
    switchSection('brand');
    markClean();
  }

  function bindGlobal() {
    $$('.menu-item').forEach((m) => m.addEventListener('click', () => switchSection(m.dataset.sec)));
    $('#saveBtn').addEventListener('click', save);
    $('#logoutBtn').addEventListener('click', async () => {
      await fetch('/api/logout', { method: 'POST' });
      showLogin();
    });
    $('#loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      $('#loginErr').textContent = '';
      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: $('#loginUser').value, password: $('#loginPass').value }),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || '登录失败');
        showApp();
        await loadContent();
      } catch (err) {
        $('#loginErr').textContent = err.message;
      }
    });
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (!$('#appView').classList.contains('hidden')) save();
      }
    });
    window.addEventListener('beforeunload', (e) => {
      if (dirty) { e.preventDefault(); e.returnValue = ''; }
    });
  }

  async function boot() {
    bindGlobal();
    try {
      const res = await fetch('/api/session');
      const j = await res.json();
      if (j.authed) {
        showApp();
        await loadContent();
      } else {
        showLogin();
      }
    } catch (e) {
      showLogin();
    }
  }

  boot();
})();
