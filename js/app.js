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

// ===== Language Switcher =====
// Builds a DE|EN toggle from the page's hreflang alternate links and injects it
// into the desktop nav (before the CTA) and the mobile nav. Pages without an
// hreflang alternate for the other language (e.g. the German-only Impressum)
// simply get no switcher. See docs/superpowers/specs/2026-06-12-language-switcher-design.md
function initLangSwitch() {
  const curLang = (document.documentElement.getAttribute('lang') || 'de')
    .toLowerCase().startsWith('en') ? 'en' : 'de';
  const otherLang = curLang === 'de' ? 'en' : 'de';

  const alt = document.querySelector('link[rel="alternate"][hreflang="' + otherLang + '"]');
  const otherHref = alt && alt.getAttribute('href');
  if (!otherHref) return; // orphan page: no counterpart, no switcher

  function build() {
    const wrap = document.createElement('span');
    wrap.className = 'header__lang';

    const current = document.createElement('span');
    current.className = 'header__lang-current';
    current.textContent = curLang.toUpperCase();

    const sep = document.createElement('span');
    sep.className = 'header__lang-sep';
    sep.textContent = '|';

    const link = document.createElement('a');
    link.href = otherHref;
    link.setAttribute('hreflang', otherLang);
    link.setAttribute('lang', otherLang);
    link.textContent = otherLang.toUpperCase();

    wrap.append(current, sep, link);
    return wrap;
  }

  const desktopNav = document.querySelector('.header__nav');
  if (desktopNav) {
    const cta = desktopNav.querySelector('.header__cta');
    if (cta) desktopNav.insertBefore(build(), cta);
    else desktopNav.appendChild(build());
  }

  const mobileNav = document.querySelector('.header__mobile-nav');
  if (mobileNav) mobileNav.appendChild(build());
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
  // Language switcher (built from hreflang alternates)
  initLangSwitch();

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

// ===== Newsletter (Buttondown, sprach-aware mit Tag) =====
async function handleNewsletter(e) {
  e.preventDefault();
  const form = e.target;
  const input = form.querySelector('input[type="email"]');
  const btn = form.querySelector('button[type="submit"]');
  const email = input.value;
  const origText = btn.textContent;
  const lang = (document.documentElement.lang || 'de').toLowerCase().startsWith('en') ? 'en' : 'de';

  const messages = {
    de: {
      success: 'Danke! Bitte bestätige deine E-Mail.',
      error: 'Etwas ist schiefgelaufen. Bitte versuche es erneut.',
      network: 'Verbindungsfehler. Bitte versuche es erneut.'
    },
    en: {
      success: 'Thanks! Please confirm your email.',
      error: 'Something went wrong. Please try again.',
      network: 'Connection error. Please try again.'
    }
  };

  btn.textContent = '...';
  btn.disabled = true;

  try {
    const res = await fetch('https://buttondown.com/api/emails/embed-subscribe/wildgewachsen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'email=' + encodeURIComponent(email) + '&tag=' + lang
    });

    if (res.ok || res.status === 201) {
      form.innerHTML = '<p style="color:inherit;font-size:0.95rem;">' + messages[lang].success + '</p>';
    } else {
      btn.textContent = origText;
      btn.disabled = false;
      alert(messages[lang].error);
    }
  } catch (err) {
    btn.textContent = origText;
    btn.disabled = false;
    alert(messages[lang].network);
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

      // Update URL without reload (sprach-aware, clean URL)
      const basePath = window.location.pathname.startsWith('/en/') ? '/en/blog' : '/blog';
      if (filter === 'alle') {
        history.replaceState(null, '', basePath);
      } else {
        history.replaceState(null, '', `${basePath}?filter=${filter}`);
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
