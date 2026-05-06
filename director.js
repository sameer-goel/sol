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
  { start: 0.00, peakIn: 0.03, peakOut: 0.10, end: 0.13, side: null    },
  // beat 1 · Inner intelligence knows why. — inner grows
  { start: 0.12, peakIn: 0.17, peakOut: 0.26, end: 0.30, side: 'inner' },
  // beat 2 · Artificial intelligence knows how. — AI propagates
  { start: 0.28, peakIn: 0.33, peakOut: 0.42, end: 0.46, side: 'ai'    },
  // beat 4 · When they meet…    (beat 3 "half a story" removed)
  { start: 0.46, peakIn: 0.49, peakOut: 0.52, end: 0.55, side: 'both'  },
  // beat 5 · CLIMAX · a meaningful world of tomorrow.
  { start: 0.54, peakIn: 0.56, peakOut: 0.58, end: 0.61, side: null    },
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
  [0.44,  -40,   10,   0.55,  0.12],
  [0.56,    0,    0,   0.70,  0.00],
  [0.62,    0,    0,   0.60,  0.00],
  [1.00,    0,    0,   0.58,  0.00],
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

// ─── Menu phase · letterbox timing ────────────────────────────────────
// The spacer is 1300vh. Narrative takes t ∈ [0, 0.46], climax rides up to
// 0.58, menu enters at 0.58, fully engaged by 0.62. From 0.62 → 1.00 the
// 7 categories are mapped linearly to scroll — one category per 0.0543
// of normalized progress (≈ 5.4% of total page scroll each).
const MENU_ENTER = 0.58;   // letterbox starts to fade in
const MENU_FULL  = 0.62;   // fully engaged, scroll now cycles categories
const MENU_END   = 1.00;

function driveEarth(t) {
  const E = window.EarthScene;
  if (!E) return;
  const k = sampleKeys(GLOBE_KEYS, t);

  // Once the letterbox is alive, the selected category drives extra
  // longitude. We use a 7-step wheel of 360° — each category ≈ 51.4°.
  const menuActive = range(t, MENU_ENTER, MENU_FULL);
  const stepDeg = 360 / Math.max(1, (window.Letterbox?.count || 7));
  const extraLon = (window.Letterbox?.smoothIndex ?? 0) * -stepDeg * menuActive;

  // Earth shifts left ~14% of the viewport during the menu so the
  // roster + right stack have breathing room. Purely camera pan.
  const lookOffsetMenu = lerp(k.lookOffset, -0.28, menuActive);

  E.setCamera({
    lon:        k.lon + extraLon,
    lat:        k.lat,
    zoom:       k.zoom,
    lookOffset: lookOffsetMenu,
  });
  // Bright, hopeful tone once Earth is visible.
  E.setDayNight(lerp(0.9, 1.0, easeInOutCubic(range(t, 0.70, 0.90))));
}


// ─── Stage choreography ──────────────────────────────────────────────────

const innerEl = document.querySelector('.inner-intel');
const aiEl    = document.querySelector('.artificial-intel');

