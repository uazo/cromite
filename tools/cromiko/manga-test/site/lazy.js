// Mock site lazy loader: swaps data-src into src near the viewport.
window.lazyLoaded = 0;
const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (e.isIntersecting && e.target.dataset.src) {
      e.target.src = e.target.dataset.src;
      delete e.target.dataset.src;
      e.target.classList.add('lazyloaded');
      window.lazyLoaded++;
      io.unobserve(e.target);
    }
  }
}, {rootMargin: '300px'});
function observeAll() { document.querySelectorAll('img.lazy[data-src]').forEach(i => io.observe(i)); }
observeAll();
// Chapter 3 gets its image list asynchronously, like many sites.
const rc = document.querySelector('.reading-content');
if (rc && rc.dataset.async === '1') {
  fetch('/list.json', {headers: {'X-Ch': rc.dataset.ch}}).then(r => r.json()).then(list => {
    setTimeout(() => {
      for (const src of list) {
        const d = document.createElement('div'); d.className = 'page-break';
        const img = document.createElement('img'); img.className = 'wp-manga-chapter-img lazy';
        img.dataset.src = src; d.appendChild(img);
        const p = document.createElement('div'); p.className = 'protect'; d.appendChild(p);
        rc.appendChild(d);
      }
      observeAll();
    }, 800);
  });
}
// Some sites go to the next page when the image is tapped.
document.addEventListener('click', (e) => {
  if (e.target.closest('.page-break')) { window.imageClicks = (window.imageClicks || 0) + 1; }
});
