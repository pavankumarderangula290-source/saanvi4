/**
 * SAANVI INTERNATIONAL SCHOOL — HIGH-PERFORMANCE JS ENGINE
 * Three.js dark-matter particle field + GSAP ScrollTrigger animations
 *
 * Performance contract:
 *  - DPR capped at 2
 *  - Mobile: 60% particle reduction
 *  - will-change pre-applied via CSS
 *  - Resize debounced at 200ms
 *  - RAF loop with delta-time capped to prevent spiral of death
 */

'use strict';

/* ═══════════════════════════════════════════════════════
   0. UTILS
════════════════════════════════════════════════════════ */

const isMobile = () => window.innerWidth < 768;
const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function debounce(fn, delay) {
  let id;
  return (...args) => {
    clearTimeout(id);
    id = setTimeout(() => fn(...args), delay);
  };
}

/* ═══════════════════════════════════════════════════════
   1. THREE.JS PARTICLE FIELD
════════════════════════════════════════════════════════ */

(function initParticleField() {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas || typeof THREE === 'undefined') return;

  /* Skip heavy WebGL on reduced-motion preference */
  if (prefersReducedMotion()) {
    canvas.style.display = 'none';
    return;
  }

  /* ── Renderer ── */
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,        // disabled for perf; particles are round anyway
    alpha: true,
    powerPreference: 'high-performance',
    stencil: false,
    depth: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // DPR cap
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 1);

  /* ── Scene & Camera ── */
  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.z = 280;

  /* ── Particle counts ── */
  const BASE_COUNT   = 2800;
  const MOBILE_SCALE = 0.40; // 60% reduction = 40% of base
  const particleCount = isMobile()
    ? Math.floor(BASE_COUNT * MOBILE_SCALE)
    : BASE_COUNT;

  /* ── Geometry: BufferGeometry for max performance ── */
  const geometry = new THREE.BufferGeometry();

  const positions  = new Float32Array(particleCount * 3);
  const velocities = new Float32Array(particleCount * 3); // packed: vx,vy,vz per particle
  const randoms    = new Float32Array(particleCount);     // per-particle noise seed

  const SPREAD = 500;

  for (let i = 0; i < particleCount; i++) {
    const i3 = i * 3;
    positions[i3]     = (Math.random() - 0.5) * SPREAD;
    positions[i3 + 1] = (Math.random() - 0.5) * SPREAD;
    positions[i3 + 2] = (Math.random() - 0.5) * SPREAD * 0.5;

    velocities[i3]     = (Math.random() - 0.5) * 0.018;
    velocities[i3 + 1] = (Math.random() - 0.5) * 0.018;
    velocities[i3 + 2] = (Math.random() - 0.5) * 0.006;

    randoms[i] = Math.random();
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('random',   new THREE.BufferAttribute(randoms,   1));

  /* ── Material ── */
  const material = new THREE.PointsMaterial({
    color:       0xffffff,
    size:        1.2,
    sizeAttenuation: true,
    transparent: true,
    opacity:     0.55,
    depthWrite:  false,
    blending:    THREE.AdditiveBlending,
  });

  /* ── Points object ── */
  const particles = new THREE.Points(geometry, material);
  scene.add(particles);

  /* ── Subtle connections geometry (lines between nearby particles) ── */
  // Skip on mobile for performance
  let linesMesh = null;
  if (!isMobile()) {
    const linesGeo = new THREE.BufferGeometry();
    const maxLines = 800;
    const linePositions = new Float32Array(maxLines * 6); // 2 points per line
    linesGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    linesGeo.setDrawRange(0, 0);

    const linesMat = new THREE.LineSegmentsGeometry
      ? null  // fallback handled below
      : null;

    const linesMaterial = new THREE.LineBasicMaterial({
      color:       0xffffff,
      transparent: true,
      opacity:     0.04,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
    });

    linesMesh = new THREE.LineSegments(linesGeo, linesMaterial);
    scene.add(linesMesh);
  }

  /* ── Mouse / Touch tracking ── */
  const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };

  function onMouseMove(e) {
    mouse.targetX = (e.clientX / window.innerWidth  - 0.5) * 2;
    mouse.targetY = (e.clientY / window.innerHeight - 0.5) * 2;
  }

  function onTouchMove(e) {
    if (e.touches.length === 0) return;
    const t = e.touches[0];
    mouse.targetX = (t.clientX / window.innerWidth  - 0.5) * 2;
    mouse.targetY = (t.clientY / window.innerHeight - 0.5) * 2;
  }

  /* Device orientation tilt (mobile) */
  function onDeviceOrientation(e) {
    if (e.gamma === null || e.beta === null) return;
    mouse.targetX = Math.max(-1, Math.min(1, e.gamma / 30));
    mouse.targetY = Math.max(-1, Math.min(1, (e.beta  - 30) / 45));
  }

  window.addEventListener('mousemove',        onMouseMove,        { passive: true });
  window.addEventListener('touchmove',        onTouchMove,        { passive: true });
  window.addEventListener('deviceorientation', onDeviceOrientation, { passive: true });

  /* ── Resize handler (debounced) ── */
  const onResize = debounce(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }, 200);

  window.addEventListener('resize', onResize, { passive: true });

  /* ── RAF animation loop ── */
  let lastTime = 0;
  const MAX_DELTA = 50; // ms — cap to prevent spiral of death after tab switch
  let lineUpdateTimer = 0;
  const LINE_UPDATE_INTERVAL = 120; // ms — don't update lines every frame

  function animate(ts) {
    const delta = Math.min(ts - lastTime, MAX_DELTA);
    lastTime = ts;
    const dt = delta / 16.667; // normalise to 60fps units

    /* Lerp mouse for smooth camera parallax */
    mouse.x += (mouse.targetX - mouse.x) * 0.04;
    mouse.y += (mouse.targetY - mouse.y) * 0.04;

    /* Gentle camera parallax */
    camera.position.x += (mouse.x * 18 - camera.position.x) * 0.03;
    camera.position.y += (-mouse.y * 12 - camera.position.y) * 0.03;
    camera.lookAt(scene.position);

    /* Slow rotation of entire particle cloud */
    particles.rotation.y += 0.00015 * dt;
    particles.rotation.x += 0.00008 * dt;

    /* Per-particle drift */
    const posArr = geometry.attributes.position.array;
    const HALF_SPREAD = SPREAD / 2;

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;

      posArr[i3]     += velocities[i3]     * dt;
      posArr[i3 + 1] += velocities[i3 + 1] * dt;
      posArr[i3 + 2] += velocities[i3 + 2] * dt;

      /* Wrap around bounds */
      if (posArr[i3]     >  HALF_SPREAD) posArr[i3]     = -HALF_SPREAD;
      if (posArr[i3]     < -HALF_SPREAD) posArr[i3]     =  HALF_SPREAD;
      if (posArr[i3 + 1] >  HALF_SPREAD) posArr[i3 + 1] = -HALF_SPREAD;
      if (posArr[i3 + 1] < -HALF_SPREAD) posArr[i3 + 1] =  HALF_SPREAD;
    }

    geometry.attributes.position.needsUpdate = true;

    /* Connection lines — updated at reduced frequency */
    if (linesMesh && delta > 0) {
      lineUpdateTimer += delta;
      if (lineUpdateTimer >= LINE_UPDATE_INTERVAL) {
        lineUpdateTimer = 0;
        updateLines(posArr);
      }
    }

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  function updateLines(posArr) {
    const linePos = linesMesh.geometry.attributes.position.array;
    const DIST_THRESHOLD_SQ = 40 * 40; // squared distance
    let lineIdx = 0;
    const maxPairs = 800;
    const step = Math.ceil(particleCount / 120); // sample subset for perf

    for (let i = 0; i < particleCount && lineIdx < maxPairs; i += step) {
      for (let j = i + step; j < particleCount && lineIdx < maxPairs; j += step) {
        const i3 = i * 3;
        const j3 = j * 3;
        const dx = posArr[i3]     - posArr[j3];
        const dy = posArr[i3 + 1] - posArr[j3 + 1];
        const dz = posArr[i3 + 2] - posArr[j3 + 2];
        const distSq = dx*dx + dy*dy + dz*dz;

        if (distSq < DIST_THRESHOLD_SQ) {
          const base = lineIdx * 6;
          linePos[base]     = posArr[i3];
          linePos[base + 1] = posArr[i3 + 1];
          linePos[base + 2] = posArr[i3 + 2];
          linePos[base + 3] = posArr[j3];
          linePos[base + 4] = posArr[j3 + 1];
          linePos[base + 5] = posArr[j3 + 2];
          lineIdx++;
        }
      }
    }

    linesMesh.geometry.attributes.position.needsUpdate = true;
    linesMesh.geometry.setDrawRange(0, lineIdx * 2);
  }

  requestAnimationFrame(animate);

})();

