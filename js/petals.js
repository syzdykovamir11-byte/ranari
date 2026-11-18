// Hero petals. Each of the four petal photos is turned into a small 3D model: a dense mesh cut out by
// the photo's alpha and bent into a cup, a curl, a twist or a fold along the midrib. WebGL lights the
// bent surface, so a petal brightens and darkens as it turns, and its underside reads paler.
// The fall itself (speed, sway, spin, wind from scrolling) is the same as the earlier 2D version.
// Without WebGL the flat 2D sprites are drawn instead.
(() => {
  // cup, tip curl, twist along the length, fold along the midrib. Each copies the shape in its photo.
  const MODELS = [
    { texture: 'assets/petals/t1.png', sprite: 'assets/petals/p1.png', shape: [0.26, 0.12, 0.0, 0.03] },
    { texture: 'assets/petals/t2.png', sprite: 'assets/petals/p2.png', shape: [0.12, 0.22, 1.15, 0.0] },
    { texture: 'assets/petals/t3.png', sprite: 'assets/petals/p3.png', shape: [0.14, 0.07, 0.0, 0.11] },
    { texture: 'assets/petals/t4.png', sprite: 'assets/petals/p4.png', shape: [0.3, 0.14, 0.25, 0.0] }
  ];
  const GRID = 28;

  const VERTEX = `
    attribute vec2 aPos;
    uniform mat3 uRot;
    uniform vec2 uCenter;
    uniform vec2 uView;
    uniform float uSize;
    uniform vec4 uShape;
    uniform float uFlex;
    uniform float uLayer;
    varying vec2 vUv;
    varying vec3 vNormal;

    vec3 bend(vec2 p) {
      float t = p.y + 0.5;                       // 0 at the base, 1 at the tip
      float x = p.x;
      float z = uShape.x * 4.0 * x * x * (0.35 + t);
      z += uShape.y * uFlex * t * t;
      z += uShape.w * sqrt(x * x + 0.002);
      float a = uShape.z * (t - 0.5) * uFlex;
      float c = cos(a), s = sin(a);
      return vec3(c * x - s * z, p.y, s * x + c * z);
    }

    void main() {
      vec3 p = bend(aPos);
      float e = 0.012;
      vec3 dx = bend(aPos + vec2(e, 0.0)) - bend(aPos - vec2(e, 0.0));
      vec3 dy = bend(aPos + vec2(0.0, e)) - bend(aPos - vec2(0.0, e));
      vNormal = uRot * normalize(cross(dx, dy));
      vec3 w = uRot * p;
      float persp = 3.2 / (3.2 - w.z);
      vec2 screen = uCenter + vec2(w.x, -w.y) * uSize * persp;
      gl_Position = vec4(screen.x / uView.x * 2.0 - 1.0, 1.0 - screen.y / uView.y * 2.0, uLayer - w.z * 0.02, 1.0);
      vUv = vec2(aPos.x + 0.5, 0.5 - aPos.y);
    }`;

  const FRAGMENT = `
    precision mediump float;
    uniform sampler2D uTex;
    uniform float uBias;
    uniform float uAlpha;
    varying vec2 vUv;
    varying vec3 vNormal;

    void main() {
      vec4 tex = texture2D(uTex, vUv, uBias);
      if (tex.a < 0.03) discard;
      vec3 n = normalize(vNormal);
      // The photos are a little grey; bring the sakura pink back before lighting.
      float luma = dot(tex.rgb, vec3(0.299, 0.587, 0.114));
      vec3 colour = mix(vec3(luma), tex.rgb, 1.45) * vec3(1.04, 0.97, 1.0);
      if (n.z < 0.0) {
        // The underside: paler, and the light from the front shows through it.
        n = -n;
        colour = mix(colour, vec3(1.0, 0.93, 0.95), 0.32);
      }
      vec3 light = normalize(vec3(-0.45, 0.65, 0.62));
      float diffuse = max(dot(n, light), 0.0);
      float sheen = pow(max(dot(reflect(-light, n), vec3(0.0, 0.0, 1.0)), 0.0), 16.0) * 0.14;
      float rim = pow(1.0 - n.z, 2.0) * 0.1;
      vec3 shaded = colour * (0.8 + 0.32 * diffuse) + sheen + vec3(1.0, 0.8, 0.85) * rim;
      float a = tex.a * uAlpha;
      gl_FragColor = vec4(shaded * a, a);
    }`;

  function setupPetals(canvas, scroller, ticker) {
    if (!canvas) return;
    const petals = [];
    let width = 0;
    let height = 0;
    let wind = 0;
    let heroVisible = true;
    const renderer = createGL(canvas) || create2D(canvas);
    if (!renderer) return;

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
      petal.flutter = Math.random() * Math.PI * 2;
      petal.model = Math.floor(Math.random() * MODELS.length);
      petal.alpha = 0.55 + depth * 0.45;
      return petal;
    }

    function resize() {
      const ratio = Math.min(devicePixelRatio || 1, 2);
      width = canvas.clientWidth || innerWidth;
      height = canvas.clientHeight || innerHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      renderer.resize(width, height, ratio);
      const wanted = width < 700 ? 12 : 22;
      while (petals.length < wanted) petals.push(spawn({}, true));
      petals.length = wanted;
    }

    resize();
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas);
    else window.addEventListener('resize', resize);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(entries => { heroVisible = entries[0].isIntersecting; }).observe(canvas);
    }

    ticker.add((time, delta) => {
      if (document.hidden || !heroVisible || !renderer.ready()) return;
      const step = Math.min(delta, 50) / 16.7;
      const velocity = scroller && Number.isFinite(scroller.velocity) ? scroller.velocity : 0;
      wind += (velocity - wind) * 0.06;
      petals.sort((a, b) => a.depth - b.depth);
      petals.forEach(petal => {
        petal.sway += 0.018 * step;
        petal.flutter += (0.05 + petal.tiltXSpeed) * step;
        petal.tiltX += petal.tiltXSpeed * step;
        petal.tiltY += petal.tiltYSpeed * step;
        petal.angle += petal.spin * step;
        petal.x += (petal.drift + Math.sin(petal.sway) * (0.4 + petal.depth * 0.6)) * step;
        petal.y += (petal.fall - wind * (0.15 + petal.depth * 0.35)) * step;
        if (petal.y > height + 60) spawn(petal, false);
        if (petal.y < -80) { spawn(petal, false); petal.y = height + 50; }
        if (petal.x > width + 60) petal.x = -40;
      });
      renderer.draw(petals);
    });
  }

  function loadImage(src) {
    const image = new Image();
    image.src = src;
    return (image.decode ? image.decode() : new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
    })).then(() => image);
  }

  // Rz(angle) * Rx(tiltX) * Ry(tiltY), column-major for WebGL.
  function rotation(petal, out) {
    const ca = Math.cos(petal.angle), sa = Math.sin(petal.angle);
    const cx = Math.cos(petal.tiltX), sx = Math.sin(petal.tiltX);
    const cy = Math.cos(petal.tiltY), sy = Math.sin(petal.tiltY);
    // Rx * Ry
    const m00 = cy, m01 = 0, m02 = sy;
    const m10 = sx * sy, m11 = cx, m12 = -sx * cy;
    const m20 = -cx * sy, m21 = sx, m22 = cx * cy;
    // Rz * (Rx * Ry), rows r0..r2
    const r00 = ca * m00 - sa * m10, r01 = ca * m01 - sa * m11, r02 = ca * m02 - sa * m12;
    const r10 = sa * m00 + ca * m10, r11 = sa * m01 + ca * m11, r12 = sa * m02 + ca * m12;
    out[0] = r00; out[1] = r10; out[2] = m20;
    out[3] = r01; out[4] = r11; out[5] = m21;
    out[6] = r02; out[7] = r12; out[8] = m22;
    return out;
  }

  function createGL(canvas) {
    let gl = null;
    try {
      const options = { alpha: true, premultipliedAlpha: true, antialias: true, depth: true };
      gl = canvas.getContext('webgl', options) || canvas.getContext('experimental-webgl', options);
    } catch (error) { gl = null; }
    if (!gl) return null;

    const compile = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
    };
    const vertex = compile(gl.VERTEX_SHADER, VERTEX);
    const fragment = compile(gl.FRAGMENT_SHADER, FRAGMENT);
    if (!vertex || !fragment) return null;
    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
    gl.useProgram(program);

    // One shared grid; the shader bends it per model and the texture alpha cuts out the outline.
    const positions = [];
    for (let j = 0; j <= GRID; j++) {
      for (let i = 0; i <= GRID; i++) positions.push(i / GRID - 0.5, 0.5 - j / GRID);
    }
    const indices = [];
    for (let j = 0; j < GRID; j++) {
      for (let i = 0; i < GRID; i++) {
        const a = j * (GRID + 1) + i;
        indices.push(a, a + 1, a + GRID + 1, a + 1, a + GRID + 2, a + GRID + 1);
      }
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const u = {};
    ['uRot', 'uCenter', 'uView', 'uSize', 'uShape', 'uFlex', 'uLayer', 'uTex', 'uBias', 'uAlpha']
      .forEach(name => { u[name] = gl.getUniformLocation(program, name); });
    gl.uniform1i(u.uTex, 0);

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    const textures = [];
    let loaded = false;
    let lost = false;
    canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); lost = true; });
    Promise.all(MODELS.map(model => loadImage(model.texture))).then(images => {
      images.forEach(image => {
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        textures.push(texture);
      });
      loaded = true;
    }).catch(() => {});

    const matrix = new Float32Array(9);
    const count = indices.length;
    return {
      ready: () => loaded && !lost,
      resize(width, height) {
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.uniform2f(u.uView, width, height);
      },
      draw(petals) {
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        petals.forEach(petal => {
          const model = MODELS[petal.model];
          gl.bindTexture(gl.TEXTURE_2D, textures[petal.model]);
          gl.uniformMatrix3fv(u.uRot, false, rotation(petal, matrix));
          gl.uniform2f(u.uCenter, petal.x, petal.y);
          gl.uniform1f(u.uSize, petal.size * 1.3);
          gl.uniform4fv(u.uShape, model.shape);
          gl.uniform1f(u.uFlex, 1 + 0.35 * Math.sin(petal.flutter));
          gl.uniform1f(u.uLayer, 0.9 - petal.depth * 1.8);
          // Petals close to the camera fall out of focus.
          gl.uniform1f(u.uBias, petal.depth > 0.86 ? 1.6 : 0);
          gl.uniform1f(u.uAlpha, petal.alpha);
          gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, 0);
        });
      }
    };
  }

  // Flat fallback: the photos are squashed on two axes to fake the tumble.
  function create2D(canvas) {
    const context = canvas.getContext && canvas.getContext('2d');
    if (!context) return null;
    const sprites = [];
    Promise.all(MODELS.map(model => loadImage(model.sprite).catch(() => null))).then(images => {
      images.forEach(image => {
        if (!image) return;
        const back = document.createElement('canvas');
        back.width = image.naturalWidth;
        back.height = image.naturalHeight;
        const backContext = back.getContext('2d');
        backContext.drawImage(image, 0, 0);
        backContext.globalCompositeOperation = 'source-atop';
        backContext.fillStyle = 'rgba(255, 236, 238, .42)';
        backContext.fillRect(0, 0, back.width, back.height);
        sprites.push({ front: image, back, ratio: image.naturalHeight / image.naturalWidth });
      });
      while (sprites.length && sprites.length < MODELS.length) sprites.push(sprites[0]);
    });
    let width = 0;
    let height = 0;
    return {
      ready: () => sprites.length > 0,
      resize(w, h, ratio) {
        width = w;
        height = h;
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
      },
      draw(petals) {
        context.clearRect(0, 0, width, height);
        petals.forEach(petal => {
          const sprite = sprites[petal.model];
          const scaleX = Math.cos(petal.tiltY);
          const scaleY = Math.cos(petal.tiltX);
          const facing = scaleX * scaleY;
          const w = petal.size;
          const h = petal.size * sprite.ratio;
          context.save();
          context.translate(petal.x, petal.y);
          context.rotate(petal.angle);
          context.scale(Math.sign(scaleX || 1) * Math.max(0.12, Math.abs(scaleX)), Math.max(0.12, Math.abs(scaleY)));
          context.globalAlpha = petal.alpha * (0.7 + 0.3 * Math.abs(facing));
          context.drawImage(facing < 0 ? sprite.back : sprite.front, -w / 2, -h / 2, w, h);
          context.restore();
        });
      }
    };
  }

  window.setupPetals = setupPetals;
})();
