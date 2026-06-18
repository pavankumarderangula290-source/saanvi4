/**
 * SAANVI INTERNATIONAL SCHOOL — GALLERY JS
 * Handles: category filtering, fullscreen lightbox,
 * GSAP entrance animations, keyboard nav, touch swipe
 */

'use strict';

/* ═══════════════════════════════════════════════════════
   0. DATA — single source of truth for all images
════════════════════════════════════════════════════════ */
const GALLERY_DATA = [
  { src: 'images/campus1.jpg',      category: 'campus', label: 'Campus',   alt: 'Saanvi International School campus view 1' },
  { src: 'images/campus2.jpg',      category: 'campus', label: 'Campus',   alt: 'Saanvi International School campus view 2' },
  { src: 'images/campus3.jpg',      category: 'campus', label: 'Campus',   alt: 'Saanvi International School campus view 3' },
  { src: 'images/sports-day.jpg',   category: 'events', label: 'Events',   alt: 'Saanvi International School Sports Day'     },
  { src: 'images/annual-day.jpg',   category: 'events', label: 'Events',   alt: 'Saanvi International School Annual Day'     },
  { src: 'images/science-lab.jpg',  category: 'labs',   label: 'Labs',     alt: 'Saanvi International School Science Lab'   },
  { src: 'images/computer-lab.jpg', category: 'labs',   label: 'Labs',     alt: 'Saanvi International School Computer Lab'  },
];

/* ═══════════════════════════════════════════════════════
   1. GSAP ENTRANCE ANIMATIONS
════════════════════════════════════════════════════════ */
(function initGalleryAnimations() {
  if (typeof gsap === 'undefined') return;
  if (typeof ScrollTrigger !== 'undefined') gsap.registerPlugin(ScrollTrigger);

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) {
    gsap.set('.gsap-reveal, .gsap-card', { opacity: 1 });
    return;
  }

  /* Nav */
  gsap.fromTo('.site-header',
    { y: -30, opacity: 0 },
    { y: 0,   opacity: 1, duration: 0.7, ease: 'power3.out', delay: 0.05 }
  );

  /* Hero text stagger */
  const heroTL = gsap.timeline({ delay: 0.15 });
  heroTL
    .fromTo('.gallery-hero .section-eyebrow',
      { x: -20, opacity: 0 },
      { x: 0,   opacity: 1, duration: 0.5, ease: 'power3.out' }
    )
    .fromTo('.gallery-title',
      { y: 48, opacity: 0 },
      { y: 0,  opacity: 1, duration: 0.85, ease: 'power3.out' },
      '-=0.2'
    )
    .fromTo('.gallery-subtitle',
      { y: 20, opacity: 0 },
      { y: 0,  opacity: 1, duration: 0.6, ease: 'power3.out' },
      '-=0.35'
    );

  /* Filter tabs */
  gsap.fromTo('.filter-tabs',
    { y: 16, opacity: 0 },
    { y: 0,  opacity: 1, duration: 0.6, ease: 'power3.out', delay: 0.55 }
  );

  /* Gallery cards stagger */
  gsap.fromTo('.gallery-card',
    { y: 56, opacity: 0, scale: 0.96 },
    {
      y:        0,
      opacity:  1,
      scale:    1,
      duration: 0.7,
      ease:     'power3.out',
      stagger:  0.08,
      delay:    0.6,
    }
  );

})();

/* ═══════════════════════════════════════════════════════
   2. LAZY IMAGE LOADING with fade-in
════════════════════════════════════════════════════════ */
(function initImageFade() {
  const imgs = document.querySelectorAll('.gallery-card-img');
  imgs.forEach(img => {
    img.setAttribute('data-loaded', 'false');
    img.style.opacity = '0';
    img.style.transition = 'opacity 0.45s ease';

    if (img.complete && img.naturalWidth > 0) {
      img.style.opacity = '1';
      img.setAttribute('data-loaded', 'true');
    } else {
      img.addEventListener('load', () => {
        img.style.opacity = '1';
        img.setAttribute('data-loaded', 'true');
      });
      img.addEventListener('error', () => {
        // Graceful fallback: subtle hatched pattern
        img.style.opacity = '0.15';
        const wrap = img.closest('.gallery-card-img-wrap');
        if (wrap) {
          wrap.style.background =
            'repeating-linear-gradient(45deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 2px, transparent 2px, transparent 12px)';
        }
      });
    }
  });
})();

