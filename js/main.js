(() => {
  const q = (selector, root = document) => root.querySelector(selector);
  const qa = (selector, root = document) => [...root.querySelectorAll(selector)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const loader = q('.loader');
  const header = q('.site-header');
  const hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';

  if (typeof window.setupCarousel === 'function') document.querySelectorAll('[data-rail]').forEach(window.setupCarousel);
  setupReviews();
  setupMenu();
  setupLiquidGlass();
  // The menu panel is hidden at load, so its map is drawn the first time it opens.
  window.addEventListener('ranari:menu-open', () => {
    requestAnimationFrame(() => setupLiquidGlass(q('.menu-panel'), q('#menu-glass-filter feImage'), 32));
  }, { once: true });

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
  gsap.set(['.hero-sub', '.hero-actions', '.scroll-cue'], { y: 30, autoAlpha: 0 });
  gsap.set(header, { y: -30, autoAlpha: 0 });

  function heroIntro() {
    gsap.fromTo(heroImage, { scale: 1.32 }, { scale: 1, duration: 2.4 });
    gsap.to(heroWords, { yPercent: 0, duration: 1.5, stagger: 0.09, delay: 0.05 });
    gsap.to(['.hero-sub', '.hero-actions', '.scroll-cue'], { y: 0, autoAlpha: 1, stagger: 0.08, delay: 0.45 });
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

  /* ---------- Grove: walking under the tree ---------- */
  // Foreground branches move faster than the page and grow a little as they pass, so they read as
  // close to the camera; background branches drift slowly behind the content.
  const scrollVelocity = () => (lenis && Number.isFinite(lenis.velocity) ? lenis.velocity : 0);
  const branches = qa('.branch');
  branches.forEach(branch => {
    const speed = parseFloat(branch.dataset.speed) || 0.7;
    const front = branch.classList.contains('branch--front');
    const fromRight = branch.classList.contains('branch--r');
    const travel = front ? 0.45 : 0.3;
    // One trigger per branch: parallax and scale run across the whole pass, the growth out of
    // the edge happens in the first third. Separate triggers would measure each other's offsets.
    gsap.timeline({
      scrollTrigger: { trigger: branch, start: 'top bottom', end: 'bottom top', scrub: 0.9, invalidateOnRefresh: true }
    })
      .fromTo(branch,
        { y: () => innerHeight * speed * travel, scale: front ? 0.9 : 1 },
        { y: () => -innerHeight * speed * travel, scale: front ? 1.14 : 1, ease: 'none', duration: 1 }, 0)
      .fromTo(branch,
        { xPercent: fromRight ? 60 : -60 },
        { xPercent: 0, ease: 'power2.out', duration: 0.35 }, 0);
  });

  // Wind: a slow idle sway plus a gust that follows scroll speed. Each branch pivots at its trunk.
  let gust = 0;
  gsap.ticker.add(time => {
    gust += (Math.max(-7, Math.min(7, scrollVelocity() * 0.3)) - gust) * 0.05;
    branches.forEach((branch, index) => {
      const side = branch.classList.contains('branch--r') ? 1 : -1;
      const idle = Math.sin(time * (0.5 + (index % 3) * 0.12) + index * 1.7) * 1.6;
      gsap.set(branch, { rotation: side * (idle + gust * (0.5 + (index % 4) * 0.12)) });
    });
  });

  /* ---------- Marquee: a CSS loop that speeds up while scrolling ---------- */
  const marqueeTrack = q('.marquee-track');
  const marqueeLoop = marqueeTrack?.getAnimations ? marqueeTrack.getAnimations()[0] : null;
  if (marqueeLoop) {
    let rate = 1;
    gsap.ticker.add(() => {
      rate += (1 + Math.min(Math.abs(scrollVelocity()) * 0.08, 3) - rate) * 0.08;
      marqueeLoop.playbackRate = rate;
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

  /* ---------- Plans: the carousel slides in from the right ---------- */
  gsap.from('.plans-rail .rail-viewport', {
    x: () => innerWidth * 0.35,
    autoAlpha: 0,
    duration: 1.8,
    scrollTrigger: { trigger: '.plans-rail', start: 'top 85%' }
  });
  gsap.from('.plans-rail .rail-controls', {
    y: 30, autoAlpha: 0, delay: 0.4, scrollTrigger: { trigger: '.plans-rail', start: 'top 85%' }
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

  // Real petal photos tumble in 3D: two rotation axes are projected onto the canvas,
  // the back of a petal reads paler, and near petals are larger, faster and softly blurred.
  function setupPetals(scroller) {
    const canvas = q('.petals');
    if (!canvas || !canvas.getContext) return;
    const context = canvas.getContext('2d');
    const sources = ['p1', 'p2', 'p3', 'p4'].map(name => {
      const image = new Image();
      image.src = `assets/petals/${name}.png`;
      return image;
    });
    const sprites = [];
    const petals = [];
    let width = 0;
    let height = 0;
    let wind = 0;

    function makeSprite(image) {
      const front = document.createElement('canvas');
      front.width = image.naturalWidth;
      front.height = image.naturalHeight;
      front.getContext('2d').drawImage(image, 0, 0);
      // The underside of a petal is lighter and less saturated.
      const back = document.createElement('canvas');
      back.width = front.width;
      back.height = front.height;
      const backContext = back.getContext('2d');
      backContext.drawImage(image, 0, 0);
      backContext.globalCompositeOperation = 'source-atop';
      backContext.fillStyle = 'rgba(255, 236, 238, .42)';
      backContext.fillRect(0, 0, back.width, back.height);
      // A softened copy for petals close to the camera.
      const near = document.createElement('canvas');
      near.width = front.width;
      near.height = front.height;
      const nearContext = near.getContext('2d');
      if ('filter' in nearContext) nearContext.filter = 'blur(2.5px)';
      nearContext.drawImage(image, 0, 0);
      return { front, back, near, ratio: front.height / front.width };
    }

    function resize() {
      const ratio = Math.min(devicePixelRatio || 1, 2);
      width = canvas.clientWidth || innerWidth;
      height = canvas.clientHeight || innerHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const wanted = width < 700 ? 12 : 22;
      while (petals.length < wanted) petals.push(spawn({}, true));
      petals.length = wanted;
    }

    function spawn(petal, anywhere) {
      const depth = Math.random();
      petal.depth = depth;
      petal.x = Math.random() * width;
      petal.y = anywhere ? Math.random() * height : -60;
      petal.size = 20 + depth * depth * 46;
      petal.fall = 0.35 + depth * 0.9;
      petal.drift = 0.15 + Math.random() * 0.5;
      petal.angle = Math.random() * Math.PI * 2;
      petal.spin = (Math.random() - 0.5) * 0.02;
      petal.tiltX = Math.random() * Math.PI * 2;
      petal.tiltY = Math.random() * Math.PI * 2;
      petal.tiltXSpeed = 0.012 + Math.random() * 0.03;
      petal.tiltYSpeed = 0.008 + Math.random() * 0.022;
      petal.sway = Math.random() * Math.PI * 2;
      petal.sprite = Math.floor(Math.random() * 4);
      petal.alpha = 0.55 + depth * 0.45;
      return petal;
    }

    function draw(petal) {
      const sprite = sprites[petal.sprite];
      if (!sprite) return;
      const scaleX = Math.cos(petal.tiltY);
      const scaleY = Math.cos(petal.tiltX);
      const facing = scaleX * scaleY;
      const w = petal.size;
      const h = petal.size * sprite.ratio;
      const image = petal.depth > 0.86 ? sprite.near : facing < 0 ? sprite.back : sprite.front;
      context.save();
      context.translate(petal.x, petal.y);
      context.rotate(petal.angle);
      context.scale(Math.sign(scaleX || 1) * Math.max(0.12, Math.abs(scaleX)), Math.max(0.12, Math.abs(scaleY)));
      // Edge-on petals catch less light.
      context.globalAlpha = petal.alpha * (0.7 + 0.3 * Math.abs(facing));
      context.drawImage(image, -w / 2, -h / 2, w, h);
      context.restore();
    }

    Promise.all(sources.map(image => (image.decode ? image.decode().catch(() => {}) : Promise.resolve()))).then(() => {
      sources.forEach(image => { if (image.naturalWidth) sprites.push(makeSprite(image)); });
      while (sprites.length && sprites.length < 4) sprites.push(sprites[0]);
    });

    let heroVisible = true;
    resize();
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas);
    else window.addEventListener('resize', resize);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(entries => { heroVisible = entries[0].isIntersecting; }).observe(canvas);
    }
    gsap.ticker.add((time, delta) => {
      if (document.hidden || !sprites.length || !heroVisible) return;
      const step = Math.min(delta, 50) / 16.7;
      const velocity = scroller && Number.isFinite(scroller.velocity) ? scroller.velocity : 0;
      wind += (velocity - wind) * 0.06;
      context.clearRect(0, 0, width, height);
      petals.sort((a, b) => a.depth - b.depth);
      petals.forEach(petal => {
        petal.sway += 0.018 * step;
        petal.tiltX += petal.tiltXSpeed * step;
        petal.tiltY += petal.tiltYSpeed * step;
        petal.angle += petal.spin * step;
        petal.x += (petal.drift + Math.sin(petal.sway) * (0.4 + petal.depth * 0.6)) * step;
        petal.y += (petal.fall - wind * (0.15 + petal.depth * 0.35)) * step;
        if (petal.y > height + 60) spawn(petal, false);
        if (petal.y < -80) { spawn(petal, false); petal.y = height + 50; }
        if (petal.x > width + 60) petal.x = -40;
        draw(petal);
      });
    });
  }

  /* ---------- Shared helpers that also run without motion ---------- */
  // The header never hides. It tints a little after the hero, turns dark over the footer,
  // shows reading progress and marks the section in view.
  function setupHeader(scroller) {
    const footer = q('.site-footer');
    const nav = q('.desktop-nav');
    const indicator = q('.nav-indicator');
    const links = qa('.nav-link');
    const sections = links.map(link => document.getElementById(link.getAttribute('href').slice(1)));
    const progressBar = q('.nav-progress');
    let active = null;

    function moveIndicator(link) {
      if (!indicator) return;
      if (!link) { indicator.style.opacity = '0'; return; }
      indicator.style.width = `${link.offsetWidth}px`;
      indicator.style.transform = `translateX(${link.offsetLeft}px)`;
      indicator.style.opacity = '1';
    }

    const update = () => {
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - innerHeight;
      header.classList.toggle('is-scrolled', y > innerHeight * 0.5);
      const headerBottom = header.getBoundingClientRect().bottom;
      header.classList.toggle('on-dark', footer ? footer.getBoundingClientRect().top < headerBottom : false);
      if (progressBar) progressBar.style.setProperty('--progress', max > 0 ? String(Math.min(1, y / max)) : '0');
      // The section whose top has passed a line a third of the way down the screen.
      const line = innerHeight * 0.35;
      let current = null;
      sections.forEach((section, index) => {
        if (section && section.getBoundingClientRect().top <= line && section.getBoundingClientRect().bottom > line) current = links[index];
      });
      if (current !== active) {
        links.forEach(link => {
          const on = link === current;
          link.classList.toggle('is-active', on);
          if (on) link.setAttribute('aria-current', 'true'); else link.removeAttribute('aria-current');
        });
        active = current;
        moveIndicator(active);
      }
    };
    if (scroller) scroller.on('scroll', update);
    else window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', () => { moveIndicator(active); update(); });
    if (nav) nav.addEventListener('mouseleave', () => moveIndicator(active));
    update();
  }

  // Liquid glass: Chromium can refract the backdrop through an SVG filter. The displacement map is
  // drawn for the pill's real size: neutral grey inside, edges push the backdrop along the normal.
  function setupLiquidGlass(glass = q('.nav-glass'), image = q('#nav-glass-filter feImage'), radius = null) {
    const chromium = !!(navigator.userAgentData && navigator.userAgentData.brands &&
      navigator.userAgentData.brands.some(brand => /Chromium|Google Chrome|Microsoft Edge|Opera/.test(brand.brand)));
    if (!glass || !image || !chromium) return;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    let lastKey = '';

    function draw() {
      // Layout size, not the transformed box, so an opening animation does not distort the map.
      const w = Math.max(2, Math.round(glass.offsetWidth / 2));
      const h = Math.max(2, Math.round(glass.offsetHeight / 2));
      const key = `${w}x${h}`;
      if (key === lastKey) return;
      lastKey = key;
      canvas.width = w;
      canvas.height = h;
      const data = context.createImageData(w, h);
      const r = radius === null ? h / 2 : Math.min(h / 2, w / 2, radius / 2);
      const band = Math.min(h * 0.42, 14);
      const cx = w / 2;
      const cy = h / 2;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const px = x + 0.5 - cx;
          const py = y + 0.5 - cy;
          const qx = Math.abs(px) - (w / 2 - r);
          const qy = Math.abs(py) - (h / 2 - r);
          const ox = Math.max(qx, 0);
          const oy = Math.max(qy, 0);
          const outside = Math.hypot(ox, oy);
          const sdf = outside + Math.min(Math.max(qx, qy), 0) - r;
          const depth = -sdf;
          let dx = 0;
          let dy = 0;
          if (depth > 0 && depth < band) {
            let nx;
            let ny;
            if (qx > 0 && qy > 0) { nx = ox / (outside || 1); ny = oy / (outside || 1); }
            else if (qx > qy) { nx = 1; ny = 0; }
            else { nx = 0; ny = 1; }
            nx *= Math.sign(px) || 1;
            ny *= Math.sign(py) || 1;
            const t = 1 - depth / band;
            const strength = t * t;
            dx = nx * strength;
            dy = ny * strength;
          }
          const i = (y * w + x) * 4;
          data.data[i] = Math.round(128 + dx * 127);
          data.data[i + 1] = Math.round(128 + dy * 127);
          data.data[i + 2] = 128;
          data.data[i + 3] = 255;
        }
      }
      context.putImageData(data, 0, 0);
      image.setAttribute('href', canvas.toDataURL());
    }

    draw();
    document.documentElement.classList.add('liquid');
    if ('ResizeObserver' in window) new ResizeObserver(draw).observe(glass);
    else window.addEventListener('resize', draw);
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
    const panel = q('.menu-panel', menu);
    const inertTargets = [q('main'), q('.site-footer')];
    let open = false;

    // event.detail is 0 when a button is activated from the keyboard.
    toggle.addEventListener('click', event => (open ? closeMenu(true) : openMenu(event.detail === 0)));
    menu.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(true); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && open) closeMenu(true); });
    menu.addEventListener('click', event => {
      // A tap on the dimmed area outside the panel closes the menu.
      if (!event.target.closest('.menu-panel')) { closeMenu(false); return; }
      const link = event.target.closest('a[href^="#"]');
      if (link && !window.ranariLenis) closeMenu(false);
    });
    matchMedia('(min-width: 1000px)').addEventListener('change', event => { if (event.matches) closeMenu(false); });

    function openMenu(fromKeyboard) {
      open = true;
      menu.hidden = false;
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', 'Закрыть меню');
      document.documentElement.classList.add('menu-open');
      inertTargets.forEach(element => { if (element) element.inert = true; });
      window.ranariLenis?.stop();
      window.dispatchEvent(new Event('ranari:menu-open'));
      if (window.gsap && !reduce) {
        gsap.killTweensOf([menu, panel]);
        gsap.fromTo(menu, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: 'power2.out' });
        gsap.fromTo(panel, { scale: 0.86, y: -14, opacity: 0 }, { scale: 1, y: 0, opacity: 1, duration: 0.7, ease: 'expo.out' });
        gsap.fromTo(qa('.menu-nav a, .menu-cta, .menu-insta', menu), { y: 16, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.04, duration: 0.7, delay: 0.08, ease: 'expo.out' });
      }
      // Keyboard users land on the first link; a tap focuses the menu itself, so no focus ring shows.
      if (fromKeyboard) q('a', menu).focus({ preventScroll: true });
      else menu.focus({ preventScroll: true });
    }

    window.closeRanariMenu = (returnFocus) => {
      if (!open) return;
      open = false;
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Открыть меню');
      document.documentElement.classList.remove('menu-open');
      inertTargets.forEach(element => { if (element) element.inert = false; });
      window.ranariLenis?.start();
      const finish = () => { menu.hidden = true; };
      if (window.gsap && !reduce) {
        gsap.killTweensOf([menu, panel]);
        gsap.to(panel, { scale: 0.9, y: -10, opacity: 0, duration: 0.35, ease: 'power2.in' });
        gsap.to(menu, { opacity: 0, duration: 0.35, ease: 'power2.in', onComplete: finish });
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
