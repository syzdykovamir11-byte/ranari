(() => {
  const q = (selector, root = document) => root.querySelector(selector);
  const qa = (selector, root = document) => [...root.querySelectorAll(selector)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const loader = q('.loader');
  const header = q('.site-header');
  const hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';

  setupReviews();
  setupMenu();

  if (reduce || !hasGsap) {
    loader?.remove();
    setupHeader(null);
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  gsap.defaults({ ease: 'expo.out', duration: 1.2 });

  /* ---------- Smooth scroll ---------- */
  let lenis = null;
  if (typeof window.Lenis !== 'undefined') {
    lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 1, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(time => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  window.ranariLenis = lenis;

  document.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    if (!link || !lenis) return;
    const id = link.getAttribute('href').slice(1);
    const target = id ? document.getElementById(id) : null;
    if (!target) return;
    event.preventDefault();
    closeMenu(false);
    lenis.scrollTo(id === 'home' ? 0 : target, {
      duration: 1.6,
      easing: t => 1 - Math.pow(1 - t, 4),
      onComplete: () => target.focus({ preventScroll: true })
    });
    history.replaceState(null, '', `#${id}`);
  });

  /* ---------- Text splitting ---------- */
  function splitWords(element, masked = true) {
    const walk = node => {
      [...node.childNodes].forEach(child => {
        if (child.nodeType === Node.TEXT_NODE) {
          const fragment = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) { fragment.append(' '); return; }
            const inner = document.createElement('span');
            inner.className = masked ? 'wi' : 'wd';
            inner.textContent = part;
            if (masked) {
              const outer = document.createElement('span');
              outer.className = 'w';
              outer.append(inner);
              fragment.append(outer);
            } else {
              fragment.append(inner);
            }
          });
          child.replaceWith(fragment);
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          walk(child);
        }
      });
    };
    walk(element);
    return qa(masked ? '.wi' : '.wd', element);
  }

  const heroTitle = q('.hero-title');
  const heroWords = splitWords(heroTitle);
  const splitHeadings = qa('[data-split]').filter(el => el !== heroTitle).map(el => [el, splitWords(el)]);
  const introText = q('[data-words]');
  const introWords = introText ? splitWords(introText, false) : [];

  /* ---------- Loader and hero intro ---------- */
  const heroImage = q('.hero-media img');
  gsap.set(heroWords, { yPercent: 115 });
  gsap.set(['.hero-eyebrow', '.hero-sub', '.hero-actions', '.scroll-cue'], { y: 30, autoAlpha: 0 });
  gsap.set(header, { y: -30, autoAlpha: 0 });

  function heroIntro() {
    gsap.fromTo(heroImage, { scale: 1.32 }, { scale: 1, duration: 2.4 });
    gsap.to(heroWords, { yPercent: 0, duration: 1.5, stagger: 0.09, delay: 0.05 });
    gsap.to(['.hero-eyebrow', '.hero-sub', '.hero-actions', '.scroll-cue'], { y: 0, autoAlpha: 1, stagger: 0.08, delay: 0.45 });
    gsap.to(header, { y: 0, autoAlpha: 1, delay: 0.6, clearProps: 'transform,opacity,visibility' });
  }

  function seenLoader() {
    try { return sessionStorage.getItem('ranari-loader') === '1'; } catch { return false; }
  }

  function runLoader() {
    if (!loader || seenLoader()) {
      loader?.remove();
      heroIntro();
      return;
    }
    try { sessionStorage.setItem('ranari-loader', '1'); } catch { /* storage may be unavailable */ }
    lenis?.stop();
    const count = q('[data-count]', loader);
    const letters = qa('.loader-word span', loader);
    const state = { value: 0 };
    const paint = () => { count.textContent = Math.round(state.value); };
    gsap.set(letters, { yPercent: 110 });
    gsap.to(letters, { yPercent: 0, stagger: 0.06, duration: 1.1 });
    gsap.from('.loader-sub', { autoAlpha: 0, y: 12, delay: 0.5 });
    const counter = gsap.to(state, { value: 88, duration: 1.8, ease: 'power2.out', onUpdate: paint });
    const ready = Promise.all([
      document.fonts ? document.fonts.ready : Promise.resolve(),
      heroImage.decode ? heroImage.decode().catch(() => {}) : Promise.resolve(),
      new Promise(resolve => setTimeout(resolve, 1500))
    ]);
    Promise.race([ready, new Promise(resolve => setTimeout(resolve, 4500))]).then(() => {
      counter.kill();
      gsap.timeline({
        onComplete: () => {
          loader.remove();
          lenis?.start();
          ScrollTrigger.refresh();
        }
      })
        .to(state, { value: 100, duration: 0.45, ease: 'power1.inOut', onUpdate: paint })
        .to(letters, { yPercent: -110, stagger: 0.04, duration: 0.7, ease: 'expo.in' }, '<0.1')
        .to('.loader-sub, .loader-count', { autoAlpha: 0, duration: 0.4, ease: 'power1.in' }, '<0.2')
        .to(loader, { clipPath: 'inset(0% 0% 100% 0%)', duration: 1.2, ease: 'expo.inOut' }, '-=0.25')
        .add(heroIntro, '-=0.75');
    });
  }

  /* ---------- Hero on scroll ---------- */
  const mm = gsap.matchMedia();
  mm.add('(min-width: 900px)', () => {
    gsap.timeline({
      scrollTrigger: { trigger: '.hero', start: 'top top', end: '+=85%', scrub: true, pin: true, anticipatePin: 1 }
    })
      .to('.hero-media', { scale: 1.32, ease: 'none' }, 0)
      .to('.hero-content', { yPercent: -18, autoAlpha: 0, ease: 'power1.in' }, 0)
      .to('.scroll-cue', { autoAlpha: 0, ease: 'none', duration: 0.3 }, 0)
      .to('.hero-veil', { opacity: 0.35, ease: 'none' }, 0);
  });
  mm.add('(max-width: 899px)', () => {
    gsap.timeline({ scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } })
      .to('.hero-media', { yPercent: 18, scale: 1.12, ease: 'none' }, 0)
      .to('.hero-content', { yPercent: -10, autoAlpha: 0.2, ease: 'none' }, 0);
  });

  /* ---------- Grove: branches move at their own depth ---------- */
  qa('.branch').forEach((branch, index) => {
    const speed = parseFloat(branch.dataset.speed) || 0.5;
    gsap.fromTo(branch,
      { y: () => innerHeight * speed * 0.6 },
      {
        y: () => -innerHeight * speed * 0.6,
        ease: 'none',
        scrollTrigger: { trigger: branch, start: 'top bottom', end: 'bottom top', scrub: true, invalidateOnRefresh: true }
      });
    gsap.to(branch, {
      rotation: index % 2 ? 3.5 : -3.5,
      duration: 4 + (index % 4),
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1
    });
  });

  if (finePointer) {
    const groveX = gsap.quickTo('.grove', 'x', { duration: 1.6, ease: 'power3.out' });
    window.addEventListener('pointermove', event => groveX((event.clientX / innerWidth - 0.5) * -28), { passive: true });
  }

  /* ---------- Marquee follows scroll speed and direction ---------- */
  const marqueeTrack = q('.marquee-track');
  if (marqueeTrack) {
    const group = q('.marquee-group', marqueeTrack);
    let width = group.offsetWidth;
    let offset = 0;
    let direction = 1;
    let boost = 0;
    new ResizeObserver(() => { width = group.offsetWidth; }).observe(group);
    const skew = gsap.quickTo(marqueeTrack, 'skewX', { duration: 0.5, ease: 'power3.out' });
    gsap.ticker.add((time, delta) => {
      const velocity = lenis ? lenis.velocity : 0;
      if (Math.abs(velocity) > 0.5) direction = Math.sign(velocity);
      boost += (Math.min(Math.abs(velocity) * 0.6, 14) - boost) * 0.08;
      offset -= direction * (1 + boost) * delta * 0.06;
      if (offset <= -width) offset += width;
      if (offset > 0) offset -= width;
      marqueeTrack.style.transform = `translate3d(${offset}px, 0, 0)`;
      skew(Math.max(-8, Math.min(8, -velocity * 0.25)));
    });
  }

  /* ---------- Headings, reveals, words, counters ---------- */
  splitHeadings.forEach(([element, words]) => {
    gsap.from(words, {
      yPercent: 115,
      duration: 1.4,
      stagger: 0.07,
      scrollTrigger: { trigger: element, start: 'top 88%' }
    });
  });

  qa('[data-reveal]').forEach(element => {
    gsap.from(element, { y: 48, autoAlpha: 0, duration: 1.3, scrollTrigger: { trigger: element, start: 'top 90%' } });
  });

  if (introWords.length) {
    gsap.fromTo(introWords, { opacity: 0.14 }, {
      opacity: 1,
      stagger: 0.12,
      ease: 'none',
      scrollTrigger: { trigger: introText, start: 'top 82%', end: 'bottom 48%', scrub: true }
    });
  }

  qa('[data-counter]').forEach(element => {
    const target = Number(element.dataset.counter);
    const state = { value: 0 };
    element.textContent = '0';
    gsap.to(state, {
      value: target,
      duration: 2,
      ease: 'power3.out',
      onUpdate: () => { element.textContent = Math.round(state.value); },
      scrollTrigger: { trigger: element, start: 'top 90%' }
    });
  });

  /* ---------- Plans: vertical scroll drives a horizontal track ---------- */
  const plansTrack = q('.plans-track');
  const plansBar = q('.plans-progress span');
  mm.add('(min-width: 900px)', () => {
    const distance = () => Math.max(0, plansTrack.scrollWidth - innerWidth);
    const tween = gsap.to(plansTrack, {
      x: () => -distance(),
      ease: 'none',
      scrollTrigger: {
        trigger: '.plans-pin',
        start: 'top top',
        end: () => `+=${distance()}`,
        pin: true,
        scrub: 0.8,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: self => { plansBar.style.transform = `scaleX(${self.progress})`; }
      }
    });

    gsap.to('.plans-intro', {
      x: () => -innerWidth * 0.18,
      autoAlpha: 0,
      ease: 'none',
      scrollTrigger: { trigger: '.plans-pin', start: 'top top', end: () => `+=${innerWidth * 0.45}`, scrub: true, invalidateOnRefresh: true }
    });

    qa('.plan, .plans-divider', plansTrack).forEach((item, index) => {
      gsap.fromTo(item,
        { y: 90, rotation: index % 2 ? 4 : -3 },
        {
          y: 0,
          rotation: 0,
          ease: 'none',
          scrollTrigger: { trigger: item, containerAnimation: tween, start: 'left 105%', end: 'left 55%', scrub: true }
        });
    });
    qa('.plans-divider .kanji', plansTrack).forEach(kanji => {
      gsap.fromTo(kanji, { xPercent: 40 }, {
        xPercent: -40,
        ease: 'none',
        scrollTrigger: { trigger: kanji, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true }
      });
    });

    // Keyboard focus inside the moving track scrolls the page to that card.
    const onFocus = event => {
      const item = event.target.closest('.plan');
      const trigger = tween.scrollTrigger;
      if (!item || !trigger) return;
      const local = Math.min(distance(), Math.max(0, item.offsetLeft - innerWidth * 0.25));
      const y = trigger.start + local;
      if (lenis) lenis.scrollTo(y, { immediate: true });
      else window.scrollTo(0, y);
    };
    plansTrack.addEventListener('focusin', onFocus);
    return () => plansTrack.removeEventListener('focusin', onFocus);
  });
  mm.add('(max-width: 899px)', () => {
    qa('.plan, .plans-divider', plansTrack).forEach((item, index) => {
      gsap.from(item, {
        y: 70,
        rotation: index % 2 ? 2 : -2,
        autoAlpha: 0,
        duration: 1.3,
        scrollTrigger: { trigger: item, start: 'top 92%' }
      });
    });
  });

  /* ---------- Sensei ---------- */
  qa('[data-clip]').forEach(photo => {
    const timeline = gsap.timeline({ scrollTrigger: { trigger: photo, start: 'top 85%' } });
    timeline.fromTo(photo, { clipPath: 'circle(0% at 50% 50%)', rotation: -12 }, { clipPath: 'circle(50% at 50% 50%)', rotation: 0, duration: 1.6 });
    const inner = q('img, .kanji', photo);
    if (inner) timeline.fromTo(inner, { scale: 1.5 }, { scale: 1, duration: 2 }, 0);
  });

  /* ---------- Results: cards stack and recede ---------- */
  const stackCards = qa('.stack-card');
  stackCards.forEach((card, index) => {
    const level = q('.stack-level', card);
    gsap.fromTo(level, { yPercent: 18 }, {
      yPercent: -6,
      ease: 'none',
      scrollTrigger: { trigger: card, start: 'top bottom', end: 'top top', scrub: true }
    });
    const next = stackCards[index + 1];
    if (!next) return;
    gsap.fromTo(card, { scale: 1, filter: 'brightness(1)' }, {
      scale: 0.9 + index * 0.02,
      filter: 'brightness(0.95)',
      ease: 'none',
      scrollTrigger: {
        trigger: next,
        start: 'top bottom',
        end: () => `top ${parseFloat(getComputedStyle(next).top) || 100}px`,
        scrub: true,
        invalidateOnRefresh: true
      }
    });
  });

  /* ---------- Footer ---------- */
  gsap.from('.wordmark span', {
    yPercent: 100,
    stagger: 0.06,
    ease: 'none',
    scrollTrigger: { trigger: '.wordmark', start: 'top bottom', end: 'bottom bottom', scrub: true }
  });
  gsap.fromTo('.footer-branch', { y: 120, rotation: -8 }, {
    y: -60,
    rotation: 0,
    ease: 'none',
    scrollTrigger: { trigger: '.site-footer', start: 'top bottom', end: 'bottom bottom', scrub: true }
  });
  gsap.from('.cta-orb', { scale: 0, rotation: -90, duration: 1.6, scrollTrigger: { trigger: '.cta-orb', start: 'top 92%' } });

  /* ---------- Header, cursor, magnetic buttons, petals ---------- */
  setupHeader(lenis);
  if (finePointer) {
    setupCursor();
    setupMagnetic();
  }
  setupPetals(lenis);

  if (document.fonts) document.fonts.ready.then(() => ScrollTrigger.refresh());
  window.addEventListener('load', () => ScrollTrigger.refresh());
  runLoader();

  function setupCursor() {
    const cursor = q('.cursor');
    const label = q('.cursor-label', cursor);
    const moveX = gsap.quickTo(cursor, 'x', { duration: 0.45, ease: 'power3.out' });
    const moveY = gsap.quickTo(cursor, 'y', { duration: 0.45, ease: 'power3.out' });
    window.addEventListener('pointermove', event => { moveX(event.clientX); moveY(event.clientY); }, { passive: true });
    document.addEventListener('pointerover', event => {
      const labelled = event.target.closest('[data-cursor]');
      const link = event.target.closest('a, button');
      cursor.classList.toggle('is-label', Boolean(labelled));
      cursor.classList.toggle('is-link', Boolean(link) && !labelled);
      if (labelled) label.textContent = labelled.dataset.cursor;
    });
    document.addEventListener('pointerleave', () => cursor.classList.remove('is-label', 'is-link'));
  }

  function setupMagnetic() {
    qa('[data-magnetic]').forEach(element => {
      const moveX = gsap.quickTo(element, 'x', { duration: 0.6, ease: 'power3.out' });
      const moveY = gsap.quickTo(element, 'y', { duration: 0.6, ease: 'power3.out' });
      element.addEventListener('pointermove', event => {
        const box = element.getBoundingClientRect();
        moveX((event.clientX - box.left - box.width / 2) * 0.32);
        moveY((event.clientY - box.top - box.height / 2) * 0.32);
      });
      element.addEventListener('pointerleave', () => {
        gsap.to(element, { x: 0, y: 0, duration: 1.1, ease: 'elastic.out(1, .4)' });
      });
    });
  }

  function setupPetals(scroller) {
    const canvas = q('.petals');
    if (!canvas || !canvas.getContext) return;
    const context = canvas.getContext('2d');
    const colors = ['#f2c4cb', '#eab3bb', '#f7dcdc', '#e59aa8', '#fbe6e6'];
    const petals = [];
    let width = 0;
    let height = 0;
    let wind = 0;

    function resize() {
      const ratio = Math.min(devicePixelRatio || 1, 2);
      width = innerWidth;
      height = innerHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const wanted = width < 700 ? 14 : 26;
      while (petals.length < wanted) petals.push(spawn({}, true));
      petals.length = wanted;
    }

    function spawn(petal, anywhere) {
      petal.x = Math.random() * width;
      petal.y = anywhere ? Math.random() * height : -24;
      petal.size = 5 + Math.random() * 8;
      petal.fall = 0.35 + Math.random() * 0.65;
      petal.drift = 0.15 + Math.random() * 0.45;
      petal.angle = Math.random() * Math.PI * 2;
      petal.spin = (Math.random() - 0.5) * 0.03;
      petal.flip = Math.random() * Math.PI * 2;
      petal.flipSpeed = 0.015 + Math.random() * 0.03;
      petal.sway = Math.random() * Math.PI * 2;
      petal.color = colors[Math.floor(Math.random() * colors.length)];
      petal.alpha = 0.5 + Math.random() * 0.45;
      return petal;
    }

    function draw(petal) {
      const s = petal.size;
      context.save();
      context.translate(petal.x, petal.y);
      context.rotate(petal.angle);
      context.scale(1, Math.max(0.15, Math.abs(Math.cos(petal.flip))));
      context.globalAlpha = petal.alpha;
      context.fillStyle = petal.color;
      context.beginPath();
      context.moveTo(0, s);
      context.bezierCurveTo(-s, s * 0.35, -s * 0.85, -s * 0.85, -s * 0.2, -s);
      context.lineTo(0, -s * 0.7);
      context.lineTo(s * 0.2, -s);
      context.bezierCurveTo(s * 0.85, -s * 0.85, s, s * 0.35, 0, s);
      context.fill();
      context.restore();
    }

    resize();
    window.addEventListener('resize', resize);
    gsap.ticker.add((time, delta) => {
      if (document.hidden) return;
      const step = Math.min(delta, 50) / 16.7;
      const velocity = scroller ? scroller.velocity : 0;
      wind += (velocity - wind) * 0.06;
      context.clearRect(0, 0, width, height);
      petals.forEach(petal => {
        petal.sway += 0.02 * step;
        petal.flip += petal.flipSpeed * step;
        petal.angle += petal.spin * step;
        petal.x += (petal.drift + Math.sin(petal.sway) * 0.6) * step;
        petal.y += (petal.fall - wind * 0.35) * step;
        if (petal.y > height + 30) spawn(petal, false);
        if (petal.y < -40) { spawn(petal, false); petal.y = height + 20; }
        if (petal.x > width + 30) petal.x = -20;
        draw(petal);
      });
    });
  }

  /* ---------- Shared helpers that also run without motion ---------- */
  function setupHeader(scroller) {
    let last = window.scrollY;
    const update = () => {
      const y = window.scrollY;
      const past = y > innerHeight * 0.6;
      header.classList.toggle('is-solid', past);
      header.classList.toggle('is-hidden', past && y > last + 2 && !document.documentElement.classList.contains('menu-open'));
      if (y < last - 2) header.classList.remove('is-hidden');
      last = y;
    };
    if (scroller) scroller.on('scroll', update);
    else window.addEventListener('scroll', update, { passive: true });
    update();
  }

  function setupReviews() {
    qa('[data-row]').forEach(row => {
      const list = q('.review-list', row);
      if (reduce) return;
      [...list.children].forEach(item => {
        const clone = item.cloneNode(true);
        clone.setAttribute('aria-hidden', 'true');
        list.append(clone);
      });
      row.style.setProperty('--dur', `${Math.round(list.scrollWidth / 2 / 38)}s`);
      row.classList.add('is-looping');
    });
  }

  function setupMenu() {
    const toggle = q('.menu-toggle');
    const menu = q('#menu');
    const label = q('.menu-toggle-label', toggle);
    const inertTargets = [q('main'), q('.site-footer')];
    let open = false;

    toggle.addEventListener('click', () => (open ? closeMenu(true) : openMenu()));
    menu.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(true); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && open) closeMenu(true); });
    menu.addEventListener('click', event => {
      const link = event.target.closest('a[href^="#"]');
      if (link && !window.ranariLenis) closeMenu(false);
    });
    matchMedia('(min-width: 1000px)').addEventListener('change', event => { if (event.matches) closeMenu(false); });

    function openMenu() {
      open = true;
      menu.hidden = false;
      toggle.setAttribute('aria-expanded', 'true');
      label.textContent = 'Закрыть';
      document.documentElement.classList.add('menu-open');
      inertTargets.forEach(element => { if (element) element.inert = true; });
      window.ranariLenis?.stop();
      if (window.gsap && !reduce) {
        gsap.killTweensOf(menu);
        gsap.to(menu, { clipPath: 'circle(150% at calc(100% - 48px) 38px)', duration: 1, ease: 'expo.inOut' });
        gsap.fromTo(qa('.menu-nav a', menu), { yPercent: 100, opacity: 0 }, { yPercent: 0, opacity: 1, stagger: 0.06, duration: 1, delay: 0.35, ease: 'expo.out' });
        gsap.fromTo('.menu-branch', { x: 120, rotation: 10 }, { x: 0, rotation: 0, duration: 1.8, delay: 0.2, ease: 'expo.out' });
      } else {
        menu.style.clipPath = 'none';
      }
      q('a', menu).focus({ preventScroll: true });
    }

    window.closeRanariMenu = (returnFocus) => {
      if (!open) return;
      open = false;
      toggle.setAttribute('aria-expanded', 'false');
      label.textContent = 'Меню';
      document.documentElement.classList.remove('menu-open');
      inertTargets.forEach(element => { if (element) element.inert = false; });
      window.ranariLenis?.start();
      const finish = () => { menu.hidden = true; };
      if (window.gsap && !reduce) {
        gsap.killTweensOf(menu);
        gsap.to(menu, { clipPath: 'circle(0% at calc(100% - 48px) 38px)', duration: 0.8, ease: 'expo.inOut', onComplete: finish });
      } else {
        finish();
      }
      if (returnFocus) toggle.focus();
    };
  }

  function closeMenu(returnFocus) {
    window.closeRanariMenu?.(returnFocus);
  }
})();
