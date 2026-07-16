/*! 紧急热修复：旧版 common.js 下「获取实时报价 / 下载参数表」无效
 * 用法（二选一）：
 * 1) 宝塔更新脚本部署最新代码（推荐）
 * 2) 后台「翻译与备份」→ 统计代码 headHtml 粘贴：
 *    <script src="/hotfix-cta.js?v=1"></script>
 *    然后保存。若服务器还没有此文件，把下方整段 <script>...</script> 直接贴进 headHtml。
 */
(function () {
  function openWin() {
    var win = document.getElementById('chatWindow');
    var fab = document.getElementById('chatFab');
    if (!win || !fab) return false;
    win.classList.add('open');
    fab.textContent = '🛑';
    fab.style.background = '#E60012';
    setTimeout(function () {
      var i = document.getElementById('cInp');
      if (i) i.focus();
    }, 120);
    return true;
  }

  function downloadSpecs() {
    var title = (document.querySelector('.product-title') || {}).textContent || 'product';
    var rows = Array.prototype.map.call(document.querySelectorAll('.spec-table tr'), function (tr) {
      var tds = tr.querySelectorAll('td');
      return tds.length >= 2 ? (tds[0].textContent + ': ' + tds[1].textContent) : '';
    }).filter(Boolean);
    var sub = (document.querySelector('.product-subtitle') || {}).textContent || '';
    var text = title + '\n' + sub + '\n\n' + rows.join('\n') + '\n\n' + location.href;
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\ufeff' + text], { type: 'text/plain;charset=utf-8' }));
    a.download = 'specs.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // 捕获阶段拦截：阻止旧版「点外部关闭」在同一点击里把客服关掉
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest && e.target.closest(
      '.cta-primary, .nav-btn, a[onclick*="openChat"], button[onclick*="openChat"], [data-open-chat]'
    );
    if (!t) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    openWin();
  }, true);

  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest && e.target.closest('.cta-secondary');
    if (!t) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    downloadSpecs();
  }, true);

  window.openChat = function (e) {
    if (e && e.preventDefault) e.preventDefault();
    if (e && e.stopPropagation) e.stopPropagation();
    openWin();
  };
})();
