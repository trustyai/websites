/* V槽 CMS 联系页渲染（多语言） */
(function () {
  const C = window.VGCommon;
  const esc = C.esc;

  C.boot(function () {
    const L = window.VG.L;
    C.initChrome(false);
    const c = L.contact || {};
    const home = C.homeHref(window.VG.lang);
    const homeLabel = (L.ui && L.ui.breadcrumbHome) || '首页';

    const methods = (c.methods || []).map((m) =>
      '<div class="contact-method-card"><div class="cm-ico">' + esc(m.icon) + '</div><div class="cm-label">' + esc(m.label) + '</div><div class="cm-value">' + esc(m.value) + '</div></div>'
    ).join('');

    const distributors = (c.distributors || []).map((d) =>
      '<div class="dist-card"><div class="dist-head"><span class="dist-flag">' + esc(d.flag) + '</span><div><div class="dist-name">' + esc(d.name) + '</div><div class="dist-region">' + esc(d.region) + '</div></div></div>' +
      '<div class="dist-desc">' + esc(d.desc) + '</div><div class="dist-contact">' + esc(d.contact) + '</div></div>'
    ).join('');

    const fields = (c.formFields || []);
    const formInputs =
      '<div class="form-grid2">' +
      '<input id="leadName" type="text" placeholder="' + esc(fields[0] || '') + '">' +
      '<input id="leadEmail" type="email" placeholder="' + esc(fields[1] || '') + '">' +
      '</div>' +
      (fields[2] ? '<input id="leadCompany" type="text" placeholder="' + esc(fields[2]) + '">' : '') +
      (fields[3] ? '<textarea id="leadMessage" rows="5" placeholder="' + esc(fields[3]) + '"></textarea>' : '') +
      '<input type="text" id="leadWebsite" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">' +
      '<div id="leadMsg" style="min-height:1.2rem;font-size:0.9rem;margin:0.2rem 0 0.6rem"></div>';

    document.getElementById('contactPage').innerHTML =
      '<div class="breadcrumb"><a href="' + home + '">' + esc(homeLabel) + '</a> › <span>' + esc(c.title || '') + '</span></div>' +
      '<div class="need-header" style="margin-bottom:3rem"><div class="tag">' + esc(c.tag || '') + '</div><h2>' + esc(c.title || '') + '</h2><p style="color:var(--gray-500);max-width:600px;margin:0 auto">' + esc(c.subtitle || '') + '</p></div>' +
      (methods ? '<div class="contact-methods-grid">' + methods + '</div>' : '') +
      (distributors ? '<div class="dist-section"><div class="spec-title" style="font-size:1.2rem;margin-bottom:1.5rem">' + esc(c.distributorsTitle || '') + '</div><div class="dist-grid">' + distributors + '</div></div>' : '') +
      (c.agent && c.agent.title ? '<div class="agent-box"><div style="font-size:1.5rem;margin-bottom:0.5rem">🤝</div><h3>' + esc(c.agent.title) + '</h3><p>' + esc(c.agent.desc || '') + '</p><div class="agent-btns"><button class="cta-primary" onclick="openChat()">' + esc(c.agent.primaryBtn || '') + '</button><button class="cta-secondary" onclick="location.href=\'' + home + '\'">' + esc(c.agent.secondaryBtn || '') + '</button></div></div>' : '') +
      '<div class="inquiry-form"><div class="spec-title" style="font-size:1.2rem;margin-bottom:1.5rem">' + esc(c.formTitle || '') + '</div>' + formInputs +
      '<button class="cta-primary" id="leadSubmit" style="max-width:320px;width:100%">' + esc(c.submitText || '') + '</button></div>';

    const btn = document.getElementById('leadSubmit');
    if (btn) btn.addEventListener('click', submitLead);
  });

  async function submitLead() {
    const val = (id) => { const e = document.getElementById(id); return e ? e.value.trim() : ''; };
    const msg = document.getElementById('leadMsg');
    const name = val('leadName'), email = val('leadEmail');
    if (!name && !email) { if (msg) { msg.style.color = '#E60012'; msg.textContent = '请至少填写姓名或邮箱'; } return; }
    const btn = document.getElementById('leadSubmit');
    if (btn) { btn.disabled = true; }
    try {
      const res = await fetch('/api/leads', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, company: val('leadCompany'), message: val('leadMessage'), website: val('leadWebsite'), lang: window.VG.lang, page: location.pathname }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || '提交失败');
      if (msg) { msg.style.color = 'var(--primary)'; msg.textContent = '✅ 已收到您的询价，我们会尽快联系您！'; }
      ['leadName', 'leadEmail', 'leadCompany', 'leadMessage'].forEach((id) => { const e = document.getElementById(id); if (e) e.value = ''; });
    } catch (e) {
      if (msg) { msg.style.color = '#E60012'; msg.textContent = e.message; }
    }
    if (btn) btn.disabled = false;
  }
})();