function driveStage(t, time) {
  const idleY = Math.sin(time * 0.0008) * 6;

  // ─── Intelligences · positioning ───
  // Narrative beats now end by t≈0.56 (the climax). Converge window and
  // fade-out shifted earlier to match.
  const restingX = window.innerWidth * 0.22;
  const converge = easeInOutCubic(range(t, 0.46, 0.56));
  const xNow = lerp(restingX, 0, converge);

  // Opacity: appear from t=0.04, hold, fade from t=0.54 → 0.60
  const fadeIn  = easeInOutCubic(range(t, 0.04, 0.14));
  const fadeOut = easeInOutCubic(range(t, 0.54, 0.60));
  const op = clamp(fadeIn - fadeOut, 0, 1);

  // Subtle scale kiss at convergence
  const meetingPulse = Math.sin(range(t, 0.48, 0.56) * Math.PI);
  const meetScale = 1 + 0.05 * meetingPulse;

  innerEl.style.transform =
    `translate(-50%, -50%) translate(${-xNow}px, ${idleY}px) scale(${meetScale})`;
  innerEl.style.opacity = op;

  aiEl.style.transform =
    `translate(-50%, -50%) translate(${xNow}px, ${idleY}px) scale(${meetScale})`;
  aiEl.style.opacity = op;

  // ─── Inner and Artificial · progressive reveals ───
  const innerT = range(t, 0.08, 0.36);
  const aiT    = range(t, 0.22, 0.44);
  InnerBrain.render(performance.now(), innerT);
  ArtificialNet.render(performance.now(), aiT);

  // ─── Blooms — reserved for the convergence/climax moment only ───
  // Wake for meet, peak at climax, fully gone before menu takes over.
  const mergeT = smoothstep(range(t, 0.42, 0.52));
  const decay  = 1 - easeInOutCubic(range(t, 0.56, 0.60));
  const warmBloom = mergeT * decay;
  const coolBloom = mergeT * decay;
  const fusedBloom = Math.max(0,
    smoothstep(range(t, 0.48, 0.56)) * (1 - range(t, 0.56, 0.60))
  );
  const root = document.documentElement.style;
  root.setProperty('--warm-bloom',  warmBloom.toFixed(3));
  root.setProperty('--cool-bloom',  coolBloom.toFixed(3));
  root.setProperty('--fused-bloom', fusedBloom.toFixed(3));

  // ─── Atmosphere · tight rim halo only, no ambient wash ───
  const atmosphere = clamp(
    smoothstep(range(t, 0.48, 0.60)) * 0.9,
    0, 1
  );
  root.setProperty('--atmosphere', atmosphere.toFixed(3));

  // ─── Vignette · fade it out in the menu beat so Earth can breathe ───
  const menuT = easeInOutCubic(range(t, MENU_ENTER, MENU_FULL));
  root.setProperty('--vignette-op', lerp(1.0, 0.25, menuT).toFixed(3));

  // ─── Narration scrim · fades out as the letterbox takes the stage ───
  const scrim = 1 - easeInOutCubic(range(t, 0.50, 0.62));
  root.setProperty('--narration-scrim', scrim.toFixed(3));

  // ─── Porthole (Earth reveal mask) ───
  const viewportMax = Math.hypot(window.innerWidth, window.innerHeight) * 0.6;
  const revealT = easeInOutCubic(range(t, 0.46, 0.58));
  root.setProperty('--reveal-radius', `${revealT * viewportMax}px`);

  // ─── Letterbox · drives itself off scroll t ───
  Letterbox.render(t);
}


// ─── Letterbox · split-letter menu, scroll-driven ────────────────────
// Renders the 7-category roster on the left and a glass stack on the
// right with glyph + tagline + project links. Scroll maps directly to
// the active index. On each rotation "lock-on" we fire a short .lb-pulse
// class (~1.2s) that glows the active item. No buttons, no keys — scroll
// is the only navigation. Hover glows links. Those are the only two
// moments where accent color lights up.

