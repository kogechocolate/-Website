/* 公開サイトの動き（外部ライブラリなし）：タブの切り替え、スクロールの影、出現アニメーション */
(() => {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  document.documentElement.classList.add('js');
  const reveal = $$('.reveal');
  try {
    const header = $('header');
    const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 8);
    onScroll(); addEventListener('scroll', onScroll, { passive: true });

    // タブ（キーボード操作に対応：← → Home End）
    const tabs = $$('[role=tab]'), panels = $$('[role=tabpanel]');
    if (tabs.length) {
      let cur = Math.max(0, tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true'));
      const stop = (panel) => $$('iframe', panel).forEach((f) => f.setAttribute('src', f.getAttribute('src'))); // 切り替えたら再生を止める
      const select = (i, { focus = false, hash = true } = {}) => {
        const old = cur; cur = i;
        tabs.forEach((t, n) => { t.setAttribute('aria-selected', String(n === i)); t.tabIndex = n === i ? 0 : -1; });
        panels.forEach((p, n) => { p.hidden = n !== i; });
        if (old !== i) stop(panels[old]);
        if (focus) tabs[i].focus();
        if (hash) history.replaceState(null, '', '#' + tabs[i].dataset.id);
      };
      tabs.forEach((t, n) => t.addEventListener('click', () => select(n)));
      $('[role=tablist]').addEventListener('keydown', (e) => {
        let i = tabs.indexOf(document.activeElement);
        if (i < 0) return;
        if (e.key === 'ArrowRight') i = (i + 1) % tabs.length;
        else if (e.key === 'ArrowLeft') i = (i - 1 + tabs.length) % tabs.length;
        else if (e.key === 'Home') i = 0;
        else if (e.key === 'End') i = tabs.length - 1;
        else return;
        e.preventDefault(); select(i, { focus: true });
      });
      const fromHash = () => {
        const n = tabs.findIndex((t) => t.dataset.id === location.hash.slice(1));
        if (n >= 0) select(n, { hash: false });
      };
      addEventListener('hashchange', fromHash);
      fromHash();
    }

    // スクロールで、ふわっと現れる
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      }), { threshold: 0.05 });
      reveal.forEach((el) => io.observe(el));
    } else reveal.forEach((el) => el.classList.add('in'));
  } catch (err) {
    reveal.forEach((el) => el.classList.add('in'));
    console.error(err);
  }
})();
