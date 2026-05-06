/**
 * ACT I · DIRECTOR'S CUT — build 20260506-1020
 * The Meaningful World
 *
 * One file, one director. Everything — the scroll loop, the two canvas
 * intelligences, narration, petals, Earth camera — choreographed as a
 * pure function of smoothed scroll progress `t ∈ [0, 1]`.
 *
 * No CSS keyframe timers drive the neural animations. Every dot and every
 * line inside the two intelligences is computed from t. Scroll forward →
 * the brain grows and the neural net computes. Scroll back → both reverse
 * exactly. This is the fix for the "the animation isn't scroll-controlled"
 * complaint.
 */

console.info('[act1 director] build 20260506-1020');

// ─── Tiny math kit ─────────────────────────────────────────────────────────

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp  = (a, b, t) => a + (b - a) * t;
const range = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const smoothstep = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const easeOutCubic  = t => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = t => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2;
const easeOutQuint  = t => 1 - Math.pow(1 - t, 5);

function smoothDamp(current, target, velRef, smoothTime, dt) {
  if (smoothTime <= 0) return target;
  const omega = 2 / smoothTime;
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48*x*x + 0.235*x*x*x);
  const change = current - target;
  const temp = (velRef.v + omega * change) * dt;
  velRef.v = (velRef.v - omega * temp) * exp;
  return target + (change + temp) * exp;
}

// Deterministic tiny PRNG so rebuilds look identical between reloads
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6D2B79F5) | 0;
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}


// ─── Starfield ─────────────────────────────────────────────────────────────
// Quiet parallax stars behind everything, so the "void" reads as deep space
// instead of flat black. Slow breath on twinkle, subtle drift.

