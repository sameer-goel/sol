// earth-scene.js
// Three.js scene that renders the Earth, atmosphere, and provides a scroll/tweak-driven camera API.
// Exposes window.EarthScene with: init(), setStyle(), setCamera({lon, lat, zoom}), setDayNight(t), setRotation(speed)

import * as THREE from 'three';

const STYLES = {
  photoreal: {
    label: 'Photoreal',
    day:   'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/planets/earth_atmos_2048.jpg',
    night: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/planets/earth_lights_2048.png',
    specular: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/planets/earth_specular_2048.jpg',
    clouds: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/planets/earth_clouds_1024.png',
    atmosphereColor: new THREE.Color(0x4d80ff),
    atmosphereIntensity: 1.3,
    nightFactor: 1.0,
    cloudOpacity: 0.6,
    wireframe: false,
    desaturate: 0.0,
    sepia: 0.0,
  },
  // Stylized topographic: same texture but warm sepia + boosted spec, no clouds
  topo: {
    label: 'Topographic',
    day:   'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/planets/earth_atmos_2048.jpg',
    night: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/planets/earth_lights_2048.png',
    specular: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/planets/earth_specular_2048.jpg',
    clouds: null,
    atmosphereColor: new THREE.Color(0xd4a574),
    atmosphereIntensity: 0.7,
    nightFactor: 0.3,
    cloudOpacity: 0.0,
    wireframe: false,
    desaturate: 0.4,
    sepia: 0.65,
  },
  // Painterly: heavy clouds, soft saturation
  painterly: {
    label: 'Painterly',
    day:   'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/planets/earth_atmos_2048.jpg',
    night: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/planets/earth_lights_2048.png',
    specular: null,
    clouds: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/planets/earth_clouds_1024.png',
    atmosphereColor: new THREE.Color(0x88a9c5),
    atmosphereIntensity: 1.4,
    nightFactor: 0.4,
    cloudOpacity: 0.7,
    wireframe: false,
    desaturate: 0.55,
    sepia: 0.0,
  },
  // Wireframe globe: low-poly with overlay lines
  wireframe: {
    label: 'Wireframe',
    day:   'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/planets/earth_atmos_2048.jpg',
    night: null,
    specular: null,
    clouds: null,
    atmosphereColor: new THREE.Color(0x4ad8ff),
    atmosphereIntensity: 0.9,
    nightFactor: 0.0,
    cloudOpacity: 0.0,
    wireframe: true,
    desaturate: 0.85,
    sepia: 0.0,
  },
  // Pure night-side: city lights focused
  nightside: {
    label: 'City Lights',
    day:   'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/planets/earth_atmos_2048.jpg',
    night: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/planets/earth_lights_2048.png',
    specular: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/planets/earth_specular_2048.jpg',
    clouds: null,
    atmosphereColor: new THREE.Color(0xffaa55),
    atmosphereIntensity: 1.1,
    nightFactor: 1.0,
    cloudOpacity: 0.0,
    wireframe: false,
    desaturate: 0.0,
    sepia: 0.0,
  },
  // Monochrome editorial
  monochrome: {
    label: 'Editorial',
    day:   'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/planets/earth_atmos_2048.jpg',
    night: null,
    specular: null,
    clouds: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/planets/earth_clouds_1024.png',
    atmosphereColor: new THREE.Color(0xf0eee6),
    atmosphereIntensity: 0.9,
    nightFactor: 0.0,
    cloudOpacity: 0.55,
    wireframe: false,
    desaturate: 1.0,
    sepia: 0.0,
  },
};