/* ═══════════════════════════════════════════════════════
   2. GSAP SCROLL ANIMATIONS
════════════════════════════════════════════════════════ */

(function initGSAP() {
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

  gsap.registerPlugin(ScrollTrigger);

  /* Skip animations if prefers-reduced-motion */
  if (prefersReducedMotion()) {
    gsap.set('.gsap-reveal, .gsap-reveal-line, .gsap-card', { opacity: 1 });
    return;
  }

  /* Shared ease */
  const EASE_OUT  = 'power3.out';
  const EASE_BACK = 'back.out(1.4)';

  /* ── HERO entrance sequence ── */
  const heroTL = gsap.timeline({ delay: 0.1 });

  heroTL
    .fromTo('.hero-badge',
      { y: 20, opacity: 0, scale: 0.9 },
      { y: 0,  opacity: 1, scale: 1, duration: 0.7, ease: EASE_BACK }
    )
    .fromTo('.hero-title__line',
      { yPercent: 110, opacity: 0 },
      {
        yPercent: 0,
        opacity:  1,
        duration: 0.9,
        ease:     EASE_OUT,
        stagger:  0.1,
      },
      '-=0.3'
    )
    .fromTo('.hero-motto',
      { x: -20, opacity: 0 },
      { x: 0,   opacity: 1, duration: 0.6, ease: EASE_OUT },
      '-=0.4'
    )
    .fromTo('.hero-descriptor',
      { y: 10, opacity: 0 },
      { y: 0,  opacity: 1, duration: 0.5, ease: EASE_OUT },
      '-=0.3'
    )
    .fromTo('.hero-cta-group',
      { y: 16, opacity: 0 },
      { y: 0,  opacity: 1, duration: 0.6, ease: EASE_OUT },
      '-=0.3'
    )
    .fromTo('.hero-scroll-indicator',
      { y: 10, opacity: 0 },
      { y: 0,  opacity: 1, duration: 0.5, ease: EASE_OUT },
      '-=0.2'
    );

  /* ── NAV header entrance ── */
  gsap.fromTo('.site-header',
    { y: -30, opacity: 0 },
    { y: 0,   opacity: 1, duration: 0.8, ease: EASE_OUT, delay: 0.05 }
  );

  /* ── Scroll reveal factory ── */
  function scrollReveal(selector, vars = {}) {
    gsap.fromTo(
      selector,
      {
        y:       vars.fromY   ?? 48,
        opacity: vars.fromOp  ?? 0,
        scale:   vars.fromSc  ?? 1,
      },
      {
        y:        0,
        opacity:  1,
        scale:    1,
        duration: vars.duration ?? 0.8,
        ease:     vars.ease    ?? EASE_OUT,
        stagger:  vars.stagger ?? 0,
        scrollTrigger: {
          trigger:       vars.trigger    ?? selector,
          start:         vars.start      ?? 'top 85%',
          toggleActions: 'play none none none',
          ...( vars.markers ? { markers: true } : {} ),
        },
      }
    );
  }

  /* ── VISION SECTION ── */
  ScrollTrigger.create({
    trigger: '#vision',
    start:   'top 90%',
    onEnter: () => {
      gsap.fromTo('#vision .section-eyebrow',
        { x: -24, opacity: 0 },
        { x: 0,   opacity: 1, duration: 0.6, ease: EASE_OUT }
      );
      gsap.fromTo('#vision .section-title',
        { y: 40, opacity: 0 },
        { y: 0,  opacity: 1, duration: 0.8, ease: EASE_OUT, delay: 0.1 }
      );
    }
  });

  gsap.fromTo('#vision .gsap-card',
    { y: 52, opacity: 0, scale: 0.97 },
    {
      y:        0,
      opacity:  1,
      scale:    1,
      duration: 0.75,
      ease:     EASE_OUT,
      stagger:  0.12,
      scrollTrigger: {
        trigger:       '#vision .vision-grid',
        start:         'top 82%',
        toggleActions: 'play none none none',
      },
    }
  );

  /* ── CAMPUS SECTION ── */
  ScrollTrigger.create({
    trigger: '#campus',
    start:   'top 90%',
    onEnter: () => {
      gsap.fromTo('#campus .section-eyebrow',
        { x: -24, opacity: 0 },
        { x: 0,   opacity: 1, duration: 0.6, ease: EASE_OUT }
      );
      gsap.fromTo('#campus .section-title',
        { y: 40, opacity: 0 },
        { y: 0,  opacity: 1, duration: 0.8, ease: EASE_OUT, delay: 0.1 }
      );
    }
  });

  gsap.fromTo('#campus .campus-stats-row',
    { y: 36, opacity: 0 },
    {
      y:        0,
      opacity:  1,
      duration: 0.9,
      ease:     EASE_OUT,
      scrollTrigger: {
        trigger:       '#campus .campus-stats-row',
        start:         'top 85%',
        toggleActions: 'play none none none',
      },
    }
  );

  /* Stat numbers count-up animation */
  ScrollTrigger.create({
    trigger: '#campus .campus-stats-row',
    start:   'top 80%',
    once:    true,
    onEnter: () => {
      // Animate 2015 stat value
      const yearEl = document.querySelector('.campus-stat:last-child .stat-value');
      if (yearEl) {
        const obj = { val: 2010 };
        gsap.to(obj, {
          val:      2015,
          duration: 1.2,
          ease:     'power2.out',
          onUpdate: () => { yearEl.textContent = Math.round(obj.val); }
        });
      }
    }
  });

  gsap.fromTo('#campus .gsap-card',
    { y: 48, opacity: 0, scale: 0.96 },
    {
      y:        0,
      opacity:  1,
      scale:    1,
      duration: 0.7,
      ease:     EASE_OUT,
      stagger:  0.1,
      scrollTrigger: {
        trigger:       '#campus .campus-features-grid',
        start:         'top 82%',
        toggleActions: 'play none none none',
      },
    }
  );

  /* ── LEADERSHIP SECTION ── */
  ScrollTrigger.create({
    trigger: '#leadership',
    start:   'top 90%',
    onEnter: () => {
      gsap.fromTo('#leadership .section-eyebrow',
        { x: -24, opacity: 0 },
        { x: 0,   opacity: 1, duration: 0.6, ease: EASE_OUT }
      );
      gsap.fromTo('#leadership .section-title',
        { y: 40, opacity: 0 },
        { y: 0,  opacity: 1, duration: 0.8, ease: EASE_OUT, delay: 0.1 }
      );
    }
  });

  gsap.fromTo('#leadership .gsap-card',
    { y: 64, opacity: 0, scale: 0.95 },
    {
      y:        0,
      opacity:  1,
      scale:    1,
      duration: 0.85,
      ease:     EASE_OUT,
      stagger:  0.18,
      scrollTrigger: {
        trigger:       '#leadership .leadership-grid',
        start:         'top 82%',
        toggleActions: 'play none none none',
      },
    }
  );

  /* ── CONTACT SECTION ── */
  gsap.fromTo('#contact .gsap-reveal',
    { y: 56, opacity: 0, scale: 0.97 },
    {
      y:        0,
      opacity:  1,
      scale:    1,
      duration: 0.9,
      ease:     EASE_OUT,
      scrollTrigger: {
        trigger:       '#contact',
        start:         'top 85%',
        toggleActions: 'play none none none',
      },
    }
  );

  /* ── Parallax on hero title (subtle) ── */
  gsap.to('.hero-title', {
    yPercent: -20,
    ease: 'none',
    scrollTrigger: {
      trigger:  '#hero',
      start:    'top top',
      end:      'bottom top',
      scrub:    1.5,
    },
  });

  gsap.to('.hero-badge, .hero-motto, .hero-descriptor, .hero-cta-group', {
    yPercent: -10,
    opacity:  0.0,
    ease:     'none',
    scrollTrigger: {
      trigger: '#hero',
      start:   '60% top',
      end:     'bottom top',
      scrub:   1,
    },
  });

})();