const Letterbox = (() => {
  const root      = document.getElementById('letterbox');
  const rosterEl  = document.getElementById('lb-roster');
  const stackEl   = document.getElementById('lb-stack');

  // All seven glyph SVGs · authored at 64×64 viewBox, inherit currentColor.
  const GLYPHS = {
    'crisis-support': `
      <svg viewBox="0 0 64 64" class="glyph-sos">
        <g class="ring">
          <circle cx="32" cy="32" r="22"/>
          <circle cx="32" cy="32" r="12" opacity="0.45"/>
        </g>
        <line x1="32" y1="8"  x2="32" y2="12" opacity="0.4"/>
        <line x1="32" y1="52" x2="32" y2="56" opacity="0.4"/>
        <line x1="8"  y1="32" x2="12" y2="32" opacity="0.4"/>
        <line x1="52" y1="32" x2="56" y2="32" opacity="0.4"/>
        <text class="text" x="32" y="36" text-anchor="middle" font-size="11">SOS</text>
        <circle class="mark fill" cx="32" cy="15" r="1.3"/>
        <circle class="mark fill" cx="38" cy="15.6" r="1.3"/>
        <circle class="mark fill" cx="44" cy="17.2" r="1.3"/>
        <line class="mark" x1="48.3" y1="21.5" x2="50.2" y2="25.5"/>
        <line class="mark" x1="50"   y1="29"   x2="50"   y2="33"/>
        <line class="mark" x1="50.2" y1="36.5" x2="48.3" y2="40.5"/>
        <circle class="mark fill" cx="44" cy="44.8" r="1.3"/>
        <circle class="mark fill" cx="38" cy="46.4" r="1.3"/>
        <circle class="mark fill" cx="32" cy="47" r="1.3"/>
      </svg>`,
    'mental-health': `
      <svg viewBox="0 0 64 64" class="glyph-mind">
        <g class="ring-outer"><circle cx="32" cy="32" r="24" stroke-dasharray="46 14"/></g>
        <g class="ring-inner"><circle cx="32" cy="32" r="14" stroke-dasharray="28 10"/></g>
        <circle cx="32" cy="32" r="1.8" class="fill"/>
      </svg>`,
    'special-sounds': `
      <svg viewBox="0 0 64 64" class="glyph-binaural">
        <ellipse cx="32" cy="34" rx="12" ry="14"/>
        <path d="M 26 48 L 26 52 Q 22 54 20 58" opacity="0.45"/>
        <path d="M 38 48 L 38 52 Q 42 54 44 58" opacity="0.45"/>
        <path d="M 14 28 Q 32 10 50 28"/>
        <g class="pulse-l"><rect x="10" y="24" width="8" height="10" rx="3"/></g>
        <g class="pulse-r"><rect x="46" y="24" width="8" height="10" rx="3"/></g>
        <text class="label" x="14" y="44" text-anchor="middle" font-size="5">L</text>
        <text class="label" x="50" y="44" text-anchor="middle" font-size="5">R</text>
      </svg>`,
    'autonomous-ai': `
      <svg viewBox="0 0 64 64" class="glyph-agent">
        <circle cx="32" cy="32" r="20" stroke-dasharray="2 5" opacity="0.45"/>
        <circle cx="52" cy="32" r="1.6" class="fill"/>
        <circle cx="22" cy="13" r="1.6" class="fill"/>
        <circle cx="22" cy="51" r="1.6" class="fill"/>
        <path class="agent fill" d="M 0 -4 L 4 4 L -4 4 Z" transform="translate(0,0)"/>
        <text class="text" x="32" y="36" text-anchor="middle" font-size="14">AI</text>
      </svg>`,
    'sovereign-ai': `
      <svg viewBox="0 0 64 64" class="glyph-shield">
        <path d="M 32 6 L 54 17 L 54 36 Q 54 48 32 58 Q 10 48 10 36 L 10 17 Z"/>
        <line class="spoke" x1="32" y1="14" x2="32" y2="20"/>
        <line class="spoke" x1="46" y1="44" x2="40" y2="40"/>
        <line class="spoke" x1="18" y1="44" x2="24" y2="40"/>
        <text class="text" x="32" y="38" text-anchor="middle" font-size="15">AI</text>
      </svg>`,
    'cultivate-inner-intelligence': `
      <svg viewBox="0 0 64 64" class="glyph-book">
        <line x1="32" y1="14" x2="32" y2="50" opacity="0.55"/>
        <path d="M 32 16 Q 22 13 12 18 L 12 46 Q 22 43 32 46 Z"/>
        <path d="M 32 16 Q 42 13 52 18 L 52 46 Q 42 43 32 46 Z"/>
        <g class="spiral" opacity="0.5">
          <line x1="17" y1="26" x2="28" y2="24"/>
          <line x1="17" y1="32" x2="28" y2="30"/>
          <line x1="17" y1="38" x2="28" y2="36"/>
          <line x1="36" y1="24" x2="47" y2="26"/>
          <line x1="36" y1="30" x2="47" y2="32"/>
          <line x1="36" y1="36" x2="47" y2="38"/>
        </g>
        <text class="label" x="32" y="60" text-anchor="middle" font-size="7">BOOK</text>
      </svg>`,
    'self-help': `
      <svg viewBox="0 0 64 64" class="glyph-flower">
        <path d="M 32 56 Q 32 44 32 30"/>
        <path d="M 32 46 Q 24 44 22 48 Q 28 50 32 48" opacity="0.7"/>
        <g>
          <path class="petal" style="--a:   0deg" d="M 32 26 Q 30 12 32 10 Q 34 12 32 26 Z"/>
          <path class="petal" style="--a:  72deg" d="M 32 26 Q 30 12 32 10 Q 34 12 32 26 Z"/>
          <path class="petal" style="--a: 144deg" d="M 32 26 Q 30 12 32 10 Q 34 12 32 26 Z"/>
          <path class="petal" style="--a: 216deg" d="M 32 26 Q 30 12 32 10 Q 34 12 32 26 Z"/>
          <path class="petal" style="--a: 288deg" d="M 32 26 Q 30 12 32 10 Q 34 12 32 26 Z"/>
        </g>
        <circle cx="32" cy="26" r="2.4" class="fill"/>
      </svg>`,
  };

  // Placeholder data · replaced by fetched solutions.json if available
  const FALLBACK = [
    { id:'crisis-support', name:'Crisis Support', accent:'#ff6b4a', tagline:'When every minute matters.', projects:[] },
    { id:'mental-health',  name:'Mental Health',  accent:'#5ab8ff', tagline:'Train the mind you already have.', projects:[] },
    { id:'special-sounds', name:'Special Sounds', accent:'#b78bff', tagline:'Frequencies that re-tune you.', projects:[] },
    { id:'autonomous-ai',  name:'Autonomous AI',  accent:'#5ae0d0', tagline:'Agents that do, not just answer.', projects:[] },
    { id:'sovereign-ai',   name:'Sovereign AI',   accent:'#ffc54a', tagline:'Own your intelligence stack.',   projects:[] },
    { id:'cultivate-inner-intelligence', name:'Cultivate Inner Intelligence', accent:'#ff9b7a', tagline:'A book. A mirror.', projects:[] },
    { id:'self-help',      name:'Self Help',      accent:'#6bd6a0', tagline:'Small tools, daily wins.', projects:[] },
  ];

  let data = FALLBACK;

  // Smoothed active index so Earth rotation + roster-size animation tween
  let targetIdx  = 0;
  let currentIdx = 0;
  const idxVel = { v: 0 };
  let lastLockedIdx = -1;

  // Italicize the last word of the active category name (cinematic touch)
  function italicizeActive(name) {
    const words = name.split(' ');
    return words.length > 1
      ? `${words.slice(0, -1).join(' ')} <em>${words.slice(-1)}</em>`
      : `<em>${name}</em>`;
  }

  function buildRoster() {
    rosterEl.innerHTML = '';
    data.forEach((cat, i) => {
      const li = document.createElement('li');
      li.className = 'lb-item';
      li.dataset.idx = i;
      li.style.setProperty('--item-accent', cat.accent);
      li.innerHTML = `
        <span class="lb-num">${String(i + 1).padStart(2, '0')}</span>
        <span class="lb-dot" aria-hidden="true"></span>
        <span class="lb-label">${cat.name}</span>
      `;
      rosterEl.appendChild(li);
    });
  }

  function buildStack() {
    const cat = data[targetIdx];
    if (!cat) return;
    document.documentElement.style.setProperty('--accent', cat.accent);
    stackEl.style.setProperty('--accent', cat.accent);
    stackEl.innerHTML = `
      <header>
        <div class="lb-glass"><div class="lb-glyph">${GLYPHS[cat.id] || ''}</div></div>
        <div>
          <div class="lb-name">${cat.name}</div>
          <div class="lb-tag">${cat.tagline || ''}</div>
        </div>
      </header>
      <ul class="lb-projects">
        ${cat.projects.map(p =>
          `<li><a href="${p.url}" target="_blank" rel="noopener">${p.label}</a></li>`
        ).join('')}
      </ul>
    `;
  }

  function applyActive() {
    // Update roster DOM: active item gets italicized label + .is-active
    const items = rosterEl.querySelectorAll('.lb-item');
    items.forEach((li, i) => {
      const cat = data[i];
      const label = li.querySelector('.lb-label');
      const isActive = i === targetIdx;
      li.classList.toggle('is-active', isActive);
      label.innerHTML = isActive ? italicizeActive(cat.name) : cat.name;
    });
    buildStack();
    // Fire the lock-on pulse · glow for ~1.2s then back to matte
    firePulse();
  }

  function firePulse() {
    const activeItem = rosterEl.querySelector('.lb-item.is-active');
    if (activeItem) {
      activeItem.classList.remove('lb-pulse');
      // Force reflow so the class re-add restarts the animation cleanly
      void activeItem.offsetWidth;
      activeItem.classList.add('lb-pulse');
      setTimeout(() => activeItem.classList.remove('lb-pulse'), 1300);
    }
    stackEl.classList.remove('lb-pulse');
    void stackEl.offsetWidth;
    stackEl.classList.add('lb-pulse');
    setTimeout(() => stackEl.classList.remove('lb-pulse'), 1300);
  }

  // Allow clicking a roster item as an alternative to scroll; we clamp
  // the page scroll to the corresponding band so the rest of the machine
  // (Earth rotation, accents) follows.
  rosterEl.addEventListener('click', (ev) => {
    const li = ev.target.closest('.lb-item');
    if (!li) return;
    const i = Number(li.dataset.idx);
    const max = document.body.scrollHeight - window.innerHeight;
    // Scroll to the midpoint of this category's band
    const band = (MENU_END - MENU_FULL) / data.length;
    const targetT = MENU_FULL + band * (i + 0.5);
    window.scrollTo({ top: targetT * max, behavior: 'smooth' });
  });

  // Load live data if present
  fetch('./solutions.json', { cache: 'no-cache' })
    .then(r => r.ok ? r.json() : null)
    .then(d => { if (d) data = d; buildRoster(); applyActive(); })
    .catch(() => { buildRoster(); applyActive(); });

  // ─── Per-frame tick ───
  function render(t) {
    // Fade the entire letterbox in during the menu entry range
    const op = easeInOutCubic(range(t, MENU_ENTER, MENU_FULL));
    root.style.opacity = op.toFixed(3);
    root.setAttribute('data-active', op > 0.9 ? 'true' : 'false');

    // Map scroll → active index across the menu band
    if (t >= MENU_FULL) {
      const band = (MENU_END - MENU_FULL) / data.length;
      const raw = (t - MENU_FULL) / band;  // 0 → data.length
      const clamped = clamp(raw, 0, data.length - 0.0001);
      const newTarget = Math.floor(clamped);

      if (newTarget !== targetIdx) {
        targetIdx = newTarget;
        applyActive();
        lastLockedIdx = targetIdx;
      }
      // Smooth index for Earth rotation uses the raw continuous position
      // so the globe tweens fluidly even while the roster snaps.
      currentIdx = smoothDamp(currentIdx, clamped, idxVel, 0.28, 1 / 60);
    } else {
      // Before menu engages, keep index at 0 for Earth continuity
      currentIdx = smoothDamp(currentIdx, 0, idxVel, 0.28, 1 / 60);
      if (targetIdx !== 0) {
        targetIdx = 0;
        applyActive();
      }
    }
  }

  return {
    render,
    get count()        { return data.length; },
    get index()        { return targetIdx; },
    get smoothIndex()  { return currentIdx; },
  };
})();

// Expose for dev console / the earth camera
window.Letterbox = Letterbox;


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