// Custom shader for the Earth: blends day/night based on sun direction, with style controls.
const earthVertex = /* glsl */`
  varying vec3 vNormal;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const earthFragment = /* glsl */`
  precision highp float;
  uniform sampler2D uDay;
  uniform sampler2D uNight;
  uniform sampler2D uSpec;
  uniform bool uHasNight;
  uniform bool uHasSpec;
  uniform vec3 uSunDir;          // world-space sun direction (toward sun)
  uniform float uNightFactor;    // 0..1 — strength of night lights
  uniform float uDesaturate;     // 0..1
  uniform float uSepia;          // 0..1
  uniform float uExposure;       // overall brightness
  uniform float uTwilightWidth;  // softness of terminator
  varying vec3 vNormal;
  varying vec2 vUv;

  vec3 desaturate(vec3 c, float a){
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    return mix(c, vec3(l), a);
  }
  vec3 sepia(vec3 c, float a){
    vec3 s = vec3(
      dot(c, vec3(0.393, 0.769, 0.189)),
      dot(c, vec3(0.349, 0.686, 0.168)),
      dot(c, vec3(0.272, 0.534, 0.131))
    );
    return mix(c, s, a);
  }

  void main() {
    vec3 N = normalize(vNormal);
    float NdotL = dot(N, normalize(uSunDir));

    // Sharper terminator for more defined day/night boundary
    float dayMix = smoothstep(-uTwilightWidth, uTwilightWidth, NdotL);

    vec3 dayCol = texture2D(uDay, vUv).rgb;
    // Boost saturation of day side — richer blues
    float dayLum = dot(dayCol, vec3(0.2126, 0.7152, 0.0722));
    dayCol = mix(vec3(dayLum), dayCol, 1.25); // +25% saturation
    dayCol *= 0.92; // slightly darker for depth

    // Subtle specular highlight on oceans (where spec map is bright)
    if (uHasSpec) {
      float spec = texture2D(uSpec, vUv).r;
      vec3 V = vec3(0.0, 0.0, 1.0); // eye dir approx
      vec3 R = reflect(-normalize(uSunDir), N);
      float s = pow(max(dot(R, V), 0.0), 22.0) * spec;
      dayCol += vec3(0.4, 0.5, 0.65) * s * 0.3;
    }
    // Atmospheric tint at edges (subtle blue limb)
    float fres = pow(1.0 - max(dot(N, vec3(0.0, 0.0, 1.0)), 0.0), 2.4);
    dayCol += vec3(0.12, 0.25, 0.5) * fres * 0.3 * dayMix;

    vec3 nightCol = vec3(0.0);
    if (uHasNight) {
      vec3 lights = texture2D(uNight, vUv).rgb;
      // Boost contrast so cities pop, warm amber tint
      lights = pow(lights, vec3(0.75)) * 1.5;
      lights *= vec3(1.1, 0.95, 0.7); // warm amber shift
      nightCol = lights * uNightFactor;
      // Very faint base so unlit landmasses aren't pure black
      nightCol += dayCol * 0.02;
    } else {
      nightCol = dayCol * 0.04;
    }

    vec3 col = mix(nightCol, dayCol, dayMix);
    col = desaturate(col, uDesaturate);
    col = sepia(col, uSepia);
    col *= uExposure;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const atmosphereVertex = /* glsl */`
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec3 vWorldNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    vec4 mvp = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-mvp.xyz);
    gl_Position = projectionMatrix * mvp;
  }
`;

const atmosphereFragment = /* glsl */`
  precision highp float;
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform vec3 uSunDir;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec3 vWorldNormal;
  void main() {
    // Fresnel: tight limb glow
    float fres = pow(1.0 - abs(dot(vNormal, vViewDir)), 5.0);

    // Sun-facing mask: only glow on the sunlit limb
    float NdotL = dot(normalize(vWorldNormal), normalize(uSunDir));
    float sunMask = smoothstep(-0.1, 0.5, NdotL);

    // Color gradient: brighter blue-white where sun is strongest
    vec3 brightColor = vec3(0.45, 0.65, 1.0);
    vec3 deepColor = vec3(0.15, 0.3, 0.8);
    vec3 col = mix(deepColor, brightColor, smoothstep(0.0, 0.8, NdotL));

    // Combine
    float alpha = fres * sunMask * uIntensity;
    vec3 finalColor = col * fres * sunMask * uIntensity;
    gl_FragColor = vec4(finalColor, alpha);
  }
`;

class EarthSceneImpl {
  constructor() {
    this.styleKey = 'photoreal';
    this.targetCam = { lon: -90, lat: 18, zoom: 1.0 };  // initial: top half framing
    this.currentCam = { lon: -90, lat: 18, zoom: 1.0 };
    this.rotationSpeed = 0.012; // radians/sec base auto-rotation
    this.autoRotate = true;
    this.dayNightT = 1.0; // 1=day side facing camera
    this.markers = []; // [{lat, lon, label, key}]
    this.markerCallbacks = null;
    this.textureCache = new Map();
    this._dragging = false;
  }

  init(container) {
    this.container = container;
    const w = window.innerWidth, h = window.innerHeight;

    this.scene = new THREE.Scene();

    // Camera
    this.camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 100);
    this.camera.position.set(0, 0, 5.2);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.setClearColor(0x060a14, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    // Lighting (used only by the cloud mesh; earth uses its own shader)
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.25));
    this.sunLight = new THREE.DirectionalLight(0xffffff, 1.6);
    this.sunLight.position.set(5, 1, 3);
    this.scene.add(this.sunLight);

    // Earth mesh
    const earthGeo = new THREE.SphereGeometry(1, 96, 96);
    this.earthUniforms = {
      uDay: { value: null },
      uNight: { value: null },
      uSpec: { value: null },
      uHasNight: { value: false },
      uHasSpec: { value: false },
      uSunDir: { value: new THREE.Vector3(1, 0.2, 0.6).normalize() },
      uNightFactor: { value: 1.0 },
      uDesaturate: { value: 0.0 },
      uSepia: { value: 0.0 },
      uExposure: { value: 1.0 },
      uTwilightWidth: { value: 0.18 },
    };
    this.earthMaterial = new THREE.ShaderMaterial({
      uniforms: this.earthUniforms,
      vertexShader: earthVertex,
      fragmentShader: earthFragment,
    });
    this.earth = new THREE.Mesh(earthGeo, this.earthMaterial);
    this.scene.add(this.earth);

    // Clouds
    const cloudGeo = new THREE.SphereGeometry(1.012, 80, 80);
    this.cloudMaterial = new THREE.MeshPhongMaterial({
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    this.clouds = new THREE.Mesh(cloudGeo, this.cloudMaterial);
    this.clouds.visible = false;
    this.scene.add(this.clouds);

    // Wireframe overlay (hidden by default)
    const wireGeo = new THREE.SphereGeometry(1.003, 48, 32);
    this.wireMaterial = new THREE.LineBasicMaterial({
      color: 0x4ad8ff,
      transparent: true,
      opacity: 0.35,
    });
    this.wireMesh = new THREE.LineSegments(
      new THREE.WireframeGeometry(wireGeo),
      this.wireMaterial,
    );
    this.wireMesh.visible = false;
    this.scene.add(this.wireMesh);

    // Atmosphere (back-side glow) — visible bright limb glow
    const atmoGeo = new THREE.SphereGeometry(1.035, 80, 80);
    this.atmoUniforms = {
      uColor: { value: new THREE.Color(0x4d80ff) },
      uIntensity: { value: 1.3 },
      uSunDir: { value: new THREE.Vector3(1, 0.2, 0.6).normalize() },
    };
    this.atmoMaterial = new THREE.ShaderMaterial({
      uniforms: this.atmoUniforms,
      vertexShader: atmosphereVertex,
      fragmentShader: atmosphereFragment,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.atmosphere = new THREE.Mesh(atmoGeo, this.atmoMaterial);
    this.atmosphere.visible = true;
    this.scene.add(this.atmosphere);

    // Earth pivot for tilt
    this.earth.rotation.z = THREE.MathUtils.degToRad(23.4);
    this.clouds.rotation.z = this.earth.rotation.z;
    this.wireMesh.rotation.z = this.earth.rotation.z;

    // Markers (DOM-driven; we track 3D positions and project to screen)
    this.markerData = []; // populated via setMarkers

    this.setStyle('photoreal');
    if (this._pendingStyle && this._pendingStyle !== 'photoreal') {
      this.setStyle(this._pendingStyle);
    }

    // Pointer drag for free rotation (when enabled by app)
    this._enableDrag();

    // Resize
    window.addEventListener('resize', () => this._onResize());
    this._onResize();

    // Animation loop — rAF + setInterval fallback (some iframe sandboxes throttle rAF)
    this.clock = new THREE.Clock();
    this._tick = this._tick.bind(this);
    let lastTickTime = 0;
    const loop = () => {
      lastTickTime = performance.now();
      try { this._tick(); } catch(e) { console.error('[earth tick]', e); }
      this._rafId = requestAnimationFrame(loop);
    };
    this._rafId = requestAnimationFrame(loop);
    // Fallback: if rAF hasn't fired in 200ms, take over with setInterval
    this._fallbackInterval = setInterval(() => {
      if (performance.now() - lastTickTime > 200) {
        try { this._tick(); } catch(e) {}
      }
    }, 33);
  }

  _onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  _enableDrag() {
    const dom = this.renderer.domElement;
    dom.style.pointerEvents = 'auto';
    let lastX = 0, lastY = 0;
    const onDown = (e) => {
      this._dragging = true;
      lastX = e.clientX; lastY = e.clientY;
      this._dragPaused = true;
      document.body.style.cursor = 'grabbing';
    };
    const onMove = (e) => {
      if (!this._dragging) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      this.targetCam.lon -= dx * 0.22;
      this.targetCam.lat = Math.max(-85, Math.min(85, this.targetCam.lat + dy * 0.22));
      if (this._onDragChange) this._onDragChange(this.targetCam);
    };
    const onUp = () => {
      if (this._dragging) {
        this._dragging = false;
        document.body.style.cursor = '';
        // small delay before resume of any auto-driven motion is up to caller
      }
    };
    dom.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    dom.addEventListener('touchstart', (e) => onDown(e.touches[0]), { passive: true });
    window.addEventListener('touchmove', (e) => onMove(e.touches[0]), { passive: true });
    window.addEventListener('touchend', onUp);
  }

  onDragChange(cb) { this._onDragChange = cb; }

  _loadTexture(url) {
    if (!url) return Promise.resolve(null);
    if (this.textureCache.has(url)) return Promise.resolve(this.textureCache.get(url));
    return new Promise((resolve) => {
      new THREE.TextureLoader().load(
        url,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = 8;
          this.textureCache.set(url, tex);
          resolve(tex);
        },
        undefined,
        () => resolve(null),
      );
    });
  }

  async setStyle(key) {
    const def = STYLES[key] || STYLES.photoreal;
    this.styleKey = key;
    if (!this.earthUniforms) {
      // Init hasn't run yet — defer
      this._pendingStyle = key;
      return;
    }

    let day = null, night = null, spec = null, clouds = null;
    try {
      [day, night, spec, clouds] = await Promise.all([
        this._loadTexture(def.day),
        this._loadTexture(def.night),
        this._loadTexture(def.specular),
        this._loadTexture(def.clouds),
      ]);
    } catch (e) {
      console.warn('[earth] texture load failed', e);
    }

    // Re-check after await — instance may have been reset
    if (!this.earthUniforms) return;

    try {
      this.earthUniforms.uDay.value = day;
      this.earthUniforms.uNight.value = night;
      this.earthUniforms.uSpec.value = spec;
      this.earthUniforms.uHasNight.value = !!night;
      this.earthUniforms.uHasSpec.value = !!spec;
      this.earthUniforms.uNightFactor.value = def.nightFactor;
      this.earthUniforms.uDesaturate.value = def.desaturate;
      this.earthUniforms.uSepia.value = def.sepia;

    if (clouds) {
      this.cloudMaterial.map = clouds;
      this.cloudMaterial.alphaMap = clouds;
      this.cloudMaterial.needsUpdate = true;
      this.clouds.visible = def.cloudOpacity > 0;
      this.cloudMaterial.opacity = def.cloudOpacity;
    } else {
      this.clouds.visible = false;
    }

    this.wireMesh.visible = def.wireframe;
    this.earth.visible = !def.wireframe || def.wireframe; // always show earth (wire on top)
    if (def.wireframe) {
      // Dim the earth surface so wireframe pops
      this.earthUniforms.uExposure.value = 0.55;
    } else {
      this.earthUniforms.uExposure.value = 1.0;
    }

    this.atmoUniforms.uColor.value = def.atmosphereColor;
    this.atmoUniforms.uIntensity.value = def.atmosphereIntensity;
    } catch (e) {
      console.warn('[earth] setStyle apply failed', e);
    }

    // Notify load-complete (used for shroud) — ALWAYS fire, even on failure
    if (this._onStyleReady) this._onStyleReady();
  }

  onStyleReady(cb) { this._onStyleReady = cb; }

  setCamera({ lon, lat, zoom, lookOffset }) {
    if (lon != null) this.targetCam.lon = lon;
    if (lat != null) this.targetCam.lat = lat;
    if (zoom != null) this.targetCam.zoom = zoom;
    if (lookOffset != null) this._lookOffsetTarget = lookOffset;
  }

  setRotation(speed) {
    this.rotationSpeed = speed;
  }

  // dayNightT: 0 = full night facing viewer (sun behind earth), 1 = full day, 0.5 = terminator
  setDayNight(t) {
    this.dayNightT = t;
  }

  setExposure(e) { this.earthUniforms.uExposure.value = e; }

  setMarkers(markers, onClick) {
    this.markerData = markers;
    this.markerCallbacks = onClick;
    const layer = document.getElementById('marker-layer');
    if (!layer) return;
    layer.innerHTML = '';
    markers.forEach((m, i) => {
      const el = document.createElement('button');
      el.className = 'marker';
      el.setAttribute('aria-label', m.label);
      el.dataset.idx = i;
      el.innerHTML = `<div class="pulse"></div><div class="lbl">${m.label}</div>`;
      el.addEventListener('click', () => onClick && onClick(m, i));
      layer.appendChild(el);
      m._el = el;
    });
  }

  setMarkersVisible(visible) {
    this.markerData.forEach(m => {
      if (m._el) m._el.classList.toggle('visible', visible);
    });
  }

  // Convert lat/lon to a 3D point on the earth (matches camera convention)
  _latLonToVec3(lat, lon, r = 1.01) {
    // Use the same parameterization as the camera: x = cos(lat)*sin(lon), z = cos(lat)*cos(lon)
    const latRad = THREE.MathUtils.degToRad(lat);
    const lonRad = THREE.MathUtils.degToRad(lon);
    const v = new THREE.Vector3(
      r * Math.cos(latRad) * Math.sin(lonRad),
      r * Math.sin(latRad),
      r * Math.cos(latRad) * Math.cos(lonRad),
    );
    // Apply same earth tilt as the mesh
    v.applyEuler(this.earth.rotation);
    return v;
  }

  _updateMarkers() {
    if (!this.markerData.length) return;
    const cam = this.camera;
    const w = window.innerWidth, h = window.innerHeight;
    this.markerData.forEach(m => {
      const p = this._latLonToVec3(m.lat, m.lon, 1.02);
      // Visibility test: only show if facing camera (dot with camera→point < 0 means front)
      const camToPoint = p.clone().sub(cam.position);
      const normal = p.clone().normalize();
      const facing = normal.dot(camToPoint.clone().normalize()) < -0.05;

      const proj = p.clone().project(cam);
      const x = (proj.x * 0.5 + 0.5) * w;
      const y = (1 - (proj.y * 0.5 + 0.5)) * h;
      if (m._el) {
        m._el.style.left = x + 'px';
        m._el.style.top = y + 'px';
        m._el.style.opacity = facing && m._el.classList.contains('visible') ? 1 : 0;
      }
    });
  }

  _tick() {
    const dt = this.clock.getDelta();

    // Camera rig: orbit camera around the origin, looking at earth, based on lon/lat/zoom.
    // The earth is fixed; we move the camera. This makes hotspot lat/lon meaningful.
    // Smooth toward target.
    const lerp = (a, b, t) => a + (b - a) * t;
    const k = 1 - Math.pow(0.001, dt); // smoothing factor
    this.currentCam.lon = lerp(this.currentCam.lon, this.targetCam.lon, k);
    this.currentCam.lat = lerp(this.currentCam.lat, this.targetCam.lat, k);
    this.currentCam.zoom = lerp(this.currentCam.zoom, this.targetCam.zoom, k);
    this._lookOffset = lerp(this._lookOffset || 0, this._lookOffsetTarget || 0, k);

    // Auto-rotate when not dragging — adds to lon
    if (this.autoRotate && !this._dragging) {
      this.targetCam.lon += this.rotationSpeed * dt * 60 * 0.4;
    }

    const radius = 4.6 / this.currentCam.zoom; // distance
    const lon = THREE.MathUtils.degToRad(this.currentCam.lon);
    const lat = THREE.MathUtils.degToRad(this.currentCam.lat);
    this.camera.position.set(
      radius * Math.cos(lat) * Math.sin(lon),
      radius * Math.sin(lat),
      radius * Math.cos(lat) * Math.cos(lon),
    );
    // Look slightly above earth center so the globe sits in the lower portion of the frame
    // (this gives us the "top half of earth" hero composition the user wants)
    const lookOffset = this._lookOffset || 0;
    this.camera.lookAt(0, lookOffset, 0);

    // Sun direction — derived from dayNightT.
    // t=1: sun roughly coming from camera direction (full day visible)
    // t=0: sun behind earth from camera POV (night side / city lights)
    const camDir = this.camera.position.clone().normalize();
    const right = new THREE.Vector3().crossVectors(camDir, new THREE.Vector3(0, 1, 0)).normalize();
    if (right.lengthSq() < 0.001) right.set(1, 0, 0);
    // Offset slightly so terminator isn't dead-on
    const sunAngle = (1 - this.dayNightT) * Math.PI * 0.95 + 0.15;
    const sunDir = camDir.clone().multiplyScalar(Math.cos(sunAngle))
      .add(right.clone().multiplyScalar(Math.sin(sunAngle)))
      .normalize();
    this.earthUniforms.uSunDir.value.copy(sunDir);
    this.atmoUniforms.uSunDir.value.copy(sunDir);
    this.sunLight.position.copy(sunDir).multiplyScalar(8);

    // Cloud drift
    if (this.clouds.visible) {
      this.clouds.rotation.y += dt * 0.008;
    }

    this._updateMarkers();
    this.renderer.render(this.scene, this.camera);
  }
}

window.EarthScene = new EarthSceneImpl();
window.EARTH_STYLES = Object.fromEntries(
  Object.entries(STYLES).map(([k, v]) => [k, { label: v.label }])
);
