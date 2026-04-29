'use strict';

/* ── NAVBAR scroll + burger ── */
const navbar    = document.getElementById('navbar');
const navBurger = document.getElementById('navBurger');
const navLinks  = document.getElementById('navLinks');
const backToTop = document.getElementById('backToTop');

window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 20);
  backToTop.classList.toggle('visible', window.scrollY > 400);
}, { passive: true });

navBurger.addEventListener('click', () => {
  const open = navLinks.classList.toggle('open');
  navBurger.setAttribute('aria-expanded', open);
});
navLinks.querySelectorAll('a').forEach(link =>
  link.addEventListener('click', () => navLinks.classList.remove('open'))
);

/* ── RETOUR EN HAUT ── */
backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

/* ── THÈME CLAIR / SOMBRE ── */
const themeToggle = document.getElementById('themeToggle');
const html        = document.documentElement;

if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
  html.setAttribute('data-theme', 'dark');
  themeToggle.textContent = '☀️';
}
const savedTheme = localStorage.getItem('ecolo-theme');
if (savedTheme) {
  html.setAttribute('data-theme', savedTheme);
  themeToggle.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
}
themeToggle.addEventListener('click', () => {
  const isDark   = html.getAttribute('data-theme') === 'dark';
  const newTheme = isDark ? 'light' : 'dark';
  html.setAttribute('data-theme', newTheme);
  themeToggle.textContent = newTheme === 'dark' ? '☀️' : '🌙';
  localStorage.setItem('ecolo-theme', newTheme);
});

/* ── ANIMATIONS FADE-UP ── */
const fadeObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.style.animationPlayState = 'running';
      fadeObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.fade-up').forEach((el) => {
  el.style.animationPlayState = 'paused';
  fadeObserver.observe(el);
});
