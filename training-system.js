/* ============================================================
   TRAINING SYSTEM  --  shared behavior for ct-resource-page trainings
   Pairs with /training-system.css. Drop into a training page head with:
     <script src="/training-system.js"></script>
   after /auth-gate.js. Wires the slide deck described in
   TRAINING-AUTHORING-STANDARD.md:
     - measures the real sticky header into --header-h (load/resize/font/mode)
     - TOC scroll-spy
     - Presenter Mode toggle (#presentBtn -> body.presenter)
     - deck prev/next (#prevBtn/#nextBtn), arrow + PageUp/Down keys
   Defines window.initApp (auth-gate calls it once the gate opens): resets scroll
   so the deck starts on slide 1. A page needing extra init can override initApp
   after this script loads and call window.TrainingSystem.refresh().
   Every hook is optional: a page missing a TOC, toggle, or deck nav just skips it.
   ============================================================ */
(function () {
  // Stop the browser from restoring scroll when the auth gate reveals content late.
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  const headerEl = document.querySelector('.site-header');
  function setHeaderH() {
    if (headerEl) document.documentElement.style.setProperty('--header-h', headerEl.offsetHeight + 'px');
  }
  addEventListener('load', setHeaderH);
  addEventListener('resize', setHeaderH);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(setHeaderH);

  // TOC scroll-spy
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.toc-nav a');
  function spy() {
    let cur = '';
    const y = scrollY + 200;
    sections.forEach(s => { if (y >= s.offsetTop && y < s.offsetTop + s.offsetHeight) cur = s.id; });
    navLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + cur));
  }
  addEventListener('scroll', spy);
  addEventListener('load', spy);

  // Presenter Mode toggle
  const pBtn = document.getElementById('presentBtn');
  if (pBtn) pBtn.addEventListener('click', () => {
    document.body.classList.toggle('presenter');
    pBtn.textContent = document.body.classList.contains('presenter') ? 'Exit Presenter' : 'Presenter Mode';
    setHeaderH();
  });

  // Deck navigation (prev / next slide)
  const slides = [...document.querySelectorAll('.hero,.module,.key-takeaways')];
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  function currentIndex() {
    const h = (headerEl ? headerEl.offsetHeight : 0) + 12;
    let idx = 0;
    slides.forEach((s, i) => { if (s.offsetTop <= scrollY + h) idx = i; });
    return idx;
  }
  function go(dir) {
    const i = Math.max(0, Math.min(slides.length - 1, currentIndex() + dir));
    if (slides[i]) slides[i].scrollIntoView({ behavior: 'smooth' });
  }
  function syncDeck() {
    if (!prevBtn || !nextBtn) return;
    const i = currentIndex();
    prevBtn.disabled = i <= 0;
    nextBtn.disabled = i >= slides.length - 1;
  }
  if (prevBtn && nextBtn) {
    prevBtn.onclick = () => go(-1);
    nextBtn.onclick = () => go(1);
    addEventListener('scroll', syncDeck);
    addEventListener('load', syncDeck);
  }
  addEventListener('keydown', e => {
    if (e.key === 'ArrowRight' || e.key === 'PageDown') go(1);
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(-1);
  });

  // Expose a refresh hook + a default initApp for the auth gate.
  window.TrainingSystem = { refresh() { setHeaderH(); syncDeck(); spy(); } };
  if (!window.initApp) {
    window.initApp = function () { setHeaderH(); window.scrollTo(0, 0); syncDeck(); };
  }
})();