/* ═══════════════════════════════════════════════════════
   3. FILTER TABS
════════════════════════════════════════════════════════ */
(function initFilter() {
  const tabs      = document.querySelectorAll('.filter-tab');
  const cards     = document.querySelectorAll('.gallery-card');
  const emptyEl   = document.getElementById('gallery-empty');

  if (!tabs.length || !cards.length) return;

  let currentFilter = 'all';

  function applyFilter(filter) {
    currentFilter = filter;

    // Update tab active states + aria
    tabs.forEach(tab => {
      const isActive = tab.dataset.filter === filter;
      tab.classList.toggle('filter-tab--active', isActive);
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    // Show/hide cards with GSAP if available
    let visibleCount = 0;
    cards.forEach((card, i) => {
      const matches = filter === 'all' || card.dataset.category === filter;

      if (matches) {
        visibleCount++;
        card.classList.remove('is-hidden');

        if (typeof gsap !== 'undefined') {
          gsap.fromTo(card,
            { opacity: 0, y: 24, scale: 0.97 },
            {
              opacity:  1,
              y:        0,
              scale:    1,
              duration: 0.45,
              ease:     'power3.out',
              delay:    (visibleCount - 1) * 0.06,
            }
          );
        }
      } else {
        card.classList.add('is-hidden');
      }
    });

    // Empty state
    if (emptyEl) {
      emptyEl.hidden = visibleCount > 0;
    }
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      applyFilter(tab.dataset.filter);
    });
  });

})();