/* ═══════════════════════════════════════════════════════
   3. NAVIGATION BEHAVIOUR
════════════════════════════════════════════════════════ */

(function initNav() {
  const header    = document.querySelector('.site-header');
  const navInner  = document.querySelector('.nav-inner');
  const hamburger = document.querySelector('.nav-hamburger');
  const mobileNav = document.getElementById('mobile-nav');

  /* Scroll-aware nav opacity */
  const onScroll = debounce(() => {
    if (window.scrollY > 40) {
      navInner.classList.add('scrolled');
    } else {
      navInner.classList.remove('scrolled');
    }
  }, 50);

  window.addEventListener('scroll', onScroll, { passive: true });

  /* Hamburger toggle */
  if (hamburger && mobileNav) {
    let isOpen = false;

    function openMenu() {
      isOpen = true;
      hamburger.classList.add('open');
      hamburger.setAttribute('aria-expanded', 'true');
      mobileNav.removeAttribute('hidden');
      document.body.style.overflow = 'hidden';

      if (typeof gsap !== 'undefined') {
        gsap.fromTo(mobileNav,
          { opacity: 0 },
          { opacity: 1, duration: 0.3, ease: 'power2.out' }
        );
        gsap.fromTo('.mobile-nav-link',
          { y: 24, opacity: 0 },
          { y: 0,  opacity: 1, duration: 0.4, ease: 'power3.out', stagger: 0.06, delay: 0.05 }
        );
      }
    }

    function closeMenu() {
      isOpen = false;
      hamburger.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';

      if (typeof gsap !== 'undefined') {
        gsap.to(mobileNav, {
          opacity:    0,
          duration:   0.25,
          ease:       'power2.in',
          onComplete: () => { mobileNav.setAttribute('hidden', ''); }
        });
      } else {
        mobileNav.setAttribute('hidden', '');
      }
    }

    hamburger.addEventListener('click', () => {
      isOpen ? closeMenu() : openMenu();
    });

    /* Close on nav link click */
    mobileNav.querySelectorAll('.mobile-nav-link').forEach(link => {
      link.addEventListener('click', closeMenu);
    });

    /* Close on Escape key */
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen) closeMenu();
    });
  }

  /* Active link highlight on scroll */
  const sections = document.querySelectorAll('section[id]');
  const navLinks  = document.querySelectorAll('.nav-link:not(.nav-link--cta)');

  const sectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          navLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (href === `#${id}`) {
              link.style.color = '#ffffff';
            } else {
              link.style.color = '';
            }
          });
        }
      });
    },
    { threshold: 0.4, rootMargin: '-10% 0px -60% 0px' }
  );

  sections.forEach(s => sectionObserver.observe(s));

})();

