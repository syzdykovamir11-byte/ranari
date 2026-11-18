// LED sign like the ones over Japanese shop fronts: the line of text is rasterised at one pixel
// per diode, scrolled column by column, scaled up onto the screen, cut into round diodes by a
// mask and given a soft glow. Scrolling the page pushes the text faster.
(() => {
  const SEGMENTS = [
    ['日本語', 'ja'],
    ['Разговорный японский', 'ru'],
    ['JLPT N5–N1', 'ru'],
    ['Группы и индивидуально', 'ru'],
    ['夢', 'ja']
  ];
  const COLORS = { ja: '#ff6f9c', ru: '#ffb648', sep: '#ff4a3d' };
  const ROWS = 18;
  const FONT = "700 15px 'Golos Text', 'Hiragino Sans', 'Yu Gothic', 'Noto Sans JP', system-ui, sans-serif";

  function buildStrip() {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.font = FONT;
    const parts = [];
    SEGMENTS.forEach(([text, kind]) => {
      parts.push([text, kind]);
      parts.push(['  ◆  ', 'sep']);
    });
    const width = Math.ceil(parts.reduce((sum, [text]) => sum + context.measureText(text).width, 0));
    canvas.width = width;
    canvas.height = ROWS;
    context.font = FONT;
    context.textBaseline = 'middle';
    let x = 0;
    parts.forEach(([text, kind]) => {
      context.fillStyle = COLORS[kind];
      context.fillText(text, x, ROWS / 2 + 1);
      x += context.measureText(text).width;
    });
    const data = context.getImageData(0, 0, width, ROWS).data;
    // Hard threshold: a diode is either on in its colour or off.
    const lit = new Uint8ClampedArray(width * ROWS * 4);
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 110) {
        lit[i] = data[i]; lit[i + 1] = data[i + 1]; lit[i + 2] = data[i + 2]; lit[i + 3] = 255;
      }
    }
    return { width, lit };
  }

  function setupLed(root, getVelocity, ticker, reduce) {
    const canvas = root && root.querySelector('.led-canvas');
    if (!canvas || !canvas.getContext) return;
    const context = canvas.getContext('2d');
    const low = document.createElement('canvas');
    const lowContext = low.getContext('2d');
    const work = document.createElement('canvas');
    const workContext = work.getContext('2d');
    let strip = null;
    let frame = null;
    let cols = 0;
    let pitch = 6;
    let offX = 0;
    let offY = 0;
    let offset = 0;
    let visible = true;
    let base = null;
    let mask = null;

    function resize() {
      const ratio = Math.min(devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) return;
      canvas.width = Math.round(w * ratio);
      canvas.height = Math.round(h * ratio);
      work.width = canvas.width;
      work.height = canvas.height;
      pitch = Math.max(3, Math.floor(canvas.height / (ROWS + 2)));
      cols = Math.ceil(canvas.width / pitch) + 1;
      offX = 0;
      offY = Math.round((canvas.height - ROWS * pitch) / 2);
      low.width = cols;
      low.height = ROWS;
      frame = lowContext.createImageData(cols, ROWS);
      const radius = pitch * 0.36;
      // Unlit diodes, drawn once.
      base = document.createElement('canvas');
      base.width = canvas.width;
      base.height = canvas.height;
      const b = base.getContext('2d');
      b.fillStyle = 'rgba(120, 60, 40, .16)';
      // The cut-out that turns square pixels into round diodes.
      mask = document.createElement('canvas');
      mask.width = canvas.width;
      mask.height = canvas.height;
      const m = mask.getContext('2d');
      m.fillStyle = '#fff';
      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < cols; col++) {
          const cx = offX + col * pitch + pitch / 2;
          const cy = offY + row * pitch + pitch / 2;
          b.beginPath(); b.arc(cx, cy, radius, 0, Math.PI * 2); b.fill();
          m.beginPath(); m.arc(cx, cy, radius * 1.08, 0, Math.PI * 2); m.fill();
        }
      }
      draw();
    }

    function draw() {
      if (!strip || !frame) return;
      const pixels = frame.data;
      const start = Math.floor(offset);
      for (let col = 0; col < cols; col++) {
        const source = ((start + col) % strip.width + strip.width) % strip.width;
        for (let row = 0; row < ROWS; row++) {
          const s = (row * strip.width + source) * 4;
          const d = (row * cols + col) * 4;
          pixels[d] = strip.lit[s]; pixels[d + 1] = strip.lit[s + 1]; pixels[d + 2] = strip.lit[s + 2]; pixels[d + 3] = strip.lit[s + 3];
        }
      }
      lowContext.putImageData(frame, 0, 0);
      const w = canvas.width;
      const h = canvas.height;
      const sw = cols * pitch;
      const sh = ROWS * pitch;
      context.globalCompositeOperation = 'source-over';
      context.globalAlpha = 1;
      context.clearRect(0, 0, w, h);
      context.drawImage(base, 0, 0);
      // Glow: the low-resolution frame stretched with smoothing.
      context.globalCompositeOperation = 'lighter';
      context.imageSmoothingEnabled = true;
      context.globalAlpha = 0.45;
      context.drawImage(low, offX, offY - pitch * 0.5, sw, sh + pitch);
      // Sharp diodes.
      workContext.globalCompositeOperation = 'source-over';
      workContext.clearRect(0, 0, w, h);
      workContext.imageSmoothingEnabled = false;
      workContext.drawImage(low, offX, offY, sw, sh);
      workContext.globalCompositeOperation = 'destination-in';
      workContext.drawImage(mask, 0, 0);
      context.globalAlpha = 1;
      context.drawImage(work, 0, 0);
    }

    const ready = document.fonts && document.fonts.load ? document.fonts.load(FONT, 'ЯJ日').catch(() => {}) : Promise.resolve();
    ready.then(() => {
      strip = buildStrip();
      resize();
      root.classList.add('is-on');
    });
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas);
    else window.addEventListener('resize', resize);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(entries => { visible = entries[0].isIntersecting; }).observe(canvas);
    }
    if (reduce) return;

    let boost = 0;
    const step = delta => {
      if (!visible || document.hidden || !strip) return;
      const velocity = Math.abs(getVelocity ? getVelocity() : 0);
      boost += (Math.min(velocity, 60) - boost) * 0.08;
      // About 22 diodes per second at rest; scrolling speeds it up.
      offset += (22 + boost * 4) * Math.min(delta, 50) / 1000;
      draw();
    };
    if (ticker) ticker.add((time, delta) => step(delta));
    else {
      let last = performance.now();
      const loop = now => { step(now - last); last = now; requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    }
  }

  window.setupLed = setupLed;
})();
