// Wildgewachsen – Website JS

// ===== Mobile Navigation =====
function toggleMobileNav() {
  const nav = document.getElementById('mobile-nav');
  const burger = document.querySelector('.header__burger');
  nav.classList.toggle('open');
  burger.classList.toggle('active');
}

// ===== Header Scroll Effect =====
function initHeaderScroll() {
  const header = document.querySelector('.header');
  if (!header) return;

  let lastScroll = 0;
  const threshold = 40;

  window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;

    if (currentScroll > threshold) {
      header.classList.add('header--scrolled');
    } else {
      header.classList.remove('header--scrolled');
    }

    lastScroll = currentScroll;
  }, { passive: true });
}

// ===== Scroll-Triggered Animations =====
function initScrollAnimations() {
  const observerOptions = {
    root: null,
    rootMargin: '0px 0px -60px 0px',
    threshold: 0.1
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  // Observe all animate-on-scroll elements
  document.querySelectorAll('.animate-on-scroll').forEach(el => {
    observer.observe(el);
  });

  // Observe all stagger-children containers
  document.querySelectorAll('.stagger-children').forEach(el => {
    observer.observe(el);
  });
}

// ===== Init on DOM Ready =====
document.addEventListener('DOMContentLoaded', () => {
  // Close mobile nav on link click
  const mobileLinks = document.querySelectorAll('.header__mobile-nav a');
  mobileLinks.forEach(link => {
    link.addEventListener('click', () => {
      document.getElementById('mobile-nav').classList.remove('open');
      document.querySelector('.header__burger').classList.remove('active');
    });
  });

  // Header scroll effect
  initHeaderScroll();

  // Scroll animations
  initScrollAnimations();

  // Countdown
  updateCountdown();

  // Blog filters
  initBlogFilters();
});

// ===== Countdown =====
function updateCountdown() {
  const departure = new Date('2026-06-23');
  const now = new Date();
  const diff = departure - now;

  if (diff <= 0) return;

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const months = Math.floor(days / 30);
  const weeks = Math.floor(days / 7);

  // Update countdown elements if they exist
  const daysEl = document.getElementById('countdown-days');
  const weeksEl = document.getElementById('countdown-weeks');
  const monthsEl = document.getElementById('countdown-months');

  if (daysEl) daysEl.textContent = days;
  if (weeksEl) weeksEl.textContent = weeks;
  if (monthsEl) monthsEl.textContent = months;
}

// ===== Newsletter (Buttondown) =====
async function handleNewsletter(e) {
  e.preventDefault();
  const form = e.target;
  const input = form.querySelector('input[type="email"]');
  const btn = form.querySelector('button[type="submit"]');
  const email = input.value;
  const origText = btn.textContent;

  btn.textContent = '...';
  btn.disabled = true;

  try {
    const res = await fetch('https://buttondown.com/api/emails/embed-subscribe/wildgewachsen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'email=' + encodeURIComponent(email)
    });

    if (res.ok || res.status === 201) {
      form.innerHTML = '<p style="color:inherit;font-size:0.95rem;">Danke! Bitte bestätige deine E-Mail.</p>';
    } else {
      btn.textContent = origText;
      btn.disabled = false;
      alert('Etwas ist schiefgelaufen. Bitte versuche es erneut.');
    }
  } catch (err) {
    btn.textContent = origText;
    btn.disabled = false;
    alert('Verbindungsfehler. Bitte versuche es erneut.');
  }
  return false;
}

// ===== Blog Filters =====
function initBlogFilters() {
  const filters = document.querySelectorAll('.blog-filter');
  if (!filters.length) return;

  // Check URL params
  const params = new URLSearchParams(window.location.search);
  const activeFilter = params.get('filter') || 'alle';

  filters.forEach(btn => {
    const filter = btn.dataset.filter;
    if (filter === activeFilter) btn.classList.add('active');

    btn.addEventListener('click', () => {
      // Update active state
      filters.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Filter articles
      const articles = document.querySelectorAll('.article-card[data-category]');
      articles.forEach(card => {
        if (filter === 'alle' || card.dataset.category === filter) {
          card.style.display = '';
        } else {
          card.style.display = 'none';
        }
      });

      // Update URL without reload
      if (filter === 'alle') {
        history.replaceState(null, '', '/blog.html');
      } else {
        history.replaceState(null, '', `/blog.html?filter=${filter}`);
      }
    });
  });
}

// ===== Smooth scroll for anchor links =====
document.addEventListener('click', (e) => {
  const link = e.target.closest('a[href^="#"]');
  if (!link) return;

  const target = document.querySelector(link.getAttribute('href'));
  if (target) {
    e.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
});
