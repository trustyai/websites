/* V槽 CMS 首页渲染（多语言） */
(function () {
  const C = window.VGCommon;
  const esc = C.esc;

  function renderHero(h) {
    h = h || {};
    const stats = (h.stats || []).map((s) => '<div class="hstat"><div class="hstat-num">' + esc(s.num) + '</div><div class="hstat-label">' + esc(s.label) + '</div></div>').join('');
    document.getElementById('heroContent').innerHTML =
      '<div class="hero-eyebrow">' + esc(h.eyebrow || '') + '</div>' +
      '<h1>' + C.markup(h.title) + '</h1>' +
      '<p class="hero-sub">' + esc(h.subtitle || '') + '</p>' +
      '<a href="#need-section" class="hero-cta">' + esc(h.cta || '') + ' <span class="arrow">→</span></a>' +
      (stats ? '<div class="hero-stat-strip">' + stats + '</div>' : '');
  }

  function renderWizard(w) {
    w = w || {};
    const mat = (w.materials || []).map((m) => '<div class="mat-card" data-material="' + esc(m.key) + '"><div class="mat-icon">' + esc(m.icon) + '</div><div class="mat-name">' + esc(m.name) + '</div><div class="mat-desc">' + esc(m.desc) + '</div></div>').join('');
    const thick = (w.thickness || []).map((t) => '<div class="thick-card" data-thickness="' + esc(t.key) + '"><div class="thick-ico">' + esc(t.icon) + '</div><div class="thick-info"><h4>' + esc(t.title) + '</h4><p>' + esc(t.desc) + '</p></div></div>').join('');
    const scale = (w.scale || []).map((s) => '<div class="scale-card" data-scale="' + esc(s.key) + '"><div class="scale-ico">' + esc(s.icon) + '</div><div class="scale-info"><h4>' + esc(s.title) + '</h4><p>' + esc(s.desc) + '</p></div></div>').join('');
    const feat = (w.features || []).map((f) => '<div class="feat-card" data-feature="' + esc(f.key) + '"><div class="feat-dot"></div><span>' + esc(f.label) + '</span></div>').join('');
    document.getElementById('needSection').innerHTML =
      '<div class="need-header"><div class="tag">' + esc(w.tag || '') + '</div><h2>' + C.markup(w.title) + '</h2><p>' + esc(w.subtitle || '') + '</p></div>' +
      '<div class="step-label"><div class="num">1</div><div>' + esc(w.step1 || '') + '</div></div><div class="material-grid">' + mat + '</div>' +
      '<div class="step-label"><div class="num">2</div><div>' + esc(w.step2 || '') + '</div></div><div class="thickness-row">' + thick + '</div>' +
      '<div class="step-label"><div class="num">3</div><div>' + esc(w.step3 || '') + '</div></div><div class="scale-row">' + scale + '</div>' +
      '<div class="step-label"><div class="num">4</div><div>' + esc(w.step4 || '') + '</div></div><div class="feature-grid">' + feat + '</div>' +
      '<div class="result-box" id="resultBox"><div class="result-title">' + esc(w.resultTitle || '') + '</div><div class="result-products" id="resultProducts"></div><div class="result-note" id="resultNote"></div></div>';
    bindWizard();
  }

  function renderProducts(ps, items) {
    ps = ps || {};
    document.getElementById('prodHeader').innerHTML =
      '<div class="tag">' + esc(ps.tag || '') + '</div><h2>' + C.markup(ps.title) + '</h2><p>' + esc(ps.subtitle || '') + '</p>';
    document.getElementById('allProducts').innerHTML = (items || []).map((p) => C.productCard(p, false)).join('');
  }

  // ---------- 智能选型（后台可调：产品 match 标签 + wizard.locks 锁定推荐） ----------
  let sel = { material: null, thickness: null, scale: null, features: [] };
  function bindWizard() {
    const bind = (selector, key, single) => {
      document.querySelectorAll(selector).forEach((c) => c.addEventListener('click', () => {
        if (single) {
          document.querySelectorAll(selector).forEach((x) => x.classList.remove('selected'));
          c.classList.add('selected'); sel[key] = c.dataset[key];
        } else {
          c.classList.toggle('selected');
          const v = c.dataset.feature;
          if (c.classList.contains('selected')) sel.features.push(v); else sel.features = sel.features.filter((x) => x !== v);
        }
        updateRec();
      }));
    };
    bind('.mat-card', 'material', true);
    bind('.thick-card', 'thickness', true);
    bind('.scale-card', 'scale', true);
    bind('.feat-card', 'features', false);
  }
  function tagHit(tags, prefix, key) {
    if (!key) return false;
    return tags.indexOf(prefix + key) > -1 || tags.indexOf(key) > -1;
  }
  function scoreProduct(p) {
    const tags = p.match || [];
    let score = 0;
    if (sel.material && tagHit(tags, 'm:', sel.material)) score += 4;
    if (sel.thickness && tagHit(tags, 't:', sel.thickness)) score += 5;
    if (sel.scale && tagHit(tags, 's:', sel.scale)) score += 3;
    (sel.features || []).forEach((f) => { if (tagHit(tags, 'f:', f)) score += 1; });
    return score;
  }
  function lockMatches(lock) {
    if (!lock || !(lock.productSlugs || []).length) return false;
    if (lock.material && lock.material !== sel.material) return false;
    if (lock.thickness && lock.thickness !== sel.thickness) return false;
    if (lock.scale && lock.scale !== sel.scale) return false;
    const need = lock.features || [];
    if (need.length && !need.every((f) => (sel.features || []).indexOf(f) > -1)) return false;
    // 至少命中一个已填条件，避免空规则锁死全部
    return !!(lock.material || lock.thickness || lock.scale || need.length);
  }
  function updateRec() {
    const box = document.getElementById('resultBox');
    const wrap = document.getElementById('resultProducts');
    const note = document.getElementById('resultNote');
    if (!sel.material || !sel.thickness) { box.classList.remove('visible'); return; }
    box.classList.add('visible');
    const products = ((window.VG.L.products) || []).filter((p) => !p.deleted);
    const bySlug = {};
    products.forEach((p) => { bySlug[p.slug || p.id] = p; });

    // 1) 后台「锁定推荐」优先（智能选型 → 推荐锁定）
    const locks = (((window.VG.L.wizard) || {}).locks) || [];
    const hitLocks = locks.filter(lockMatches);
    let recs = [];
    let noteText = '';
    if (hitLocks.length) {
      const slugs = [];
      hitLocks.forEach((lk) => (lk.productSlugs || []).forEach((s) => { if (slugs.indexOf(s) < 0) slugs.push(s); }));
      recs = slugs.map((s) => bySlug[s]).filter(Boolean);
      noteText = hitLocks.map((lk) => lk.note || lk.title).filter(Boolean).join(' · ');
    }

    // 2) 否则按产品 match 标签打分（材料/厚度/规模/功能）
    if (!recs.length) {
      recs = products
        .map((p) => ({ p, score: scoreProduct(p) }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((x) => x.p);
    }
    if (!recs.length) recs = products.slice(0, 3);
    recs = [...new Map(recs.map((p) => [p.id || p.slug, p])).values()].slice(0, 4);
    wrap.innerHTML = recs.map((p, i) => C.productCard(p, i === 0)).join('');
    if (note) note.textContent = noteText || '';
  }

  C.boot(function () {
    const L = window.VG.L;
    C.initChrome(true);
    renderHero(L.hero);
    renderWizard(L.wizard);
    renderProducts(L.productsSection, L.products);
  });
})();
