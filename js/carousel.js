/* Shared rails keep the active card reachable by touch, mouse and keyboard. */
function setupCarousel(rail) {
  const viewport = rail.querySelector('[data-viewport]');
  const track = rail.querySelector('[data-track]');
  const cards = [...track.children];
  const previous = rail.querySelector('[data-prev]');
  const next = rail.querySelector('[data-next]');
  const pagination = rail.querySelector('[data-dots]');
  const position = rail.querySelector('[data-position]');
  const status = rail.querySelector('[data-status]');
  // Continuous progress adapted from the 21st Appica Carousel Progress demo.
  const progress = document.createElement('span');
  progress.className = 'rail-progress';
  progress.setAttribute('aria-hidden', 'true');
  position.before(progress);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const names = cards.map(card => card.dataset.slideName || card.querySelector('h3')?.textContent.trim());
  let active = 0;
  let x = 0;
  let velocity = 0;
  let frame = null;
  let offsets = [];
  let cardWidth = 1;
  let gesture = null;

  const dots = cards.map((_, index) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'rail-dot';
    dot.setAttribute('aria-label', names[index] || `${rail.dataset.label} ${index + 1}`);
    dot.addEventListener('click', () => select(index));
    pagination.append(dot);
    return dot;
  });

  function paint(nextX) {
    x = nextX;
    track.style.transform = `translate3d(${x}px, 0, 0)`;
    const travel = offsets[0] - offsets.at(-1);
    const fraction = travel > 0 ? Math.min(1, Math.max(0, (offsets[0] - x) / travel)) : 0;
    progress.style.setProperty('--rail-progress', String((1 + fraction * (cards.length - 1)) / cards.length));
    cards.forEach((card, index) => {
      const distance = (offsets[index] - x) / cardWidth;
      const depth = Math.min(1, Math.abs(distance));
      card.style.visibility = Math.abs(distance) > 2 ? 'hidden' : '';
      if (!reducedMotion.matches) {
        card.style.transform = `translateY(${depth * 6}px) scale(${1 - depth * .07})`;
        card.style.opacity = String(1 - depth * .12);
      }
    });
  }

  function stopSpring() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
  }

  function snap() {
    stopSpring();
    velocity = 0;
    paint(offsets[active]);
  }

  function measure() {
    const available = viewport.clientWidth;
    cardWidth = cards[0].offsetWidth || 1;
    offsets = cards.map(card => (available - card.offsetWidth) / 2 - card.offsetLeft);
    viewport.scrollLeft = 0;
    snap();
  }

  function updateSelection(announce) {
    position.textContent = `${active + 1} / ${cards.length}`;
    previous.setAttribute('aria-disabled', String(active === 0));
    next.setAttribute('aria-disabled', String(active === cards.length - 1));
    dots.forEach((dot, index) => {
      dot.tabIndex = index === active ? 0 : -1;
      dot.setAttribute('aria-current', String(index === active));
    });
    cards.forEach((card, index) => {
      card.classList.toggle('active', index === active);
      card.inert = index !== active;
    });
    if (announce) {
      const name = names[active] || rail.dataset.label;
      status.textContent = `${name}. ${active + 1} из ${cards.length}`;
    }
  }

  function springTo(target, releaseVelocity = velocity) {
    stopSpring();
    if (reducedMotion.matches) {
      snap();
      return;
    }
    const response = .38;
    const frequency = 2 * Math.PI / response;
    const damping = Math.abs(releaseVelocity) > 250 ? .85 : 1;
    velocity = releaseVelocity;
    let last = performance.now();

    function step(now) {
      const elapsed = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      velocity += (frequency ** 2 * (target - x) - 2 * damping * frequency * velocity) * elapsed;
      paint(x + velocity * elapsed);
      if (Math.abs(target - x) < .3 && Math.abs(velocity) < 4) {
        frame = null;
        snap();
      } else {
        frame = requestAnimationFrame(step);
      }
    }

    frame = requestAnimationFrame(step);
  }

  function select(index, releaseVelocity) {
    if (!offsets.length || index < 0 || index >= cards.length) return;
    const changed = active !== index;
    active = index;
    updateSelection(changed);
    if (changed || Math.abs(x - offsets[active]) > .3) springTo(offsets[active], releaseVelocity);
  }

  function resist(value) {
    const min = offsets.at(-1);
    const max = offsets[0];
    const boundary = Math.max(min, Math.min(max, value));
    const overshoot = value - boundary;
    const width = viewport.clientWidth || 1;
    return boundary + (overshoot * width * .55) / (width + Math.abs(overshoot) * .55);
  }

  viewport.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0 || event.target.closest('a, button')) return;
    gesture = { id: event.pointerId, startX: event.clientX, startY: event.clientY, x, samples: [], dragging: false };
  });

  viewport.addEventListener('pointermove', event => {
    if (gesture?.id !== event.pointerId) return;
    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;
    if (!gesture.dragging) {
      if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) {
        gesture = null;
        return;
      }
      if (Math.abs(dx) < 8) return;
      stopSpring();
      velocity = 0;
      gesture.x = x - Math.sign(dx) * 8;
      gesture.dragging = true;
      viewport.classList.add('dragging');
      viewport.setPointerCapture(event.pointerId);
    }
    paint(resist(gesture.x + dx));
    const now = performance.now();
    gesture.samples.push({ x: event.clientX, time: now });
    gesture.samples = gesture.samples.filter(sample => now - sample.time < 100);
  });

  function finish(event, cancelled = false) {
    if (gesture?.id !== event.pointerId) return;
    const drag = gesture;
    gesture = null;
    viewport.classList.remove('dragging');
    if (!drag.dragging) {
      if (cancelled || frame !== null) return;
      const currentCard = cards[active].getBoundingClientRect();
      const bounds = viewport.getBoundingClientRect();
      if (event.clientX < currentCard.left && event.clientX > bounds.left) select(active - 1);
      if (event.clientX > currentCard.right && event.clientX < bounds.right) select(active + 1);
      return;
    }
    const recent = drag.samples.filter(sample => performance.now() - sample.time < 100);
    const first = recent[0];
    const last = recent.at(-1);
    const elapsed = first && last ? last.time - first.time : 0;
    const speed = !cancelled && elapsed > 0 ? ((last.x - first.x) * 1000) / elapsed : 0;
    const releaseVelocity = Math.max(-1800, Math.min(1800, speed));
    const projected = x + (releaseVelocity / 1000) * .996 / (1 - .996);
    const closest = offsets.reduce((best, offset, index) =>
      Math.abs(offset - projected) < Math.abs(offsets[best] - projected) ? index : best, active);
    select(cancelled ? active : closest, releaseVelocity);
  }

  viewport.addEventListener('pointerup', event => finish(event));
  viewport.addEventListener('pointercancel', event => finish(event, true));
  viewport.addEventListener('pointerleave', event => {
    if (gesture?.id === event.pointerId && !gesture.dragging) gesture = null;
  });
  viewport.addEventListener('lostpointercapture', event => {
    if (event.target === viewport) finish(event, true);
  });
  viewport.addEventListener('focusin', () => {
    viewport.scrollLeft = 0;
    snap();
  });
  previous.addEventListener('click', () => select(active - 1));
  next.addEventListener('click', () => select(active + 1));
  pagination.addEventListener('keydown', event => {
    const keys = { ArrowLeft: active - 1, ArrowRight: active + 1, Home: 0, End: cards.length - 1 };
    const index = keys[event.key];
    if (!Number.isInteger(index)) return;
    event.preventDefault();
    if (!dots[index]) return;
    select(index);
    dots[index].focus();
  });
  reducedMotion.addEventListener('change', () => {
    cards.forEach(card => {
      card.style.removeProperty('transform');
      card.style.removeProperty('opacity');
    });
    snap();
  });

  rail.classList.add('ready');
  measure();
  updateSelection(false);
  if ('ResizeObserver' in window) new ResizeObserver(measure).observe(viewport);
  else window.addEventListener('resize', measure);
}