/* ═══════════════════════════════════════════════════════
   4. LIGHTBOX
════════════════════════════════════════════════════════ */
(function initLightbox() {
  const lightbox      = document.getElementById('lightbox');
  const lbImg         = document.getElementById('lightbox-img');
  const lbBg          = document.getElementById('lightbox-bg');
  const lbCategory    = document.getElementById('lightbox-category');
  const lbCounter     = document.getElementById('lightbox-counter');
  const lbClose       = document.getElementById('lightbox-close');
  const lbPrev        = document.getElementById('lightbox-prev');
  const lbNext        = document.getElementById('lightbox-next');
  const lbThumbs      = document.getElementById('lightbox-thumbs');
  const galleryCards  = document.querySelectorAll('.gallery-card');

  if (!lightbox || !galleryCards.length) return;

  /* Build the visible index list — respects active filter */
  function getVisibleIndices() {
    const indices = [];
    galleryCards.forEach((card, i) => {
      if (!card.classList.contains('is-hidden')) {
        indices.push(parseInt(card.dataset.index, 10));
      }
    });
    return indices;
  }

  let currentGlobalIndex = 0; // index into GALLERY_DATA
  let isOpen = false;

  /* ── Build thumbnail strip ── */
  function buildThumbs() {
    lbThumbs.innerHTML = '';
    GALLERY_DATA.forEach((item, i) => {
      const thumb = document.createElement('button');
      thumb.className = 'lightbox-thumb';
      thumb.setAttribute('role', 'listitem');
      thumb.setAttribute('aria-label', `View photo ${i + 1}: ${item.alt}`);
      thumb.dataset.index = i;

      const img = document.createElement('img');
      img.src    = item.src;
      img.alt    = item.alt;
      img.width  = 44;
      img.height = 44;
      img.loading = 'lazy';

      thumb.appendChild(img);
      thumb.addEventListener('click', () => navigateTo(i));
      lbThumbs.appendChild(thumb);
    });
  }

  /* ── Update active thumbnail ── */
  function syncThumbs(index) {
    lbThumbs.querySelectorAll('.lightbox-thumb').forEach(thumb => {
      const isActive = parseInt(thumb.dataset.index, 10) === index;
      thumb.classList.toggle('is-active', isActive);
    });

    // Scroll active thumb into view inside the strip
    const activeThumb = lbThumbs.querySelector('.lightbox-thumb.is-active');
    if (activeThumb) {
      activeThumb.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    }
  }

  /* ── Navigate to a specific global data index ── */
  function navigateTo(globalIndex, direction = 1) {
    const item = GALLERY_DATA[globalIndex];
    if (!item) return;

    currentGlobalIndex = globalIndex;

    /* Update category label */
    lbCategory.textContent = item.label;

    /* Update counter using visible indices */
    const visible    = getVisibleIndices();
    const posInVisible = visible.indexOf(globalIndex);
    const counterPos   = posInVisible !== -1 ? posInVisible + 1 : globalIndex + 1;
    const counterTotal = visible.length > 0 ? visible.length : GALLERY_DATA.length;
    lbCounter.textContent = `${counterPos} / ${counterTotal}`;

    /* Animated image transition */
    const SLIDE_DIST = 60;
    const fromX = direction >= 0 ? SLIDE_DIST : -SLIDE_DIST;

    if (typeof gsap !== 'undefined') {
      // Slide out old
      gsap.to(lbImg, {
        x:        -fromX,
        opacity:  0,
        duration: 0.2,
        ease:     'power2.in',
        onComplete: () => {
          swapImage(item, fromX);
        },
      });
    } else {
      swapImage(item, 0);
    }

    syncThumbs(globalIndex);
  }

  function swapImage(item, fromX) {
    lbImg.src = item.src;
    lbImg.alt = item.alt;

    /* Blurred background */
    lbBg.style.backgroundImage = `url('${item.src}')`;

    if (typeof gsap !== 'undefined') {
      gsap.fromTo(lbImg,
        { x: fromX, opacity: 0 },
        { x: 0,     opacity: 1, duration: 0.35, ease: 'power3.out' }
      );
    }
  }

  /* ── Open lightbox ── */
  function openLightbox(globalIndex) {
    isOpen = true;
    buildThumbs();

    lightbox.removeAttribute('hidden');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    // Set image immediately without animation on open
    const item = GALLERY_DATA[globalIndex];
    currentGlobalIndex = globalIndex;
    lbImg.src = item.src;
    lbImg.alt = item.alt;
    lbBg.style.backgroundImage = `url('${item.src}')`;
    lbCategory.textContent = item.label;

    const visible = getVisibleIndices();
    const pos     = visible.indexOf(globalIndex);
    lbCounter.textContent = `${pos !== -1 ? pos + 1 : globalIndex + 1} / ${visible.length || GALLERY_DATA.length}`;

    syncThumbs(globalIndex);

    if (typeof gsap !== 'undefined') {
      gsap.fromTo(lightbox,
        { opacity: 0 },
        { opacity: 1, duration: 0.35, ease: 'power2.out' }
      );
      gsap.fromTo(lbImg,
        { scale: 0.92, opacity: 0 },
        { scale: 1,    opacity: 1, duration: 0.45, ease: 'back.out(1.3)' }
      );
      gsap.fromTo([lbThumbs, '.lightbox-controls', '.lightbox-topbar'],
        { y: 16, opacity: 0 },
        { y: 0,  opacity: 1, duration: 0.4, ease: 'power3.out', stagger: 0.06, delay: 0.15 }
      );
    }

    lbClose.focus();
  }

  /* ── Close lightbox ── */
  function closeLightbox() {
    if (!isOpen) return;
    isOpen = false;

    if (typeof gsap !== 'undefined') {
      gsap.to(lightbox, {
        opacity:    0,
        duration:   0.25,
        ease:       'power2.in',
        onComplete: () => {
          lightbox.setAttribute('hidden', '');
          lightbox.setAttribute('aria-hidden', 'true');
          document.body.style.overflow = '';
        },
      });
    } else {
      lightbox.setAttribute('hidden', '');
      lightbox.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }
  }

  /* ── Navigate prev/next respecting visible filter ── */
  function goNext() {
    const visible = getVisibleIndices();
    if (!visible.length) return;
    const pos  = visible.indexOf(currentGlobalIndex);
    const next = visible[(pos + 1) % visible.length];
    navigateTo(next, 1);
  }

  function goPrev() {
    const visible = getVisibleIndices();
    if (!visible.length) return;
    const pos  = visible.indexOf(currentGlobalIndex);
    const prev = visible[(pos - 1 + visible.length) % visible.length];
    navigateTo(prev, -1);
  }

  /* ── Wire up gallery card clicks ── */
  galleryCards.forEach(card => {
    const open = () => {
      const idx = parseInt(card.dataset.index, 10);
      openLightbox(idx);
    };
    card.addEventListener('click', open);
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    });
  });

  /* ── Control buttons ── */
  lbClose.addEventListener('click', closeLightbox);
  lbNext.addEventListener('click',  goNext);
  lbPrev.addEventListener('click',  goPrev);

  /* ── Keyboard navigation ── */
  document.addEventListener('keydown', e => {
    if (!isOpen) return;
    switch (e.key) {
      case 'ArrowRight': case 'ArrowDown': goNext();        break;
      case 'ArrowLeft':  case 'ArrowUp':   goPrev();        break;
      case 'Escape':                       closeLightbox(); break;
    }
  });

  /* ── Click outside image to close ── */
  lightbox.addEventListener('click', e => {
    if (e.target === lightbox || e.target === lbBg) {
      closeLightbox();
    }
  });

  /* ── Touch/swipe support ── */
  let touchStartX = 0;
  let touchStartY = 0;

  lightbox.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  lightbox.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;

    // Only act if horizontal swipe is dominant
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 48) {
      dx < 0 ? goNext() : goPrev();
    }
  }, { passive: true });

})();

