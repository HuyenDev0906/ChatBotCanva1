'use strict';
(() => {
  const presentation = window.PRESENTATION;
  const $ = id => document.getElementById(id);
  const slideImage = $('slideImage');
  const thumbs = $('thumbnails');
  const chapterList = $('chapterList');
  let current = 1;
  let history = [];
  let sending = false;

  function goToSlide(n, updateHash = true) {
    current = Math.max(1, Math.min(presentation.count, Number(n) || 1));
    slideImage.src = presentation.asset(current);
    slideImage.alt = `Trang ${current} trong ${presentation.count} trang`;
    $('slideCounter').textContent = `${current} / ${presentation.count}`;
    $('prevButton').disabled = current === 1;
    $('nextButton').disabled = current === presentation.count;
    $('slidePrevHotspot').hidden = current === 1;
    $('slideNextHotspot').hidden = current === presentation.count;
    thumbs.querySelectorAll('button').forEach(b => {
      const selected = Number(b.dataset.slide) === current;
      b.classList.toggle('active', selected);
      b.setAttribute('aria-current', selected ? 'page' : 'false');
    });
    chapterList.querySelectorAll('button').forEach(b => b.classList.toggle('active', Number(b.dataset.slide) <= current && (!b.nextElementSibling || Number(b.nextElementSibling.dataset.slide) > current)));
    if (updateHash) historyReplace(`#slide-${current}`);
    // Preload adjacent slide to make navigation feel immediate.
    [current - 1, current + 1].filter(n => n >= 1 && n <= presentation.count).forEach(n => { const img = new Image(); img.src = presentation.asset(n); });
  }
  function historyReplace(hash) { window.history.replaceState(null, '', hash); }
  for (let n = 1; n <= presentation.count; n++) {
    const button = document.createElement('button');
    button.type = 'button'; button.dataset.slide = String(n); button.title = `Trang ${n}`;
    const img = document.createElement('img'); img.src = presentation.asset(n); img.alt = ''; img.loading = 'lazy';
    const caption = document.createElement('span'); caption.textContent = String(n);
    button.append(img, caption); button.addEventListener('click', () => goToSlide(n)); thumbs.append(button);
  }
  presentation.chapters.forEach(c => {
    const button = document.createElement('button'); button.type = 'button'; button.dataset.slide = String(c.start); button.textContent = c.title;
    button.addEventListener('click', () => { goToSlide(c.start); $('chapters').classList.remove('expanded'); $('menuButton').setAttribute('aria-expanded','false'); });
    chapterList.append(button);
  });
  $('prevButton').addEventListener('click', () => goToSlide(current - 1));
  $('nextButton').addEventListener('click', () => goToSlide(current + 1));
  $('slidePrevHotspot').addEventListener('click', () => goToSlide(current - 1));
  $('slideNextHotspot').addEventListener('click', () => goToSlide(current + 1));
  $('menuButton').addEventListener('click', () => { const expanded = $('chapters').classList.toggle('expanded'); $('menuButton').setAttribute('aria-expanded', String(expanded)); });
  $('fullScreenButton').addEventListener('click', () => { const frame = $('slideFrame'); if (document.fullscreenElement) document.exitFullscreen(); else frame.requestFullscreen?.(); });
  document.addEventListener('keydown', e => {
    if (['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) return;
    if (e.key === 'ArrowLeft') goToSlide(current - 1);
    if (e.key === 'ArrowRight') goToSlide(current + 1);
  });
  window.addEventListener('hashchange', () => { const match = location.hash.match(/^#slide-(\d+)$/); if (match) goToSlide(Number(match[1]), false); });
  const initial = location.hash.match(/^#slide-(\d+)$/); goToSlide(initial ? Number(initial[1]) : 1, false);
})();
