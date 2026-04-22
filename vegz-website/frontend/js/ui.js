// ═══════════════════════════════════════════════
//  VEGZ — UI Module
//  Navbar, animations, scroll, mobile nav
// ═══════════════════════════════════════════════

// ── Navbar scroll ────────────────────────────
window.addEventListener('scroll', () => {
  const h = document.getElementById('header');
  if (h) h.classList.toggle('scrolled', window.scrollY > 10);
});

// ── Mobile nav toggle ────────────────────────
function toggleNav() {
  document.getElementById('mobile-nav')?.classList.toggle('open');
}

// ── Scroll animations (IntersectionObserver) ─
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); }
  });
}, { threshold: 0.1 });

document.querySelectorAll('[data-animate]').forEach(el => observer.observe(el));

// ── Smooth scroll anchors ────────────────────
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior:'smooth', block:'start' });
      document.getElementById('mobile-nav')?.classList.remove('open');
    }
  });
});