/* ═══════════════════════════════════════════════════════
   5. NAVIGATION (hamburger) — identical logic to main site
════════════════════════════════════════════════════════ */
(function initNav() {
  const navInner  = document.querySelector('.nav-inner');
  const hamburger = document.querySelector('.nav-hamburger');
  const mobileNav = document.getElementById('mobile-nav');

  function debounce(fn, delay) {
    let id;
    return (...args) => { clearTimeout(id); id = setTimeout(() => fn(...args), delay); };
  }

  const onScroll = debounce(() => {
    navInner && navInner.classList.toggle('scrolled', window.scrollY > 40);
  }, 50);
  window.addEventListener('scroll', onScroll, { passive: true });

  if (!hamburger || !mobileNav) return;
  let isOpen = false;

  function openMenu() {
    isOpen = true;
    hamburger.classList.add('open');
    hamburger.setAttribute('aria-expanded', 'true');
    mobileNav.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
    if (typeof gsap !== 'undefined') {
      gsap.fromTo(mobileNav,   { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power2.out' });
      gsap.fromTo('.mobile-nav-link', { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: 'power3.out', stagger: 0.06, delay: 0.05 });
    }
  }

  function closeMenu() {
    isOpen = false;
    hamburger.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    if (typeof gsap !== 'undefined') {
      gsap.to(mobileNav, { opacity: 0, duration: 0.25, ease: 'power2.in', onComplete: () => mobileNav.setAttribute('hidden', '') });
    } else {
      mobileNav.setAttribute('hidden', '');
    }
  }

  hamburger.addEventListener('click', () => isOpen ? closeMenu() : openMenu());
  mobileNav.querySelectorAll('.mobile-nav-link').forEach(l => l.addEventListener('click', closeMenu));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && isOpen) closeMenu(); });
})();

/* ═══════════════════════════════════════════════════════
   6. FOOTER YEAR
════════════════════════════════════════════════════════ */
(function setYear() {
  const el = document.getElementById('footer-year');
  if (el) el.textContent = new Date().getFullYear();
})();