const stars = (() => {
  const canvas = document.getElementById('stars-canvas');
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, dpr = 1;
  let list = [];

  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width  = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width  = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seed();
  }

  function seed() {
    const rng = mulberry32(4242);
    const count = Math.floor((w * h) / 9000);
    list = [];
    for (let i = 0; i < count; i++) {
      list.push({
        x: rng() * w,
        y: rng() * h,
        r: rng() * 1.1 + 0.2,
        tw: rng() * Math.PI * 2,
        twSpeed: 0.4 + rng() * 0.8,
        parallax: 0.2 + rng() * 0.8,
      });
    }
  }

  function render(time, t) {
    ctx.clearRect(0, 0, w, h);
    const now = time * 0.001;
    for (const s of list) {
      const tw = 0.55 + 0.45 * Math.sin(now * s.twSpeed + s.tw);
      ctx.globalAlpha = tw * (0.5 + 0.5 * (1 - t * 0.2)); // dim slightly as Earth appears
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  window.addEventListener('resize', size);
  size();
  return { render };
})();


// ─── Inner intelligence · the dendritic brain ────────────────────────────
// Grows like a plant from a seed. Each "generation" of dendrites branches
// outward. As scroll progress t rises from 0 → 1, more of the tree is drawn.
// Connections fire with a soft traveling spark along each edge near its
// reveal time. Scroll back → everything un-draws symmetrically.

const InnerBrain = (() => {
  const canvas = document.getElementById('inner-canvas');
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, dpr = 1;

  const nodes = [];  // { x, y, r, gen, parent, tReveal }
  const edges = [];  // { from, to, tReveal, tPeak }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = rect.width;
    h = rect.height;
    canvas.width  = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function build() {
    nodes.length = 0;
    edges.length = 0;
    if (w === 0) return;

    const rng = mulberry32(1337);
    const cx = w * 0.5, cy = h * 0.5;

    // Seed node — the root of thought. Awakens first.
    nodes.push({ x: cx, y: cy, r: 3.4, gen: 0, parent: -1, tReveal: 0 });

    // 4 generations of branching. Each branch child lives a little later
    // in the tReveal timeline so growth feels sequential.
    const GENERATIONS = 4;
    const TOTAL_T = 0.95; // leave a tail so the last edges fire at the peak
    const genSpan = TOTAL_T / GENERATIONS;

    // First ring of trunk branches — 6 directions, roughly evenly spaced.
    const trunkCount = 6;
    const trunkR = Math.min(w, h) * 0.12;
    const trunkAngleJitter = 0.35;
    for (let i = 0; i < trunkCount; i++) {
      const a = (i / trunkCount) * Math.PI * 2 + (rng() - 0.5) * trunkAngleJitter;
      const x = cx + Math.cos(a) * trunkR * (0.8 + rng() * 0.4);
      const y = cy + Math.sin(a) * trunkR * (0.8 + rng() * 0.4);
      nodes.push({ x, y, r: 2.6, gen: 1, parent: 0, tReveal: rng() * genSpan * 0.5 });
    }

    // Subsequent generations — each node in generation N spawns 1–3
    // children at generation N+1, extending outward.
    const radiusByGen = [
      0,
      Math.min(w, h) * 0.12,
      Math.min(w, h) * 0.22,
      Math.min(w, h) * 0.33,
      Math.min(w, h) * 0.42,
    ];

    for (let gen = 2; gen <= GENERATIONS; gen++) {
      const parents = nodes.filter(n => n.gen === gen - 1);
      const genStart = (gen - 1) * genSpan;
      const genEnd   = gen * genSpan;

      for (const parent of parents) {
        const childCount = 1 + Math.floor(rng() * 2.6); // 1..3
        const parentAngle = Math.atan2(parent.y - cy, parent.x - cx);
        for (let k = 0; k < childCount; k++) {
          // Child extends roughly outward from the center, but with a
          // meaningful wobble so it looks organic, not radial spokes.
          const angleWobble = (rng() - 0.5) * 0.9;
          const a = parentAngle + angleWobble;
          const targetR = radiusByGen[gen] * (0.85 + rng() * 0.3);
          const x = cx + Math.cos(a) * targetR;
          const y = cy + Math.sin(a) * targetR;

          // Keep nodes inside a circular mask so they don't spill past the ring.
          const dx = x - cx, dy = y - cy;
          const d = Math.hypot(dx, dy);
          const maxR = Math.min(w, h) * 0.46;
          const fx = d > maxR ? cx + dx * (maxR / d) : x;
          const fy = d > maxR ? cy + dy * (maxR / d) : y;

          const childIdx = nodes.length;
          nodes.push({
            x: fx, y: fy,
            r: lerp(2.4, 1.3, (gen - 1) / (GENERATIONS - 1)),
            gen,
            parent: nodes.indexOf(parent),
            tReveal: genStart + rng() * (genEnd - genStart) * 0.85,
          });

          // Edge parent → child
          edges.push({
            from: nodes.indexOf(parent),
            to: childIdx,
            tReveal: genStart + rng() * (genEnd - genStart) * 0.7,
            tPeak: 0.25, // how long the synapse spark travels along the edge
          });
        }
      }
    }

    // Add a few lateral "association" edges between sibling nodes — these
    // are the cross-connections that make a brain feel like a network,
    // not a tree. They fire in the last generation of reveal.
    const laterals = Math.floor(nodes.length * 0.22);
    for (let i = 0; i < laterals; i++) {
      const a = nodes[Math.floor(rng() * nodes.length)];
      const b = nodes[Math.floor(rng() * nodes.length)];
      if (a === b) continue;
      if (a.gen < 2 || b.gen < 2) continue;
      if (Math.abs(a.gen - b.gen) > 1) continue;
      const dx = a.x - b.x, dy = a.y - b.y;
      const d = Math.hypot(dx, dy);
      if (d > Math.min(w, h) * 0.2) continue;
      edges.push({
        from: nodes.indexOf(a),
        to: nodes.indexOf(b),
        tReveal: 0.55 + rng() * 0.35,
        tPeak: 0.3,
      });
    }
  }

  function render(time, t) {
    if (w === 0) return;
    ctx.clearRect(0, 0, w, h);

    // Soft warm base haze inside the circle
    const cx = w * 0.5, cy = h * 0.5;
    const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(w, h) * 0.5);
    bg.addColorStop(0, `rgba(255, 196, 138, ${0.06 + 0.08 * t})`);
    bg.addColorStop(1, 'rgba(255, 196, 138, 0)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // ─── Edges ───
    for (const e of edges) {
      const a = nodes[e.from];
      const b = nodes[e.to];
      const local = range(t, e.tReveal, e.tReveal + e.tPeak);
      if (local <= 0) continue;
      const drawT = easeOutCubic(local);
      const x2 = lerp(a.x, b.x, drawT);
      const y2 = lerp(a.y, b.y, drawT);

      // Base line — warm amber, growing from parent to child.
      ctx.strokeStyle = `rgba(255, 196, 120, ${0.18 + 0.28 * local})`;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // Traveling spark — bright, only visible while the edge is being drawn.
      if (local > 0 && local < 1) {
        const spark = ctx.createRadialGradient(x2, y2, 0, x2, y2, 6);
        spark.addColorStop(0, 'rgba(255, 240, 200, 0.95)');
        spark.addColorStop(0.4, 'rgba(255, 190, 120, 0.5)');
        spark.addColorStop(1, 'rgba(255, 190, 120, 0)');
        ctx.fillStyle = spark;
        ctx.beginPath();
        ctx.arc(x2, y2, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ─── Nodes ───
    for (const n of nodes) {
      const local = range(t, n.tReveal, n.tReveal + 0.08);
      if (local <= 0) continue;
      const scale = easeOutCubic(local);
      const r = n.r * (0.5 + 0.5 * scale);
      const alpha = 0.35 + 0.65 * scale;

      // Soft outer halo — what makes the dendrite look like a firing neuron.
      const halo = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 5);
      halo.addColorStop(0, `rgba(255, 220, 170, ${0.35 * alpha})`);
      halo.addColorStop(1, 'rgba(255, 220, 170, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r * 5, 0, Math.PI * 2);
      ctx.fill();

      // Core dot
      ctx.fillStyle = `rgba(255, 240, 210, ${alpha})`;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function init() { resize(); build(); }
  window.addEventListener('resize', () => { resize(); build(); });
  init();

  return { render };
})();


// ─── Artificial intelligence · layered forward pass ─────────────────────
// A real neural network topology (input → hidden × 2 → output). Scroll
// drives a forward pass: input nodes fire first, then signals travel
// along edges as small packets, then hidden layer 1 fires, and so on.
// The network is fully built at t=1. At t=0 nothing is visible.

const ArtificialNet = (() => {
  const canvas = document.getElementById('artificial-canvas');
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, dpr = 1;

  const LAYER_SIZES = [4, 6, 6, 3];  // input, hidden, hidden, output
  const LAYER_COUNT = LAYER_SIZES.length;
  const layers = [];   // [ [ {x,y,tReveal}, ... ], ... ]
  const edges  = [];   // { from:{layer,idx}, to:{layer,idx}, tStart, tEnd }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = rect.width;
    h = rect.height;
    canvas.width  = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function build() {
    layers.length = 0;
    edges.length = 0;
    if (w === 0) return;

    // Layout the layers across 72% of the canvas width.
    const xPad = w * 0.14;
    const usableW = w - xPad * 2;
    const layerX = Array.from({ length: LAYER_COUNT }, (_, i) =>
      xPad + usableW * (i / (LAYER_COUNT - 1))
    );

    // Reveal windows — the forward pass divides [0..1] into
    // LAYER_COUNT "firing" stages. Each layer fires once its
    // incoming edges have completed.
    const stageSize = 1 / LAYER_COUNT;

    for (let l = 0; l < LAYER_COUNT; l++) {
      const count = LAYER_SIZES[l];
      const nodes = [];
      const layerYSpan = Math.min(h * 0.7, 60 * count);
      const startY = (h - layerYSpan) / 2;
      for (let i = 0; i < count; i++) {
        nodes.push({
          x: layerX[l],
          y: startY + (i + 0.5) * (layerYSpan / count),
          // The layer's nodes all reveal at the "firing" point of their stage.
          tReveal: l * stageSize,
        });
      }
      layers.push(nodes);
    }

    // Edges connect every node in layer L to every node in layer L+1.
    // Each edge's signal packet travels during the L→L+1 transition window.
    for (let l = 0; l < LAYER_COUNT - 1; l++) {
      const tStart = l * stageSize + stageSize * 0.25;
      const tEnd   = (l + 1) * stageSize + stageSize * 0.05;
      const rng = mulberry32(1000 + l);
      for (let i = 0; i < LAYER_SIZES[l]; i++) {
        for (let j = 0; j < LAYER_SIZES[l + 1]; j++) {
          // Stagger each edge within the window so packets arrive in waves,
          // not all at the same frame.
          const jitter = rng() * 0.06;
          edges.push({
            from: { layer: l, idx: i },
            to:   { layer: l + 1, idx: j },
            tStart: tStart + jitter,
            tEnd:   tEnd + jitter,
            weight: 0.3 + rng() * 0.7, // visual line thickness/opacity
          });
        }
      }
    }
  }

  function render(time, t) {
    if (w === 0) return;
    ctx.clearRect(0, 0, w, h);

    // Cool haze behind the network
    const cx = w * 0.5, cy = h * 0.5;
    const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(w, h) * 0.5);
    bg.addColorStop(0, `rgba(159, 208, 255, ${0.06 + 0.08 * t})`);
    bg.addColorStop(1, 'rgba(159, 208, 255, 0)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // ─── Edges (base lines + traveling packets) ───
    for (const e of edges) {
      const a = layers[e.from.layer][e.from.idx];
      const b = layers[e.to.layer][e.to.idx];
      const local = range(t, e.tStart, e.tEnd);
      if (local <= 0) continue;

      // Faint static line visible once the packet starts
      const lineAlpha = 0.04 + 0.14 * smoothstep(local) * e.weight;
      ctx.strokeStyle = `rgba(159, 208, 255, ${lineAlpha})`;
      ctx.lineWidth = 0.8 * e.weight;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();

      // Signal packet — a bright dot traveling from a → b during the
      // transition window. Fades out as it arrives.
      if (local > 0 && local < 1) {
        const packetT = easeInOutCubic(local);
        const px = lerp(a.x, b.x, packetT);
        const py = lerp(a.y, b.y, packetT);
        const fade = 1 - Math.abs(packetT - 0.5) * 0.8;
        const packet = ctx.createRadialGradient(px, py, 0, px, py, 5);
        packet.addColorStop(0, `rgba(220, 240, 255, ${0.95 * fade})`);
        packet.addColorStop(0.5, `rgba(140, 200, 255, ${0.5 * fade})`);
        packet.addColorStop(1, 'rgba(140, 200, 255, 0)');
        ctx.fillStyle = packet;
        ctx.beginPath();
        ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ─── Nodes ───
    // A node "fires" when the local t reaches its reveal point, then stays
    // lit. Subtle extra pulse right after firing to sell the activation.
    for (let l = 0; l < layers.length; l++) {
      for (const n of layers[l]) {
        const sinceFire = t - n.tReveal;
        if (sinceFire <= 0) continue;
        const firingPulse = sinceFire < 0.08
          ? 1 + 0.8 * (1 - sinceFire / 0.08)
          : 1;
        const alpha = clamp(sinceFire * 10, 0, 1); // snap to visible at reveal
        const r = 5.5 * firingPulse;

        // Halo
        const halo = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 3.2);
        halo.addColorStop(0, `rgba(200, 230, 255, ${0.38 * alpha})`);
        halo.addColorStop(1, 'rgba(200, 230, 255, 0)');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r * 3.2, 0, Math.PI * 2);
        ctx.fill();

        // Core
        ctx.fillStyle = `rgba(230, 244, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function init() { resize(); build(); }
  window.addEventListener('resize', () => { resize(); build(); });
  init();

  return { render };
})();


// ─── Narration timeline ───────────────────────────────────────────────────

const NARRATION_BEATS = [
  // beat 0 · Act I · Two intelligences, one mission.
  { start: 0.00, peakIn: 0.04, peakOut: 0.14, end: 0.18, side: null    },
  // beat 1 · Inner intelligence knows why. — inner grows
  { start: 0.16, peakIn: 0.22, peakOut: 0.36, end: 0.40, side: 'inner' },
  // beat 2 · Artificial intelligence knows how. — AI propagates
  { start: 0.38, peakIn: 0.44, peakOut: 0.58, end: 0.62, side: 'ai'    },
  // beat 4 · When they meet…    (beat 3 "half a story" removed)
  { start: 0.62, peakIn: 0.68, peakOut: 0.74, end: 0.77, side: 'both'  },
  // beat 5 · CLIMAX · a meaningful world emerges.
  { start: 0.74, peakIn: 0.80, peakOut: 0.88, end: 0.92, side: null    },
  // beat 6 · Our portfolio of solutions.
  { start: 0.90, peakIn: 0.94, peakOut: 1.00, end: 1.00, side: null    },
];

const beatEls = Array.from(document.querySelectorAll('#narration .beat'));

function driveNarration(t) {
  let activeSide = null;

  NARRATION_BEATS.forEach((beat, i) => {
    const el = beatEls[i];
    if (!el) return;

    let op = 0, y = 0, scale = 1;
    if (t >= beat.start && t <= beat.end) {
      const fadeIn  = range(t, beat.start, beat.peakIn);
      const fadeOut = range(beat.end, t, beat.peakOut); // note: reversed domain
      // fadeOut above uses a scroll-back window: when t passes peakOut it
      // starts sinking toward end. So compute correctly:
      const fo = clamp((beat.end - t) / Math.max(0.0001, beat.end - beat.peakOut), 0, 1);
      op = Math.min(easeInOutCubic(fadeIn), easeInOutCubic(fo));

      const riseT = fadeIn;
      const sinkT = 1 - fo;
      y = lerp(18, 0, easeOutQuint(riseT)) + lerp(0, -14, easeInOutCubic(sinkT));
      scale = lerp(1.06, 1, easeOutQuint(riseT)) * lerp(1, 0.94, easeInOutCubic(sinkT));

      if (op > 0.35 && beat.side) activeSide = beat.side;
    }

    if (op < 0.01) {
      el.style.opacity = '0';
      el.style.transform = el.classList.contains('climax')
        ? 'translate(-50%, -50%) translateY(22px) scale(0.95)'
        : 'translateX(-50%) translateY(22px) scale(0.95)';
    } else {
      el.style.opacity = op.toFixed(3);
      if (el.classList.contains('climax')) {
        el.style.transform = `translate(-50%, -50%) translateY(${y.toFixed(1)}px) scale(${scale.toFixed(3)})`;
      } else {
        el.style.transform = `translateX(-50%) translateY(${y.toFixed(1)}px) scale(${scale.toFixed(3)})`;
      }
    }
  });

  document.documentElement.dataset.highlight = activeSide || '';
}


// ─── Earth camera keyframes ───────────────────────────────────────────────

const GLOBE_KEYS = [
  // [t, lon, lat, zoom, lookOffset]
  [0.00,  -90,   18,   0.35,  0.30],
  [0.60,  -40,   10,   0.55,  0.12],
  [0.78,    0,    0,   0.70,  0.00],
  [0.90,    0,    0,   0.60,  0.00],
  [1.00,    0,    0,   0.55,  0.00],
];

function sampleKeys(keys, t) {
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const a = keys[i - 1], b = keys[i];
      const u = easeInOutCubic((t - a[0]) / (b[0] - a[0] || 1));
      return {
        lon:        lerp(a[1], b[1], u),
        lat:        lerp(a[2], b[2], u),
        zoom:       lerp(a[3], b[3], u),
        lookOffset: lerp(a[4], b[4], u),
      };
    }
  }
  const last = keys[keys.length - 1];
  return { lon: last[1], lat: last[2], zoom: last[3], lookOffset: last[4] };
}

function driveEarth(t) {
  const E = window.EarthScene;
  if (!E) return;
  const k = sampleKeys(GLOBE_KEYS, t);

  // Once the dial is alive, the selected solution drives extra longitude.
  // Each step rotates Earth 60°, tweened by the dial's smoothed index.
  const dialActive = range(t, 0.90, 1.00);
  const extraLon = (window.SolutionsDial?.smoothIndex ?? 0) * -60 * dialActive;

  E.setCamera({
    lon:        k.lon + extraLon,
    lat:        k.lat,
    zoom:       k.zoom,
    lookOffset: k.lookOffset,
  });
  // Bright, hopeful tone once Earth is visible.
  E.setDayNight(lerp(0.9, 1.0, easeInOutCubic(range(t, 0.70, 0.90))));
}


// ─── Stage choreography ──────────────────────────────────────────────────

const innerEl = document.querySelector('.inner-intel');
const aiEl    = document.querySelector('.artificial-intel');
const petals  = Array.from(document.querySelectorAll('.petal'));

function driveStage(t, time) {
  const idleY = Math.sin(time * 0.0008) * 6;

  // ─── Intelligences · positioning ───
  // Apart during the first two beats, drifting toward center through "meet",
  // then fading out as Earth takes over.
  // We place them side-by-side at rest, ±28vw from center, and collapse to 0
  // between t ∈ [0.64, 0.78].
  const restingX = window.innerWidth * 0.22;
  const converge = easeInOutCubic(range(t, 0.64, 0.78));
  const xNow = lerp(restingX, 0, converge);

  // Opacity: appear from t=0.06, hold, fade from t=0.76 → 0.84
  const fadeIn  = easeInOutCubic(range(t, 0.06, 0.18));
  const fadeOut = easeInOutCubic(range(t, 0.76, 0.84));
  const op = clamp(fadeIn - fadeOut, 0, 1);

  // Subtle scale kiss at convergence — the moment of meeting
  const meetingPulse = Math.sin(range(t, 0.66, 0.76) * Math.PI);
  const meetScale = 1 + 0.05 * meetingPulse;

  innerEl.style.transform =
    `translate(-50%, -50%) translate(${-xNow}px, ${idleY}px) scale(${meetScale})`;
  innerEl.style.opacity = op;

  aiEl.style.transform =
    `translate(-50%, -50%) translate(${xNow}px, ${idleY}px) scale(${meetScale})`;
  aiEl.style.opacity = op;

  // ─── Inner and Artificial · progressive reveals ───
  // Inner grows dendritically during the "why" beat. AI propagates during
  // "how". They both fully complete by the time "meet" starts, so when
  // they converge both networks are alive side-by-side.
  const innerT = range(t, 0.12, 0.50);
  const aiT    = range(t, 0.32, 0.58);
  InnerBrain.render(performance.now(), innerT);
  ArtificialNet.render(performance.now(), aiT);

  // ─── Blooms ───
  // Warm bloom grows with inner reveal, cool bloom with artificial.
  // Fused bloom peaks at the moment of the climax (t ~ 0.78) and fades
  // as petals arrive.
  const warmBloom = innerT * (1 - fadeOut);
  const coolBloom = aiT    * (1 - fadeOut);
  const fusedBloom = Math.max(0,
    smoothstep(range(t, 0.68, 0.82)) * (1 - range(t, 0.88, 0.96))
  );
  const root = document.documentElement.style;
  root.setProperty('--warm-bloom',  warmBloom.toFixed(3));
  root.setProperty('--cool-bloom',  coolBloom.toFixed(3));
  root.setProperty('--fused-bloom', fusedBloom.toFixed(3));

  // ─── Atmosphere · dark → bluish as Earth arrives ───
  // Starts climbing with the climax, holds once we're in the menu.
  const atmosphere = clamp(
    smoothstep(range(t, 0.68, 0.88)) * (0.85 + 0.15 * range(t, 0.88, 1.00)),
    0, 1
  );
  root.setProperty('--atmosphere', atmosphere.toFixed(3));

  // ─── Stock footage · split screen · only during the menu beat ───
  // Fades in as the portfolio appears, out if the user scrolls back.
  const footageOp = easeInOutCubic(range(t, 0.92, 1.00)) * 0.75;
  root.setProperty('--footage-op', footageOp.toFixed(3));
  Footage.setActive(footageOp > 0.05);

  // ─── Porthole (Earth reveal mask) ───
  // Starts opening during "meet" (t=0.70), full viewport by t=0.86.
  const viewportMax = Math.hypot(window.innerWidth, window.innerHeight) * 0.6;
  const revealT = easeInOutCubic(range(t, 0.70, 0.86));
  root.setProperty('--reveal-radius', `${revealT * viewportMax}px`);

  // ─── Petals · one-at-a-time dial around Earth ───
  // The earth itself is the rotating knob. SolutionsDial tracks which
  // petal is active and animates a single card into view above Earth.
  // Overlapping ring of six is gone — one solution at a time, rotate to change.
  const dialT = easeOutQuint(range(t, 0.90, 1.00));
  SolutionsDial.render(time, dialT);
}


// ─── Stock footage · split-screen helper ────────────────────────────────
// Lazy: probes each data-src with HEAD, assigns src only if the file exists.
// This way the page works whether or not you've dropped .mp4 files into
// ./assets/. If missing, the tonal fallback (red wash left, teal wash right)
// from styles.css takes over.

const Footage = (() => {
  const videos = Array.from(document.querySelectorAll('.footage-video'));
  let ready = false;

  async function probe() {
    await Promise.all(videos.map(async (v) => {
      const src = v.dataset.src;
      if (!src) return;
      try {
        const res = await fetch(src, { method: 'HEAD' });
        if (res.ok) {
          v.src = src;
          v.load();
        }
      } catch (_) { /* file isn't there — fallback wash shows through */ }
    }));
    ready = true;
  }
  probe();

  function setActive(isActive) {
    if (!ready) return;
    for (const v of videos) {
      if (!v.src) continue;
      if (isActive && v.paused) {
        const p = v.play();
        if (p && p.catch) p.catch(() => { /* autoplay blocked until interaction */ });
      } else if (!isActive && !v.paused) {
        v.pause();
      }
    }
  }

  return { setActive };
})();


// ─── Solutions dial · Earth is the knob ──────────────────────────────────
// Once the climax lands, the dial activates. The active petal floats above
// Earth; the others are parked and invisible. prev/next buttons, dots, and
// arrow keys rotate through. Earth's longitude rotates in sync so it reads
// as "you're spinning the globe to a new region / solution".

const SolutionsDial = (() => {
  const selector   = document.getElementById('solutions-selector');
  const prevBtn    = selector.querySelector('.sel-prev');
  const nextBtn    = selector.querySelector('.sel-next');
  const dotsWrap   = selector.querySelector('.sel-dots');
  const COUNT      = petals.length;
  const DEG_PER    = 360 / COUNT;  // 60°, Earth rotates this much per step

  // Build pager dots once
  const dots = [];
  for (let i = 0; i < COUNT; i++) {
    const d = document.createElement('button');
    d.type = 'button';
    d.className = 'sel-dot';
    d.setAttribute('role', 'tab');
    d.setAttribute('aria-label', petals[i].dataset.label || `Solution ${i + 1}`);
    d.addEventListener('click', () => go(i));
    dotsWrap.appendChild(d);
    dots.push(d);
  }

  // Smoothed active index so Earth rotation tweens between positions
  let targetIdx = 0;
  let currentIdx = 0;
  const idxVel = { v: 0 };
  let active = false;

  function go(i) {
    targetIdx = ((i % COUNT) + COUNT) % COUNT;
    updateDots();
  }
  function next() { go(targetIdx + 1); }
  function prev() { go(targetIdx - 1); }
  function updateDots() {
    dots.forEach((d, i) => d.classList.toggle('is-active', i === targetIdx));
  }

  prevBtn.addEventListener('click', prev);
  nextBtn.addEventListener('click', next);

  // Arrow keys rotate the dial only when it's active (after the climax).
  window.addEventListener('keydown', (ev) => {
    if (!active) return;
    if (ev.key === 'ArrowRight') { ev.preventDefault(); next(); }
    if (ev.key === 'ArrowLeft')  { ev.preventDefault(); prev(); }
  });

  // Wheel rotates once the user is pinned at the end of the scroll.
  // (Scroll is what got us here; wheel at bottom turns into rotation.)
  let wheelCooldown = 0;
  window.addEventListener('wheel', (ev) => {
    if (!active) return;
    const nearEnd = rawT > 0.985;
    if (!nearEnd) return;
    if (performance.now() < wheelCooldown) return;
    if (Math.abs(ev.deltaY) < 4) return;
    ev.preventDefault();
    (ev.deltaY > 0 ? next : prev)();
    wheelCooldown = performance.now() + 280;
  }, { passive: false });

  updateDots();

  function render(time, dialT) {
    // dialT ∈ [0,1] · fade the whole selector in once the climax lands
    active = dialT > 0.6;
    selector.setAttribute('aria-hidden', active ? 'false' : 'true');
    selector.style.opacity = dialT.toFixed(3);
    selector.style.pointerEvents = active ? 'auto' : 'none';
    selector.style.transform = `translate(-50%, 0) translateY(${(1 - dialT) * 18}px)`;

    // Smooth the current index toward target so transitions are glidey.
    const dt = 1 / 60;
    currentIdx = smoothDamp(currentIdx, targetIdx, idxVel, 0.32, dt);

    // Park radius for the one-up card above Earth.
    const ringR = Math.min(window.innerWidth, window.innerHeight) * 0.30;
    const cardY = -ringR;

    petals.forEach((el, i) => {
      // Distance from the smoothed active index, on a circular axis [-3..3]
      let d = i - currentIdx;
      d = ((d + COUNT / 2) % COUNT + COUNT) % COUNT - COUNT / 2;
      const absD = Math.abs(d);

      // Only the active card is visible. Neighbors hint with low opacity
      // during the transition, everything else is hidden.
      const activeWeight = clamp(1 - absD, 0, 1);   // 1 at center, 0 at |d|>=1
      const neighborHint = clamp(1.35 - absD, 0, 1) * 0.18;
      const opacity = (activeWeight + neighborHint) * dialT;

      // Slight horizontal parallax so neighbors peek in from the side they
      // are rotating from. This sells "earth is spinning, card is changing".
      const px = d * 120;                           // neighbors offset sideways
      const scale = lerp(0.78, 1, activeWeight);
      const idleY = Math.sin(time * 0.0008 + i) * 3;

      el.style.transform =
        `translate(-50%, -50%) translate(${px}px, ${cardY + idleY}px) scale(${scale})`;
      el.style.opacity = opacity.toFixed(3);
      el.style.pointerEvents = activeWeight > 0.9 && active ? 'auto' : 'none';
      el.classList.toggle('is-active', activeWeight > 0.9);
    });
  }

  return { render, go, next, prev,
           get index() { return targetIdx; },
           get smoothIndex() { return currentIdx; } };
})();

// Expose for the earth camera and for dev console poking.
window.SolutionsDial = SolutionsDial;


// ─── Scroll → smoothed progress ────────────────────────────────────────

let rawT = 0, smoothT = 0;
const vel = { v: 0 };
let lastTime = performance.now();
let hasScrolled = false;

function readScroll() {
  const max = document.body.scrollHeight - window.innerHeight;
  rawT = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
}
window.addEventListener('scroll', () => {
  readScroll();
  if (!hasScrolled && window.scrollY > 24) {
    hasScrolled = true;
    const cue = document.getElementById('scroll-cue');
    if (cue) cue.classList.add('hidden');
  }
}, { passive: true });
window.addEventListener('resize', readScroll);
readScroll();


// ─── Bootstrap ─────────────────────────────────────────────────────────

(function waitForEarth() {
  if (window.EarthScene && window.EarthScene.init) {
    window.EarthScene.init(document.getElementById('scene-root'));
    window.EarthScene.setCamera({ lon: -90, lat: 18, zoom: 0.35, lookOffset: 0.3 });
    requestAnimationFrame(frame);
    return;
  }
  setTimeout(waitForEarth, 40);
})();

function frame(time) {
  const dt = (time - lastTime) / 1000;
  lastTime = time;
  smoothT = smoothDamp(smoothT, rawT, vel, 0.18, dt);
  if (Math.abs(smoothT - rawT) < 0.0001) smoothT = rawT;

  stars.render(time, smoothT);
  driveEarth(smoothT);
  driveStage(smoothT, time);
  driveNarration(smoothT);

  requestAnimationFrame(frame);
}
