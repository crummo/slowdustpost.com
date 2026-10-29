(() => {
  const canvas = document.getElementById('dust');
  const ctx = canvas.getContext('2d', { alpha: false });
  const tcEl = document.getElementById('tc');
  const hintEl = document.getElementById('hint');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const BG = '#0b0a08';
  const TRAIL = 'rgba(11, 10, 8, 0.42)';
  // bone, amber, rust
  const COLORS = ['236,227,207', '222,170,98', '168,84,52'];
  const LEVELS = 12;

  // Wordmark candidates, previewed with ?font=<key> (see mockups/fonts.html).
  // `css` is the Google Fonts family spec; null means index.html already loads it.
  const FONTS = {
    unbounded: { family: 'Unbounded', weight: 800, css: 'Unbounded:wght@800', upper: true },
    anton: { family: 'Anton', weight: 400, css: 'Anton', upper: true },
    syne: { family: 'Syne', weight: 800, css: 'Syne:wght@800', upper: true },
    bricolage: { family: 'Bricolage Grotesque', weight: 800, css: 'Bricolage+Grotesque:opsz,wght@96,800', upper: false },
    fraunces: { family: 'Fraunces', weight: 900, css: 'Fraunces:opsz,wght@144,900', upper: false },
    gloock: { family: 'Gloock', weight: 400, css: 'Gloock', upper: false },
    tiltwarp: { family: 'Tilt Warp', weight: 400, css: 'Tilt+Warp', upper: true },
    // Monospaced: the corner credits' voice, at wordmark size.
    plexmono: { family: 'IBM Plex Mono', weight: 700, css: 'IBM+Plex+Mono:wght@700', upper: true },
    jetbrains: { family: 'JetBrains Mono', weight: 800, css: 'JetBrains+Mono:wght@800', upper: true },
    spacemono: { family: 'Space Mono', weight: 700, css: 'Space+Mono:wght@700', upper: true },
    martian: { family: 'Martian Mono', weight: 800, css: 'Martian+Mono:wght@800', upper: true },
    azeret: { family: 'Azeret Mono', weight: 900, css: 'Azeret+Mono:wght@900', upper: true },
    geistmono: { family: 'Geist Mono', weight: 900, css: 'Geist+Mono:wght@900', upper: true },
    // Grotesques: the free faces nearest Founders Grotesk (archivo, schibsted, familjen) and
    // Proxima Nova (hanken, intertight).
    archivo: { family: 'Archivo', weight: 800, css: 'Archivo:wght@800', upper: true },
    schibsted: { family: 'Schibsted Grotesk', weight: 800, css: null, upper: true },
    familjen: { family: 'Familjen Grotesk', weight: 700, css: 'Familjen+Grotesk:wght@700', upper: true },
    hanken: { family: 'Hanken Grotesk', weight: 800, css: 'Hanken+Grotesk:wght@800', upper: true },
    intertight: { family: 'Inter Tight', weight: 800, css: 'Inter+Tight:wght@800', upper: true },
    // Eighties: chrome, neon and arcade.
    orbitron: { family: 'Orbitron', weight: 900, css: 'Orbitron:wght@900', upper: true },
    audiowide: { family: 'Audiowide', weight: 400, css: 'Audiowide', upper: true },
    righteous: { family: 'Righteous', weight: 400, css: 'Righteous', upper: true },
    bungee: { family: 'Bungee', weight: 400, css: 'Bungee', upper: true },
    monoton: { family: 'Monoton', weight: 400, css: 'Monoton', upper: true },
    michroma: { family: 'Michroma', weight: 400, css: 'Michroma', upper: true },
  };
  const params = new URLSearchParams(location.search);
  // The wordmark changes face on each gather, through CYCLE (?cycle=a,b,c to choose; ?font=x
  // pins one). Every face in the cycle is loaded up front so a swap never waits on the network.
  const CYCLE = (params.get('cycle') || 'schibsted,martian,archivo,monoton,familjen')
    .split(',')
    .map((k) => FONTS[k])
    .filter(Boolean);
  const pinned = FONTS[params.get('font')];
  let WORD_FONT = pinned || CYCLE[0] || FONTS.schibsted;
  const cycling = !pinned && CYCLE.length > 1;
  let cycleIndex = 0;
  const fontAt = (size) => `${WORD_FONT.weight} ${size}px "${WORD_FONT.family}", sans-serif`;

  // Each word of the name can take its own style, previewed with ?slow=<key>&dust=<key>&post=<key>.
  // `scale` is its size relative to the main word; the words share a baseline. A style with
  // no family of its own uses the current wordmark face at a lighter weight.
  const WORD_STYLES = {
    light: { weight: 400, scale: 1 },
    regular: { weight: 500, scale: 1 },
    small: { scale: 0.55 },
    smalllight: { weight: 400, scale: 0.6 },
    mono: { family: 'IBM Plex Mono', weight: 500, css: null, scale: 0.42 },
    serif: { family: 'Fraunces', weight: 400, italic: true, css: 'Fraunces:ital,opsz,wght@1,144,400', scale: 1.05 },
  };
  for (const s of Object.values(WORD_STYLES)) {
    s.fontAt = (size) =>
      `${s.italic ? 'italic ' : ''}${s.weight || WORD_FONT.weight} ${size * s.scale}px "${s.family || WORD_FONT.family}", sans-serif`;
  }
  // The lockup: SLOW heavy, DUST and POST light. ?dust=heavy (any unknown key) resets a word.
  const WORD_STYLE = {};
  for (const [w, def] of [['slow', null], ['dust', WORD_STYLES.light], ['post', WORD_STYLES.light]]) {
    WORD_STYLE[w] = params.has(w) ? WORD_STYLES[params.get(w)] || null : def;
  }
  const STYLES_USED = [...new Set(Object.values(WORD_STYLE).filter(Boolean))];

  // Split a line into runs of one font: each styled word on its own, everything else (and the
  // spaces) in the main font.
  function runsFor(line) {
    const runs = [];
    for (const m of line.matchAll(/slow|dust|post|[^a-z]+/gi)) {
      const style = WORD_STYLE[m[0].toLowerCase()];
      const font = style ? style.fontAt : fontAt;
      const last = runs[runs.length - 1];
      if (last && last.font === font) last.text += m[0];
      else runs.push({ text: m[0], font });
    }
    return runs;
  }

  // Cycle timing (ms): dust drifts in, holds the word, gets blown away.
  // Hold and apart lengths live in `tune` (seconds) so the panel can change them.
  const GATHER = 7500;
  const GUST = 1700;

  // Live-tunable values. Press T (or load with ?tune) for the on-screen panel.
  const DEFAULTS = {
    // On the panel: the controls that change how the dust feels.
    pointerForce: 1, // how hard the pointer shoves dust; its reach grows with it too
    torch: 0.5, // how much the pointer lights the dust around it (0 = none)
    grip: 0.7, // how firmly the settled word is held (1 = solid)
    shed: 0.3, // how readily motes get knocked clean out of the word (0 = never)
    sparks: 1, // flash as a mote lands in the word (0 = none)
    speed: 1, // pace of the gather and the scatter (1 = as designed; 2 = twice as quick)
    motes: 1, // how much dust there is, in the word and in the air (1 = as designed)
    heldS: 9, // seconds the word stays together
    apartS: 5.5, // seconds it stays blown apart before gathering again
    // Fixed look calibration, not on the panel.
    streakMin: 2.4, // px/frame: speed at which dust starts to smear
    streakMax: 30, // px: longest streak
    flicker: 0.05, // projector lamp flicker depth (0 = steady)
    weave: 1.4, // px: film gate weave amplitude (0 = locked)
  };
  const tune = { ...DEFAULTS };
  // Reach of the pointer, in px: a harder shove also reaches further.
  const pointerRadius = () => 110 + 60 * tune.pointerForce;

  // Optional footage: a page can set window.SLOWDUST_FOOTAGE = [{ src, label }, ...] before this
  // script loads. The dust then takes its colour from whichever frame is being "projected",
  // moving to the next reel each time the word gathers. Sources must allow CORS.
  // With SLOWDUST_TINT = false the reels only drive the slate and the dust stays bone.
  const FOOTAGE = Array.isArray(window.SLOWDUST_FOOTAGE) ? window.SLOWDUST_FOOTAGE : null;
  const TINT = window.SLOWDUST_TINT !== false;
  const reelEl = document.getElementById('reel');
  const BONE = [236, 227, 207];
  const SAMPLE_W = 160;
  const sampleCanvas = document.createElement('canvas');
  const sctx = sampleCanvas.getContext('2d', { willReadFrequently: true });
  let reels = [];
  let reelIndex = -1;
  let sample = null;
  let sampleW = 0;
  let sampleH = 0;
  let frameCount = 0;
  const tintStyles = [];
  const tintBuckets = new Map();

  const STYLES = [];
  for (let c = 0; c < COLORS.length; c++) {
    for (let l = 0; l < LEVELS; l++) {
      STYLES.push(`rgba(${COLORS[c]},${((l + 0.6) / LEVELS).toFixed(3)})`);
    }
  }
  const buckets = STYLES.map(() => []);

  let W = 0;
  let H = 0;
  let dpr = 1;
  let particles = [];
  let phase = 'gather';
  // Phases run on simulated time so a throttled tab can't skip past the gather.
  let clock = 0;
  let phaseStart = 0;
  // While parked, the dust stays blown away instead of regathering. While formed into page
  // text (formedEls), it holds there: no scatter, no face change.
  let parked = false;
  let formedEls = null;
  let formedDraw = null;
  const formStack = [];
  // Once the real text has faded in over formed dust, the dust steps back to a faint trace so
  // the letters stay readable. Set by form(): the clock time the hand-over starts.
  let formHandoverAt = 0;
  const FORM_HANDOVER_MS = 1500;
  const FORM_TRACE = 0.12;
  // The corner credits: their dust gathers with every word, and this long into each gather the
  // real text appears (the page hides it until then) and the dust under it fades to a trace.
  const CORNER_HANDOVER = 2400;
  let cornersShown = false;
  // Whether the current targets include the corner credits (first load only).
  let cornersPlaced = false;
  let last = performance.now();
  const startedAt = performance.now();
  const pointer = { x: -1e4, y: -1e4, vx: 0, vy: 0, active: false };

  function makeParticle(x, y) {
    const r = Math.random();
    return {
      x, y, vx: 0, vy: 0,
      tx: null, ty: null,
      edge: 0, // 0 = deep inside a letter, 1 = on its outline
      free: 0, // ms left adrift after being knocked out of the word
      spark: 0, // brief flash as the mote lands in the word; `landed` stops it re-firing
      landed: false,
      delay: 0,
      size: 0.6 + Math.random() * Math.random() * 1.8,
      rs: 1, // size as drawn this frame (ambient dust scales with depth)
      sl: 0, // streak length this frame: fast dust smears along its motion like a long exposure
      base: 0.35 + Math.random() * 0.65,
      color: r < 0.86 ? 0 : r < 0.96 ? 1 : 2,
      gust: 0.6 + Math.random() * 0.8,
      twinkle: Math.random() * Math.PI * 2,
      // Tumble rate: a mote catches the light in a brief flash once per turn.
      spin: 0.0012 + Math.random() * 0.0035,
      // Depth for ambient dust (0 = far, 1 = at the lens); it creeps toward the camera and recycles.
      z: Math.random(),
      drift: 0.000025 + Math.random() * 0.00005,
      glow: 0,
      // How recently the pointer disturbed this particle (1 = just now); loosens its hold on the word.
      stir: 0,
      cr: BONE[0], cg: BONE[1], cb: BONE[2],
    };
  }

  function loadReel(reel) {
    const isVideo = /\.(mp4|webm|mov)(\?|$)/i.test(reel.src);
    return new Promise((resolve) => {
      const el = document.createElement(isVideo ? 'video' : 'img');
      el.crossOrigin = 'anonymous';
      const done = () => resolve({ ...reel, el, isVideo });
      if (isVideo) {
        Object.assign(el, { muted: true, loop: true, playsInline: true, preload: 'auto' });
        el.addEventListener('loadeddata', () => {
          el.play().catch(() => {});
          done();
        }, { once: true });
      } else {
        el.addEventListener('load', done, { once: true });
      }
      el.addEventListener('error', () => resolve(null), { once: true });
      el.src = reel.src;
    });
  }

  async function loadFootage() {
    reels = TINT ? (await Promise.all(FOOTAGE.map(loadReel))).filter(Boolean) : FOOTAGE;
  }

  function nextReel() {
    if (!reels.length) return;
    reelIndex = (reelIndex + 1) % reels.length;
    captureFrame();
    const reel = reels[reelIndex];
    if (reelEl) {
      reelEl.textContent = `${String(reelIndex + 1).padStart(2, '0')} — ${reel.label}`;
      if (reel.href) reelEl.href = reel.href;
    }
  }

  // Draw the current reel frame, cover-fit to the viewport, into a small canvas we can read from.
  function captureFrame() {
    const reel = reels[reelIndex];
    if (!TINT || !reel || !W || !H) return;
    const { el, isVideo } = reel;
    const iw = isVideo ? el.videoWidth : el.naturalWidth;
    const ih = isVideo ? el.videoHeight : el.naturalHeight;
    if (!iw || !ih) return;
    const sh = Math.max(1, Math.round((SAMPLE_W * H) / W));
    if (sampleW !== SAMPLE_W || sampleH !== sh) {
      sampleW = sampleCanvas.width = SAMPLE_W;
      sampleH = sampleCanvas.height = sh;
    }
    const scale = Math.max(sampleW / iw, sampleH / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    sctx.drawImage(el, (sampleW - dw) / 2, (sampleH - dh) / 2, dw, dh);
    try {
      sample = sctx.getImageData(0, 0, sampleW, sampleH).data;
    } catch (_) {
      sample = null; // tainted by a source without CORS; fall back to plain dust
    }
  }

  // Ease a particle's colour toward the frame beneath it. Letter dust is lifted toward bone
  // on dark frames so the word stays legible.
  function tint(p, ease) {
    const sx = Math.min(sampleW - 1, Math.max(0, ((p.x / W) * sampleW) | 0));
    const sy = Math.min(sampleH - 1, Math.max(0, ((p.y / H) * sampleH) | 0));
    const i = (sy * sampleW + sx) * 4;
    let r = sample[i] * 0.85 + BONE[0] * 0.15;
    let g = sample[i + 1] * 0.85 + BONE[1] * 0.15;
    let b = sample[i + 2] * 0.85 + BONE[2] * 0.15;
    if (p.tx !== null) {
      const floor = 0.7;
      const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      const k = Math.min(2.4, floor / Math.max(lum, 0.05));
      if (k > 1) {
        r = Math.min(255, r * k);
        g = Math.min(255, g * k);
        b = Math.min(255, b * k);
      }
      const lifted = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      if (lifted < floor) {
        const m = (floor - lifted) / (0.89 - lifted);
        r += (BONE[0] - r) * m;
        g += (BONE[1] - g) * m;
        b += (BONE[2] - b) * m;
      }
    }
    p.cr += (r - p.cr) * ease;
    p.cg += (g - p.cg) * ease;
    p.cb += (b - p.cb) * ease;
  }

  // Render the wordmark offscreen and sample it into target points.
  function sampleWord() {
    const off = document.createElement('canvas');
    off.width = W;
    off.height = H;
    const o = off.getContext('2d', { willReadFrequently: true });
    // Two lines, or three on phones so the letters stay large. ?lines=1 puts it on one line on
    // wide screens (two spaces: the font's own space is too tight at this size).
    const aspect = W / H;
    let lines =
      aspect >= 1.7 && params.get('lines') === '1' ? ['Slowdust  Post'] : aspect >= 1 ? ['Slowdust', 'Post'] : ['Slow', 'dust', 'Post'];
    if (WORD_FONT.upper) lines = lines.map((l) => l.toUpperCase());

    const lineWidth = (line, size) =>
      runsFor(line).reduce((w, r) => ((o.font = r.font(size)), w + o.measureText(r.text).width), 0);
    const widest = Math.max(...lines.map((l) => lineWidth(l, 100)));
    const size = Math.min(
      (100 * W * (lines.length > 1 ? 0.8 : 0.86)) / widest,
      H * [0.3, 0.24, 0.19][lines.length - 1],
    );
    o.textAlign = 'left';
    o.textBaseline = 'alphabetic';
    o.fillStyle = '#fff';
    const lh = size * 1.02;
    // Runs of different sizes sit on one baseline, placed so the main word's caps are centred.
    o.font = fontAt(size);
    const capRise = o.measureText('H').actualBoundingBoxAscent / 2;
    // How the shorter lines sit under the widest: centred, flush left or right, or stepped
    // in from the left (?align=center|left|right|stagger).
    const align = params.get('align') || 'dust';
    const widestAt = widest * (size / 100);
    // 'dust': later lines start exactly under the word "dust" on the first line.
    let dustX = null;
    lines.forEach((l, i) => {
      const y = H / 2 + (i - (lines.length - 1) / 2) * lh + capRise;
      const lw = lineWidth(l, size);
      let x = W / 2 - lw / 2;
      if (align === 'left') x = W / 2 - widestAt / 2;
      else if (align === 'right') x = W / 2 + widestAt / 2 - lw;
      else if (align === 'stagger' && i > 0) x = W / 2 - widestAt / 2 + widestAt * 0.22;
      else if (align === 'dust' && dustX !== null) x = dustX;
      if (align === 'dust' && dustX === null && /dust/i.test(l)) {
        const head = l.slice(0, l.toLowerCase().indexOf('dust'));
        dustX = x + (head ? lineWidth(head, size) : 0);
      }
      for (const r of runsFor(l)) {
        o.font = r.font(size);
        o.fillText(r.text, x, y);
        x += o.measureText(r.text).width;
      }
    });

    return withCorners(samplePoints(o));
  }

  // The corner credits are tiny, so they get their own, much finer grid of small motes: at the
  // wordmark's spacing a letter would be three specks and never read as text.
  function sampleCorners() {
    const off = document.createElement('canvas');
    off.width = W;
    off.height = H;
    const o = off.getContext('2d', { willReadFrequently: true });
    o.fillStyle = '#fff';
    drawText(o, cornerEls());
    const { points, gap } = samplePoints(o, 1.5);
    return points.map(([x, y, edge]) => [x, y, edge, 1, gap * (0.55 + Math.random() * 0.3)]);
  }

  // Only until the credits have been shown once: after that they are plain page text.
  function withCorners({ points, gap }) {
    cornersPlaced = !cornersShown;
    return cornersPlaced ? { points: points.concat(sampleCorners()), gap } : { points, gap };
  }

  // Dust can also settle into text that is already on the page: each text node is drawn
  // offscreen where it sits, in its own font, so the motes land exactly under the real letters.
  function drawText(o, els) {
    o.textAlign = 'left';
    o.textBaseline = 'middle';
    const range = document.createRange();
    for (const el of els) {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const text = node.textContent.trim();
        if (!text) continue;
        range.selectNodeContents(node);
        const r = range.getBoundingClientRect();
        if (!r.width || r.bottom < 0 || r.top > H) continue;
        const cs = getComputedStyle(node.parentElement);
        if (cs.visibility === 'hidden' || cs.display === 'none') continue;
        o.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        if ('letterSpacing' in o) o.letterSpacing = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing;
        o.fillText(cs.textTransform === 'uppercase' ? text.toUpperCase() : text, r.left, r.top + r.height / 2);
      }
    }
  }

  // The corner credits always get their share of dust, whatever else it is forming.
  const cornerEls = () => [...document.querySelectorAll('.corner')];

  function sampleElements(els, draw = null) {
    const off = document.createElement('canvas');
    off.width = W;
    off.height = H;
    const o = off.getContext('2d', { willReadFrequently: true });
    o.fillStyle = '#fff';
    drawText(o, els);
    if (draw) {
      o.save();
      o.fillStyle = o.strokeStyle = '#fff';
      draw(o);
      o.restore();
    }
    return withCorners(samplePoints(o));
  }

  // Turn whatever is drawn on an offscreen canvas into target points on a jittered grid.
  function samplePoints(o, fixedGap) {
    const data = o.getImageData(0, 0, W, H).data;
    const filled = (x, y) => data[((y | 0) * W + (x | 0)) * 4 + 3] > 140;

    // Pick a grid spacing that lands near the particle budget, unless one is given.
    let gap = fixedGap;
    if (!gap) {
      let area = 0;
      for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (filled(x, y)) area += 4;
      const budget = (W < 700 ? 4200 : 8500) * tune.motes;
      gap = Math.max(2.4, Math.sqrt(area / budget));
    }

    const points = [];
    for (let y = gap / 2; y < H; y += gap) {
      for (let x = gap / 2; x < W; x += gap) {
        const jx = x + (Math.random() - 0.5) * gap * 0.7;
        const jy = y + (Math.random() - 0.5) * gap * 0.7;
        if (jx >= 0 && jy >= 0 && jx < W && jy < H && filled(jx, jy)) {
          // How close to the letter's outline: count of empty neighbours a step away.
          const r = gap * 1.6;
          let open = 0;
          if (jx - r < 0 || !filled(jx - r, jy)) open++;
          if (jx + r >= W || !filled(jx + r, jy)) open++;
          if (jy - r < 0 || !filled(jx, jy - r)) open++;
          if (jy + r >= H || !filled(jx, jy + r)) open++;
          points.push([jx, jy, open / 4, 0]);
        }
      }
    }
    return { points, gap };
  }

  function setup() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    // A hidden or not-yet-laid-out viewport has no size; resize will call us again.
    if (!W || !H) {
      particles.length = 0;
      return;
    }
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (formedEls) placeTargets(sampleElements(formedEls, formedDraw));
    else placeWord();

    buildHaze();
    if (reelIndex >= 0) captureFrame();
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);
  }

  // Sample the wordmark in the current face and hand its points out as targets. Dust already in
  // the air keeps its place; only the counts and targets change.
  function placeWord() {
    placeTargets(sampleWord());
  }

  function placeTargets({ points, gap }) {
    // Fewer, bigger, slower motes read more like dust in a beam than a dense field.
    const ambient = Math.round(Math.min(720, (W * H) / 2600) * tune.motes);
    const total = points.length + ambient;

    while (particles.length < total) particles.push(makeParticle(Math.random() * W, Math.random() * H));
    particles.length = total;

    for (let i = 0; i < total; i++) {
      const p = particles[i];
      if (p.x < -20 || p.x > W + 20 || p.y < -20 || p.y > H + 20) {
        p.x = Math.random() * W;
        p.y = Math.random() * H;
      }
      p.landed = false;
      if (i < points.length) {
        let size;
        [p.tx, p.ty, p.edge, p.corner, size] = points[i];
        p.size = size || gap * (0.38 + Math.random() * 0.3);
        p.base = 0.6 + Math.random() * 0.4;
        // Settle in a loose left-to-right sweep, as if carried in on a breeze. Page text
        // (the list) is different: everything leaves at once and rushes in.
        p.delay = p.corner ? Math.random() * 400 : formedEls ? Math.random() * 1000 : (p.tx / W) * 1800 + Math.random() * 2600;
      } else {
        p.tx = p.ty = null;
        p.size = 0.6 + Math.random() * Math.random() * 1.8;
        p.base = 0.35 + Math.random() * 0.65;
      }
    }
  }

  // Each scatter is a different gust: a fresh direction, strength and length, so the cycle
  // never reads as a loop. Mostly sideways, sometimes an up-draught, now and then from above.
  const gust = { x: 1, y: -0.2, strength: 1, length: GUST };
  function newGust() {
    const r = Math.random();
    const a =
      r < 0.4 ? (Math.random() - 0.5) * 0.7 // from the left
      : r < 0.7 ? Math.PI + (Math.random() - 0.5) * 0.7 // from the right
      : r < 0.9 ? -Math.PI / 2 + (Math.random() - 0.5) * 1.2 // up-draught
      : Math.PI / 2 + (Math.random() - 0.5) * 0.8; // falling
    gust.x = Math.cos(a);
    gust.y = Math.sin(a);
    gust.strength = 0.7 + Math.random() * 0.8;
    gust.length = GUST * (0.75 + Math.random() * 0.7);
  }

  function setPhase(next, now) {
    phase = next;
    phaseStart = now;
    if (next === 'scatter') newGust();
    if (next === 'gather') {
      for (const p of particles) p.free = 0;
      if ((cycling || cornersPlaced) && !formedEls && W && H) {
        if (cycling) {
          cycleIndex = (cycleIndex + 1) % CYCLE.length;
          WORD_FONT = CYCLE[cycleIndex];
        }
        // Also drops the corner motes after the first load.
        placeWord();
      }
      nextReel();
    }
  }

  // Knock a letter mote out of the word: it drifts as plain dust for a while, then gets
  // pulled back. `kick` scales the shove it leaves with.
  function knockFree(p, kick) {
    p.free = 4000 + Math.random() * 9000;
    p.stir = 1;
    const a = Math.random() * Math.PI * 2;
    p.vx += Math.cos(a) * kick * (0.5 + Math.random());
    p.vy += Math.sin(a) * kick * (0.5 + Math.random()) - kick * 0.4;
  }

  function flowAngle(x, y, t) {
    return (
      Math.sin(x * 0.0021 + t * 0.00013) +
      Math.sin(y * 0.0017 - t * 0.00011) +
      Math.sin((x + y) * 0.0009 + t * 0.00007)
    ) * 1.7;
  }

  // A slow-swaying projector beam from the top-left; dust inside it catches the light.
  function beamAt(t) {
    const ox = W * 0.06;
    const oy = -H * 0.18;
    const a = Math.atan2(H * 0.72, W * 0.48) + Math.sin(t * 0.00011) * 0.07;
    return { ox, oy, dx: Math.cos(a), dy: Math.sin(a) };
  }

  // Beam width at distance `along` from the lamp; shared by the haze and the dust lighting.
  const beamWidth = (along) => 60 + along * 0.3;

  // Pre-render the beam's haze as a small soft-edged image, stretched and rotated each frame.
  let haze = null;
  let hazeL = 0;
  let hazeHalf = 0;
  function buildHaze() {
    hazeL = Math.hypot(W, H) * 1.4;
    hazeHalf = beamWidth(hazeL) * 1.9;
    const hw = 256;
    const hh = 128;
    haze = document.createElement('canvas');
    haze.width = hw;
    haze.height = hh;
    const h = haze.getContext('2d');
    const img = h.createImageData(hw, hh);
    for (let y = 0; y < hh; y++) {
      for (let x = 0; x < hw; x++) {
        const along = (x / hw) * hazeL;
        const perp = ((y + 0.5) / hh - 0.5) * 2 * hazeHalf;
        const w = beamWidth(along);
        const v = Math.exp(-(perp * perp) / (w * w)) * Math.pow(1 - x / hw, 0.9);
        const i = (y * hw + x) * 4;
        img.data[i] = 240;
        img.data[i + 1] = 222;
        img.data[i + 2] = 186;
        img.data[i + 3] = Math.round(v * 255);
      }
    }
    h.putImageData(img, 0, 0);
  }

  function drawHaze(b) {
    ctx.save();
    ctx.globalAlpha = 0.045 * lamp;
    ctx.translate(b.ox, b.oy);
    ctx.rotate(Math.atan2(b.dy, b.dx));
    ctx.drawImage(haze, 0, -hazeHalf, hazeL, hazeHalf * 2);
    ctx.restore();
  }

  // On-screen size of an ambient mote at its depth: far dust is a fine speck, near dust a little
  // larger and softer in brightness.
  const depthSize = (p) => p.size * (0.6 + p.z * 1.1);
  // Near dust dims a touch; freshly recycled dust fades in at the back and out again as it
  // passes the lens.
  function depthAlpha(p) {
    const edge = p.z < 0.1 ? p.z / 0.1 : p.z > 0.9 ? (1 - p.z) / 0.1 : 1;
    return edge * (1 - 0.4 * p.z * p.z);
  }

  // The near layer slides a little against the pointer; the far layer barely moves.
  const par = { x: 0, y: 0 };
  const PARALLAX = 28;

  // Projector lamp: brightness wanders a little frame to frame, like an arc lamp or a worn
  // shutter. A smoothed random walk, so it flutters rather than strobes.
  let flickNoise = 0;
  let lamp = 1;
  function stepLamp(f) {
    flickNoise += (Math.random() - 0.5 - flickNoise) * Math.min(1, 0.35 * f);
    lamp = 1 + tune.flicker * flickNoise * 2.4;
  }

  // Film gate weave: the whole frame drifts a couple of pixels on slow, unrelated periods,
  // with a hair of frame-to-frame jitter.
  function weaveAt(t) {
    const a = tune.weave;
    if (!a) return { x: 0, y: 0 };
    return {
      x: a * (Math.sin(t * 0.00071) * 0.7 + Math.sin(t * 0.0019 + 1.3) * 0.3) + (Math.random() - 0.5) * a * 0.18,
      y: a * (Math.sin(t * 0.00053 + 2.1) * 0.7 + Math.sin(t * 0.0023 + 0.4) * 0.3) + (Math.random() - 0.5) * a * 0.18,
    };
  }

  function step(now) {
    // Nothing is set up until the viewport has a size (see setup).
    if (!W || !H) {
      last = now;
      return;
    }
    const dt = Math.min(now - last, 50);
    last = now;
    clock += dt;
    const f = dt / 16.667;
    let pt = clock - phaseStart;

    // Speed scales the gather: its staggered start, the spring ramp, the pull, and the window.
    const speed = tune.speed;
    // Forming into page text is a rush, not the slow drift of the wordmark: the dust has to
    // visibly fly into the letters before the real text shows up over it.
    const rush = speed * 2.5;
    const gspeed = formedEls ? rush : speed;
    if (!cornersShown && pt > CORNER_HANDOVER) showCorners();
    if (phase === 'gather' && pt > GATHER / gspeed) setPhase('hold', clock);
    else if (phase === 'hold' && pt > tune.heldS * 1000 && !formedEls) setPhase('scatter', clock);
    else if (phase === 'scatter' && pt > tune.apartS * 1000 && !parked) setPhase('gather', clock);
    pt = clock - phaseStart;

    const freeDamp = Math.pow(0.975, f);
    const boundDamp = Math.pow(0.86, f);
    const glowEase = 1 - Math.pow(0.96, f);
    const stirDecay = Math.pow(0.99, f);
    const sparkDecay = Math.pow(0.9, f);
    // ...and the scatter: a quicker gust is also a harder one.
    const gustLen = gust.length / speed;
    const wind = phase === 'scatter' && pt < gustLen ? Math.sin((Math.PI * pt) / gustLen) * gust.strength * speed : 0;
    // Capped so a pointer jump (tab switch, touch) can't blast the whole word apart.
    const pSpeed = Math.min(30, Math.hypot(pointer.vx, pointer.vy));
    const POINTER_R = pointerRadius();
    const R2 = POINTER_R * POINTER_R;
    const b = beamAt(now);
    const tintEase = 1 - Math.pow(0.94, f);

    if (reels[reelIndex]?.isVideo && frameCount++ % 2 === 0) captureFrame();

    const parEase = 1 - Math.pow(0.96, f);
    const parTx = pointer.active ? -((pointer.x - W / 2) / W) * PARALLAX : 0;
    const parTy = pointer.active ? -((pointer.y - H / 2) / H) * PARALLAX : 0;
    par.x += (parTx - par.x) * parEase;
    par.y += (parTy - par.y) * parEase;

    const holding = phase === 'hold';
    // Chance per frame that a held mote simply lets go, weighted toward letter outlines.
    const shedRate = holding ? tune.shed * 0.00003 * f : 0;

    for (const p of particles) {
      if (p.free > 0) p.free -= dt;
      // Corner-credit dust rushes hardest, so it is in place before the credits fade in.
      const ps = p.corner ? rush * 1.6 : gspeed;
      let bound = p.tx !== null && p.free <= 0 && (holding || (phase === 'gather' && pt > p.delay / ps));
      const ambient = p.tx === null;

      if (bound && shedRate && Math.random() < shedRate * (0.2 + p.edge)) {
        knockFree(p, 0.6);
        bound = false;
      }

      // Ambient dust creeps toward the lens; past it, it is reborn at the back of the room.
      let depth = 1;
      if (ambient) {
        p.z += p.drift * dt;
        if (p.z > 1) {
          p.z = 0;
          p.x = Math.random() * W;
          p.y = Math.random() * H;
          p.vx = p.vy = 0;
          p.size = 0.6 + Math.random() * Math.random() * 1.8;
        }
        depth = 0.45 + p.z * 1.3;
      }

      const a = flowAngle(p.x, p.y, now);
      const flow = (bound ? 0.012 : 0.009) * depth;
      p.vx += Math.cos(a) * flow * f;
      p.vy += Math.sin(a) * flow * f;
      if (ambient) {
        // Warm air rising, plus a little Brownian jitter so no mote moves in a clean line.
        p.vy -= 0.004 * depth * f;
        p.vx += (Math.random() - 0.5) * 0.03 * depth * f;
        p.vy += (Math.random() - 0.5) * 0.03 * depth * f;
      }

      if (bound) {
        const ramp = phase === 'gather' ? Math.min(1, ((pt - p.delay / ps) * ps) / 2600) : 1;
        // Looseness: the word never quite hardens. Outline dust is held more weakly than the
        // body of a letter, and everything keeps a faint wander.
        const loose = (1 - tune.grip) * (0.3 + 0.7 * p.edge);
        // Stirred dust lets go of the word for a moment, then settles back.
        const k = (0.0007 + 0.02 * ramp * ramp) * (1 - 0.9 * p.stir) * (1 - 0.85 * loose) * (holding ? 1 : ps);
        p.vx += (p.tx - p.x) * k * f;
        p.vy += (p.ty - p.y) * k * f;
        if (loose) {
          p.vx += (Math.random() - 0.5) * 0.5 * loose * f;
          p.vy += (Math.random() - 0.5) * 0.5 * loose * f;
        }
      }

      if (wind) {
        // Along the gust, with a touch of lift so a sideways blow still floats the dust.
        p.vx += (0.15 * gust.x) * wind * p.gust * f;
        p.vy += (0.15 * gust.y - 0.03) * wind * p.gust * f;
      }

      if (pointer.active) {
        const dx = p.x - pointer.x;
        const dy = p.y - pointer.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < R2) {
          const d = Math.sqrt(d2) || 1;
          const s = 1 - d / POINTER_R;
          const push = s * s * (bound ? 2.0 : 1.2) * (1 + pSpeed * 0.06) * tune.pointerForce * f;
          // Shoved outward, and dragged along in the pointer's wake.
          const drag = s * 0.075 * tune.pointerForce;
          p.vx += (dx / d) * push + pointer.vx * drag;
          p.vy += (dy / d) * push + pointer.vy * drag;
          if (s > p.stir) p.stir = s;
          // A hard enough hit knocks a few motes clean out of the word.
          if (bound && s > 0.45 && Math.random() < tune.shed * 0.035 * s * (0.5 + p.edge) * f) {
            knockFree(p, 1.5);
            p.vx += (dx / d) * 1.5 * tune.pointerForce;
            p.vy += (dy / d) * 1.5 * tune.pointerForce;
            bound = false;
          }
        }
      }

      const damp = bound ? boundDamp + (freeDamp - boundDamp) * p.stir : freeDamp;
      p.vx *= damp;
      p.vy *= damp;
      p.stir *= stirDecay;

      const max = bound ? (2.6 + 6.5 * p.stir) * (holding ? 1 : ps) : 9 * depth * Math.max(1, speed);
      const sp = Math.hypot(p.vx, p.vy);
      if (sp > max) {
        p.vx *= max / sp;
        p.vy *= max / sp;
      }

      p.x += p.vx * f;
      p.y += p.vy * f;

      if (!bound) {
        const m = ambient ? 12 + depthSize(p) : 12;
        if (p.x > W + m) p.x = -m;
        else if (p.x < -m) p.x = W + m;
        if (p.y > H + m) p.y = -m;
        else if (p.y < -m) p.y = H + m;
      }

      // First touch-down on its spot in the word: a brief spark, once per landing.
      if (bound) {
        if (!p.landed && Math.abs(p.x - p.tx) + Math.abs(p.y - p.ty) < 2.5 && Math.hypot(p.vx, p.vy) < 1.2) {
          p.landed = true;
          p.spark = 1;
        }
      } else {
        p.landed = false;
      }
      if (p.spark) p.spark = p.spark > 0.01 ? p.spark * sparkDecay : 0;

      p.glow += ((bound ? 1 : 0) - p.glow) * glowEase;
      if (sample) tint(p, tintEase);
    }

    pointer.vx *= 0.8;
    pointer.vy *= 0.8;

    stepLamp(f);
    draw(now, b);
  }

  function draw(now, b) {
    ctx.fillStyle = TRAIL;
    ctx.fillRect(0, 0, W, H);
    const wv = weaveAt(now);
    ctx.save();
    ctx.translate(wv.x, wv.y);
    drawHaze(b);

    const tinted = sample !== null;
    for (const bucket of tinted ? tintBuckets.values() : buckets) bucket.length = 0;

    // The pointer doubles as a hand torch: dust near it catches a little extra light.
    const torchOn = pointer.active && tune.torch > 0;
    const torchR2 = Math.pow(pointerRadius() * 2, 2);

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const ambient = p.tx === null;
      const rx = p.x - b.ox;
      const ry = p.y - b.oy;
      const along = rx * b.dx + ry * b.dy;
      const perp = -rx * b.dy + ry * b.dx;
      const w = beamWidth(along);
      const lit = along > 0 ? Math.exp(-(perp * perp) / (w * w)) : 0;

      const g = p.glow;
      // A slow breathe, plus a sharp glint once per tumble, strongest where the beam hits.
      const s = Math.sin(now * p.spin + p.twinkle);
      const glint = s > 0 ? Math.pow(s, 14) : 0;
      const tw = 0.85 + 0.15 * s;
      let alpha = p.base * tw * (0.12 + 0.78 * g + lit * (0.85 - 0.5 * g));
      alpha += p.base * glint * (1 - g) * (0.25 + 1.4 * lit);
      let torch = 0;
      if (torchOn) {
        const dx = p.x - pointer.x;
        const dy = p.y - pointer.y;
        const d2 = dx * dx + dy * dy;
        // Lit dust is already near full alpha, so the torch also swells the motes (below),
        // which reads as brightness where alpha has no headroom left.
        if (d2 < torchR2) torch = tune.torch * Math.exp(-d2 / (torchR2 * 0.3));
        alpha += (p.base + 0.4) * torch * 2 * (1 - 0.4 * g);
      }
      alpha *= lamp;

      let color = p.color;
      if (ambient) {
        alpha *= depthAlpha(p);
        p.rs = depthSize(p);
      } else {
        p.rs = p.size;
        if (formedEls) {
          const t = Math.min(1, Math.max(0, (clock - formHandoverAt) / FORM_HANDOVER_MS));
          alpha *= 1 - (1 - FORM_TRACE) * t;
        } else if (p.corner) {
          // Bright while it flies in, a trace once the text is there, dust again when it scatters.
          const t =
            phase === 'gather' ? Math.min(1, Math.max(0, (clock - phaseStart - CORNER_HANDOVER) / FORM_HANDOVER_MS))
            : phase === 'hold' ? 1
            : 0;
          alpha *= 1 - (1 - FORM_TRACE) * t;
        }
        if (p.spark && tune.sparks) {
          // Flash on landing, like a struck match. Settled dust is already near full
          // brightness, so the flash is mostly a swell in size, amber at its peak.
          const s = p.spark * tune.sparks;
          p.rs = p.size * (1 + 2.4 * s);
          alpha = Math.max(alpha, 0.6 + 0.4 * s);
          if (p.spark > 0.4) color = 1;
        }
      }
      if (torch) p.rs *= 1 + 0.9 * torch;

      // Anything moving quickly smears into a streak, and its light thins out along it.
      const sp = Math.hypot(p.vx, p.vy);
      p.sl = sp > tune.streakMin ? Math.min(tune.streakMax, (sp - tune.streakMin) * 3.2) : 0;
      if (p.sl) alpha *= Math.max(0.4, 1 - p.sl / 44);

      if (tinted) {
        // Footage colours can't share a few fixed styles, so quantise to 4 bits per channel,
        // premultiplied against the dark ground.
        const a = Math.min(1, alpha);
        const key = (((p.cr * a) >> 4) << 8) | (((p.cg * a) >> 4) << 4) | ((p.cb * a) >> 4);
        if (!key) continue;
        let bucket = tintBuckets.get(key);
        if (!bucket) tintBuckets.set(key, (bucket = []));
        bucket.push(i);
      } else {
        const level = Math.min(LEVELS - 1, (alpha * LEVELS) | 0);
        buckets[color * LEVELS + level].push(i);
      }
    }

    if (tinted) {
      for (const [key, bucket] of tintBuckets) {
        if (!bucket.length) continue;
        tintStyles[key] ||= `rgb(${(key >> 8) * 17},${((key >> 4) & 15) * 17},${(key & 15) * 17})`;
        fillBucket(tintStyles[key], bucket);
      }
    } else {
      for (let s = 0; s < buckets.length; s++) {
        if (buckets[s].length) fillBucket(STYLES[s], buckets[s]);
      }
    }
    ctx.restore();
  }

  function fillBucket(style, bucket) {
    ctx.fillStyle = style;
    ctx.beginPath();
    for (const i of bucket) {
      const p = particles[i];
      const px = p.tx === null ? p.x + par.x * p.z : p.x;
      const py = p.tx === null ? p.y + par.y * p.z : p.y;
      if (p.sl < 0.5) {
        // Squares are cheapest and read as dots at dust size; anything bigger (a spark, a mote
        // in the spotlight) would show its corners, so it gets a proper disc.
        if (p.rs < 3) ctx.rect(px - p.rs / 2, py - p.rs / 2, p.rs, p.rs);
        else {
          ctx.moveTo(px + p.rs / 2, py);
          ctx.arc(px, py, p.rs / 2, 0, Math.PI * 2);
        }
        continue;
      }
      // A thin quad trailing behind the mote along its velocity.
      const sp = Math.hypot(p.vx, p.vy);
      const ux = p.vx / sp;
      const uy = p.vy / sp;
      const hx = -uy * (p.rs / 2);
      const hy = ux * (p.rs / 2);
      const tx = px - ux * p.sl;
      const ty = py - uy * p.sl;
      ctx.moveTo(px + hx, py + hy);
      ctx.lineTo(px - hx, py - hy);
      ctx.lineTo(tx - hx, ty - hy);
      ctx.lineTo(tx + hx, ty + hy);
      ctx.closePath();
    }
    ctx.fill();
  }

  // Timecode at 24fps from a 01:00:00:00 program start.
  function updateTimecode(now) {
    const frames = Math.floor(((now - startedAt) / 1000) * 24);
    const ff = frames % 24;
    const total = Math.floor(frames / 24);
    const ss = total % 60;
    const mm = Math.floor(total / 60) % 60;
    const hh = 1 + Math.floor(total / 3600);
    const pad = (n) => String(n).padStart(2, '0');
    tcEl.textContent = `${pad(hh)}:${pad(mm)}:${pad(ss)}:${pad(ff)}`;
  }

  function loop(now) {
    step(now);
    updateTimecode(now);
    requestAnimationFrame(loop);
  }

  function renderStill() {
    setup();
    if (reelIndex < 0) nextReel();
    for (const p of particles) {
      if (p.tx !== null) {
        p.x = p.tx;
        p.y = p.ty;
        p.glow = 1;
      }
      if (sample) tint(p, 1);
    }
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);
    const now = performance.now();
    draw(now, beamAt(0));
  }

  // Click or Space: blow the word apart if it is standing, call it back if it is scattered.
  function toggleWord() {
    if (parked || formedEls) return;
    setPhase(phase === 'scatter' ? 'gather' : 'scatter', clock);
  }

  // The opening hint fades on first interaction, then lives on as an easter egg: invisible at the
  // bottom of the screen until the pointer wanders over it, when it shows the hint again with a
  // "Controls" link (so the panel can be found without a keyboard).
  let hintDone = false;
  function dismissHint() {
    if (hintDone) return;
    hintDone = true;
    hintEl.classList.add('gone');
    setTimeout(() => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = 'Controls';
      b.dataset.ui = '';
      b.style.cssText =
        'font:inherit;letter-spacing:inherit;text-transform:inherit;color:var(--ink);' +
        'background:none;border:0;padding:0;cursor:pointer;';
      b.addEventListener('click', toggleTunePanel);
      hintEl.replaceChildren(`${hintEl.textContent.replace(/\s*·\s*T for controls$/, '')} · `, b);
      hintEl.dataset.ui = '';
      hintEl.classList.add('secret');
      hintEl.classList.remove('gone');
    }, 1700);
  }

  function onPointerMove(e) {
    if (pointer.active) {
      pointer.vx = e.clientX - pointer.x;
      pointer.vy = e.clientY - pointer.y;
    }
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.active = true;
  }

  function onPointerLeave() {
    pointer.active = false;
    pointer.x = pointer.y = -1e4;
  }

  // Lets an overlay blow the dust aside and bring it back.
  window.slowdust = {
    get parked() {
      return parked;
    },
    get face() {
      return WORD_FONT.family;
    },
    clear() {
      parked = true;
      if (phase !== 'scatter') setPhase('scatter', clock);
    },
    // Gather the dust into the given elements' text (measured where they sit now) and hold it
    // there until restore().
    // `handoverMs` is when, after forming starts, the dust fades back to let the text read.
    // `draw(ctx)` may add any shape in CSS pixels (the player's frame) alongside the text.
    // Forms nest: restore() returns the dust to whatever it was forming before, if anything.
    form(els, handoverMs = 1600, draw = null) {
      if (formedEls) formStack.push({ els: formedEls, draw: formedDraw });
      beginForm([...els], draw, handoverMs);
    },
    restore() {
      const prev = formStack.pop();
      if (prev) {
        // Its text is already on screen, so the dust goes straight to a trace.
        beginForm(prev.els, prev.draw, 0);
        return;
      }
      const wasFormed = formedEls !== null;
      formedEls = null;
      formedDraw = null;
      parked = false;
      if (wasFormed && W && H) placeWord();
      setPhase('gather', clock);
    },
  };

  function beginForm(els, draw, handoverMs) {
    formedEls = els;
    formedDraw = draw;
    formHandoverAt = clock + handoverMs;
    parked = false;
    if (W && H) placeTargets(sampleElements(formedEls, formedDraw));
    setPhase('gather', clock);
  }

  // On-screen sliders for the values in `tune`. Toggled with T, or open on load with ?tune.
  // Ranges run well past the designed values: these are for play, not fine tuning.
  const TUNE_UI = [
    ['pointerForce', 'pointer', 0, 6, 0.05],
    ['torch', 'spotlight', 0, 4, 0.05],
    ['grip', 'grip', 0, 1, 0.05],
    ['shed', 'shedding', 0, 3, 0.05],
    ['sparks', 'sparks', 0, 4, 0.05],
    ['speed', 'speed', 0.1, 5, 0.05],
    ['motes', 'motes', 0.2, 3, 0.05],
  ];
  // The motes count only takes effect on a re-sample; wait for the slider to settle.
  let resampleT;
  function resample() {
    clearTimeout(resampleT);
    resampleT = setTimeout(setup, 200);
  }
  let tunePanel = null;
  function toggleTunePanel() {
    if (tunePanel) {
      tunePanel.hidden = !tunePanel.hidden;
      return;
    }
    tunePanel = document.createElement('div');
    tunePanel.dataset.ui = '';
    tunePanel.style.cssText =
      'position:fixed;left:16px;top:72px;z-index:4;padding:12px 14px;' +
      'background:rgba(11,10,8,.82);border:1px solid rgba(236,227,207,.18);border-radius:4px;' +
      'font:11px/1.6 "IBM Plex Mono",ui-monospace,monospace;color:#ece3cf;letter-spacing:.04em;' +
      'display:grid;grid-template-columns:auto 120px auto;gap:2px 10px;align-items:center;' +
      'user-select:none;';
    const rows = [];
    for (const [key, label, min, max, stp] of TUNE_UI) {
      const name = document.createElement('span');
      name.textContent = label;
      name.style.opacity = '.7';
      const input = document.createElement('input');
      Object.assign(input, { type: 'range', min, max, step: stp, value: tune[key] });
      input.style.cssText = 'accent-color:#deaa62;width:120px;margin:0;';
      const val = document.createElement('span');
      val.textContent = tune[key];
      val.style.minWidth = '4ch';
      input.addEventListener('input', () => {
        tune[key] = Number(input.value);
        val.textContent = input.value;
        if (key === 'motes') resample();
      });
      rows.push({ key, input, val });
      tunePanel.append(name, input, val);
    }
    const foot = document.createElement('span');
    foot.style.cssText = 'grid-column:1/-1;margin-top:6px;display:flex;gap:14px;align-items:center;';
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.textContent = 'Reset';
    reset.style.cssText =
      'font:inherit;color:#deaa62;background:none;border:1px solid rgba(222,170,98,.5);' +
      'border-radius:3px;padding:1px 8px;cursor:pointer;';
    reset.addEventListener('click', () => {
      const motes = tune.motes;
      Object.assign(tune, DEFAULTS);
      for (const { key, input, val } of rows) {
        input.value = tune[key];
        val.textContent = tune[key];
      }
      if (motes !== tune.motes) resample();
    });
    const note = document.createElement('span');
    note.textContent = 'T to hide';
    note.style.opacity = '.4';
    foot.append(reset, note);
    tunePanel.append(foot);
    document.body.append(tunePanel);
  }
  window.addEventListener('keydown', (e) => {
    if ((e.key === 't' || e.key === 'T') && !e.metaKey && !e.ctrlKey && !e.altKey) toggleTunePanel();
  });
  if (params.has('tune')) toggleTunePanel();

  async function loadWordFont() {
    // Every face the cycle can show, in its heavy weight and the 400 the light words use.
    const faces = pinned ? [pinned] : CYCLE;
    const faceCss = faces
      .filter((f) => f.css !== null)
      .map((f) => `${f.family.replace(/ /g, '+')}:wght@${[...new Set([400, f.weight])].sort().join(';')}`);
    const css = [...new Set([...faceCss, ...STYLES_USED.map((s) => s.css)].filter(Boolean))];
    if (css.length) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?${css.map((c) => `family=${c}`).join('&')}&display=block`;
      await new Promise((r) => {
        link.onload = link.onerror = r;
        document.head.append(link);
      });
    }
    const current = WORD_FONT;
    for (const f of faces) {
      WORD_FONT = f;
      await document.fonts.load(fontAt(100), 'Slowdust');
      await Promise.all(STYLES_USED.map((s) => document.fonts.load(s.fontAt(100), 'Slowdust')));
    }
    WORD_FONT = current;
  }

  // The page hides the corner credits (html.dust-forming) until the dust has drawn them once.
  function showCorners() {
    cornersShown = true;
    document.documentElement.classList.remove('dust-forming');
  }
  // Whatever happens to the dust (fonts stalling, a background tab), the credits must appear.
  setTimeout(() => cornersShown || showCorners(), 8000);

  async function start() {
    try {
      await Promise.race([
        Promise.all([loadWordFont(), FOOTAGE && loadFootage()]),
        new Promise((r) => setTimeout(r, 5000)),
      ]);
    } catch (_) {
      // Fall back to the system sans.
    }

    if (matchMedia('(pointer: coarse)').matches) hintEl.textContent = 'Touch to disturb · Tap to scatter or gather';

    if (reduceMotion) {
      showCorners();
      renderStill();
      updateTimecode(performance.now());
      setInterval(() => updateTimecode(performance.now()), 1000 / 24);
      let t;
      window.addEventListener('resize', () => {
        clearTimeout(t);
        t = setTimeout(renderStill, 150);
      });
      return;
    }

    setup();
    nextReel();
    let t;
    window.addEventListener('resize', () => {
      clearTimeout(t);
      t = setTimeout(setup, 150);
    });

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', (e) => {
      onPointerMove(e);
      dismissHint();
      if (!e.target.closest('a, button, [data-ui]')) toggleWord();
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === ' ' && !e.target.closest('input, textarea, [data-ui]')) {
        e.preventDefault();
        dismissHint();
        toggleWord();
      }
    });
    document.addEventListener('pointerleave', onPointerLeave);
    window.addEventListener('pointerup', (e) => {
      if (e.pointerType !== 'mouse') onPointerLeave();
    });
    setTimeout(dismissHint, 9000);

    last = performance.now();
    requestAnimationFrame(loop);
  }

  start();
})();