/* ═══════════════════════════════════════════════════════
   4. MISCELLANEOUS UTILS
════════════════════════════════════════════════════════ */

/* Footer copyright year */
(function setYear() {
  const el = document.getElementById('footer-year');
  if (el) el.textContent = new Date().getFullYear();
})();

/* Smooth anchor scroll for browsers that don't support scroll-behavior */
(function smoothAnchorFallback() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (href === '#') return;
      const target = document.querySelector(href);
      if (!target) return;
      // Native smooth scroll handles it if CSS scroll-behavior is supported
      // This is just a pointer event enhancement — no override needed
    });
  });
})();

/* ── Image load fade-in for leader photos ── */
(function leaderImageFade() {
  const imgs = document.querySelectorAll('.leader-image');
  imgs.forEach(img => {
    img.style.opacity = '0';
    img.style.transition = 'opacity 0.5s ease';

    if (img.complete && img.naturalWidth > 0) {
      img.style.opacity = '1';
    } else {
      img.addEventListener('load',  () => { img.style.opacity = '1'; });
      img.addEventListener('error', () => {
        /* Graceful fallback: show a placeholder pattern on broken images */
        img.style.opacity = '0.2';
        img.closest('.leader-image-wrap').style.background =
          'repeating-linear-gradient(45deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 2px, transparent 2px, transparent 12px)';
      });
    }
  });
})();
