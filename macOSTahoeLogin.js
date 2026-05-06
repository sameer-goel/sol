// macOSTahoeLogin.js — macOS Tahoe Lock Screen (matching reference)
// Layout: Date on top, HUGE time below, avatar+name+password at BOTTOM.
// Wallpaper: cinematic aerial landscape. Minimal chrome — just U.S. locale.
//
// Supports ?name=Sara URL param to pre-fill visitor name.

(function () {
  'use strict';

  var STORAGE_KEY = '__sg_mac_intro_done';

  // Replay helper · always available, even when the lock screen
  // early-returns on subsequent visits. Called by the finale CTA
  // to restart the journey from the very top, with the name kept
  // unless explicitly cleared.
  window.sgReplay = function (opts) {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
      if (opts && opts.clearName) {
        sessionStorage.removeItem('__sg_visitor_name');
      }
    } catch (_) {}
    try { window.scrollTo(0, 0); } catch (_) {}
    window.location.reload();
  };

  // ─── Triple-refresh escape hatch ────────────────────────────────────
  // Hitting reload three times within 2s clears the intro flag so the
  // lock screen shows again. Useful dev shortcut when session state is
  // sticky. Counter resets on any gap longer than 2s.
  (function tripleRefreshReset() {
    var KEY = '__sg_refresh_chain';
    var WINDOW_MS = 2000;
    var now = Date.now();
    var chain = [];
    try {
      var raw = localStorage.getItem(KEY);
      chain = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(chain)) chain = [];
    } catch (_) { chain = []; }
    // Keep only the timestamps within the sliding window
    chain = chain.filter(function (t) { return now - t <= WINDOW_MS; });
    chain.push(now);
    if (chain.length >= 3) {
      // Three refreshes within 2s · reset session and trigger a clean replay.
      try {
        sessionStorage.removeItem(STORAGE_KEY);
        sessionStorage.removeItem('__sg_visitor_name');
        localStorage.removeItem(KEY);
      } catch (_) {}
    } else {
      try { localStorage.setItem(KEY, JSON.stringify(chain)); } catch (_) {}
    }
  })();

  if (sessionStorage.getItem(STORAGE_KEY)) return;

  var urlParams = new URLSearchParams(window.location.search);
  var visitorName = urlParams.get('for') || urlParams.get('name') || '';

  // Hide chrome
  document.querySelectorAll('.top-nav, .progress-rail, .scroll-cue').forEach(function(el) {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.8s ease 0.3s';
  });

  // Wallpaper: aerial fog-covered forest (NASA/Unsplash-style).
  // Using a gradient-based approximation since we can't load external images freely.
  // Soft warm sunrise tones over dark forested peaks with misty fog.
  var WALLPAPER_URL = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=2400&q=80';

  var overlay = document.createElement('div');
  overlay.id = 'tahoe-lock';
  overlay.innerHTML =
    '<div class="tl-wallpaper"></div>' +
    '<div class="tl-overlay-grad"></div>' +

    '<div class="tl-locale">' +
      '<div class="tl-status-icons">' +
        '<svg class="tl-wifi" viewBox="0 0 20 16" width="18" height="14"><path d="M10 11.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3zM6.5 8.5a5 5 0 017 0l-1.2 1.2a3.3 3.3 0 00-4.6 0L6.5 8.5zM3.5 5.5a9.2 9.2 0 0113 0l-1.2 1.2a7.5 7.5 0 00-10.6 0L3.5 5.5zM.5 2.5a13.4 13.4 0 0119 0L18.3 3.7a11.7 11.7 0 00-16.6 0L.5 2.5z" fill="currentColor"/></svg>' +
        '<svg class="tl-battery" viewBox="0 0 26 12" width="24" height="11">' +
          '<rect x="0.5" y="0.5" width="22" height="11" rx="2.5" ry="2.5" fill="none" stroke="currentColor" stroke-width="1" opacity="0.5"/>' +
          '<rect x="23.5" y="3.5" width="1.5" height="5" rx="0.5" fill="currentColor" opacity="0.5"/>' +
          '<rect x="2" y="2" width="15" height="8" rx="1" fill="currentColor"/>' +
        '</svg>' +
      '</div>' +
      '<span class="tl-locale-text">U.S.</span>' +
      '<svg viewBox="0 0 12 8" width="10" height="7"><path d="M1 2l5 4 5-4" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
    '</div>' +

    '<div class="tl-top">' +
      '<div class="tl-date" id="tl-date"></div>' +
      '<div class="tl-time" id="tl-time"></div>' +
    '</div>' +

    '<div class="tl-login">' +
      '<button class="tl-avatar-btn" id="tl-avatar-btn" aria-label="Enter">' +
        '<video class="tl-memoji" id="tl-memoji" muted playsinline preload="auto">' +
          '<source src="assets/WavingHiMemoji.mp4" type="video/mp4">' +
        '</video>' +
      '</button>' +
      '<div class="tl-greeting" id="tl-greeting"></div>' +
      '<div class="tl-inline-input" id="tl-inline-input">' +
        '<input type="text" id="tl-inline-name" placeholder="Your name" autocomplete="off" spellcheck="false"/>' +
        '<button id="tl-inline-submit" aria-label="Enter">' +
          '<svg viewBox="0 0 20 20" fill="none"><path d="M4 10h12M12 6l4 4-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '</button>' +
      '</div>' +
    '</div>' +

    '<div class="tl-name-screen" id="tl-name-screen">' +
      '<div class="tl-name-greeting">Welcome</div>' +
      '<div class="tl-name-prompt">What should I call you?</div>' +
      '<div class="tl-name-input-wrap">' +
        '<input type="text" id="tl-name-input" placeholder="Your name" autocomplete="off" spellcheck="false"/>' +
        '<button id="tl-name-submit" aria-label="Submit">' +
          '<svg viewBox="0 0 20 20" fill="none"><path d="M4 10h12M12 6l4 4-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '</button>' +
      '</div>' +
    '</div>' +

    '<div class="tl-loading" id="tl-loading">' +
      '<div class="tl-loading-welcome" id="tl-loading-welcome">Welcome</div>' +
      '<div class="tl-loading-center">' +
        '<div class="tl-pbar"><div class="tl-pfill" id="tl-pfill"></div></div>' +
        '<div class="tl-loading-label" id="tl-loading-label">Waking up your <em>Agentic SameerAI</em></div>' +
      '</div>' +
    '</div>';
  document.body.prepend(overlay);

  // Lock body scroll while the lock screen is up · unlocked on dismiss
  var scrollLockY = window.scrollY;
  document.body.style.overflow = 'hidden';
  document.body.style.touchAction = 'none';

  var style = document.createElement('style');
  style.textContent =
    '#tahoe-lock{position:fixed;inset:0;z-index:100000;overflow:hidden;' +
      'font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text",system-ui,sans-serif;' +
      'opacity:1;transition:opacity 1.2s ease}' +
    '#tahoe-lock.fade-out{opacity:0;pointer-events:none}' +
    '.top-nav,.progress-rail,.scroll-cue{opacity:0!important;transition:opacity 0.8s ease 0.3s}' +

    /* Wallpaper: aerial foggy forest */
    '.tl-wallpaper{position:absolute;inset:0;z-index:1;' +
      'background-image:url("' + WALLPAPER_URL + '");' +
      'background-size:cover;background-position:center;' +
      'filter:saturate(1.05)}' +

    /* Subtle overlay grad for text legibility */
    '.tl-overlay-grad{position:absolute;inset:0;z-index:2;pointer-events:none;' +
      'background:' +
        'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, transparent 25%, transparent 65%, rgba(0,0,0,0.4) 100%)}' +

    /* Top-right locale + status */
    '.tl-locale{position:absolute;top:4px;right:10px;z-index:10;' +
      'display:flex;align-items:center;gap:12px;' +
      'color:#fff;font-size:12px;font-weight:500;letter-spacing:0.02em;' +
      'text-shadow:0 1px 4px rgba(0,0,0,0.3);cursor:default}' +
    '.tl-status-icons{display:flex;align-items:center;gap:8px;opacity:0.95}' +
    '.tl-wifi,.tl-battery{filter:drop-shadow(0 1px 2px rgba(0,0,0,0.3))}' +
    '.tl-locale-text{opacity:0.9}' +
    '.tl-locale > svg:last-child{opacity:0.8}' +

    /* Top block: date + time */
    '.tl-top{position:absolute;top:10%;left:50%;transform:translateX(-50%);z-index:5;' +
      'display:flex;flex-direction:column;align-items:center;text-align:center}' +
    '.tl-date{font-size:clamp(14px,1.6vw,18px);font-weight:500;color:#fff;' +
      'letter-spacing:-0.005em;text-shadow:0 1px 6px rgba(0,0,0,0.25);margin-bottom:-6px}' +
    '.tl-time{font-size:clamp(80px,11vw,150px);font-weight:600;color:#fff;' +
      'letter-spacing:-0.04em;line-height:1;text-shadow:0 2px 20px rgba(0,0,0,0.25);' +
      'font-family:"SF Pro Rounded","SF Pro Display",-apple-system,BlinkMacSystemFont,system-ui,sans-serif;' +
      'font-feature-settings:"tnum" 1,"ss01" 1}' +

    /* Centered login block */
    '.tl-login{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:5;' +
      'display:flex;flex-direction:column;align-items:center;gap:18px}' +

    /* Animated avatar button */
    '.tl-avatar-btn{position:relative;width:140px;height:140px;border-radius:50%;border:none;' +
      'background:rgba(255,255,255,0.08);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);' +
      'cursor:pointer;padding:0;overflow:visible;' +
      'box-shadow:0 8px 28px rgba(0,0,0,0.35),0 0 0 1px rgba(255,255,255,0.15),' +
      'inset 0 2px 0 rgba(255,255,255,0.15);' +
      'transition:transform 0.3s cubic-bezier(0.34,1.56,0.64,1),box-shadow 0.3s ease}' +
    /* Slow shimmer sweep around memoji (conic highlight chases the edge) */
    '.tl-avatar-btn::before{content:"";position:absolute;inset:-3px;border-radius:50%;' +
      'background:conic-gradient(from 0deg, transparent 0deg, transparent 270deg, rgba(207,230,255,0.6) 305deg, rgba(255,255,255,1) 340deg, rgba(207,230,255,0.6) 360deg, transparent 360deg);' +
      'animation:tl-shimmer 6s linear infinite;z-index:0;' +
      'mask:radial-gradient(circle, transparent 68%, black 72%);' +
      '-webkit-mask:radial-gradient(circle, transparent 68%, black 72%);' +
      'pointer-events:none}' +
    '@keyframes tl-shimmer{to{transform:rotate(360deg)}}' +
    '.tl-avatar-btn:hover::before{animation-duration:2s}' +
    '.tl-avatar-btn:hover{transform:scale(1.06);' +
      'box-shadow:0 12px 36px rgba(0,0,0,0.4),0 0 0 1px rgba(255,255,255,0.25),' +
      'inset 0 2px 0 rgba(255,255,255,0.25)}' +
    '.tl-avatar-btn:active{transform:scale(1.02)}' +

    /* Memoji video */
    '.tl-memoji{width:100%;height:100%;border-radius:50%;object-fit:cover;' +
      'display:block;background:transparent;position:relative;z-index:1}' +

    /* Greeting text (shown when ?for= param is present) */
    '.tl-greeting{font-size:clamp(22px,2.4vw,28px);font-weight:300;color:#fff;' +
      'letter-spacing:-0.01em;text-shadow:0 1px 8px rgba(0,0,0,0.3);text-align:center;' +
      'opacity:0;transform:translateY(4px);transition:opacity 0.5s ease,transform 0.5s ease}' +
    '.tl-greeting.visible{opacity:1;transform:translateY(0)}' +
    '.tl-greeting.hidden{opacity:0;transform:translateY(-4px)}' +

    /* Gradient uppercase name em — matches SAMEERAI styling */
    '.tl-name-em{font-style:normal;font-weight:600;letter-spacing:0.02em;' +
      'background:linear-gradient(135deg,#cfe6ff 0%,#a8d4ff 50%,#ffffff 100%);' +
      '-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;' +
      'margin-left:0.2em}' +

    /* Inline name input (appears after memoji click) */
    '.tl-inline-input{position:relative;width:220px;margin-top:2px;' +
      'max-height:0;opacity:0;overflow:hidden;pointer-events:none;' +
      'transition:max-height 0.4s ease,opacity 0.4s ease 0.1s}' +
    '.tl-inline-input.visible{max-height:50px;opacity:1;pointer-events:auto}' +
    '.tl-inline-input input{width:100%;height:34px;padding:0 40px 0 16px;border:none;border-radius:17px;' +
      'background:rgba(255,255,255,0.18);backdrop-filter:blur(20px) saturate(180%);' +
      '-webkit-backdrop-filter:blur(20px) saturate(180%);color:#fff;font-size:13px;' +
      'font-family:inherit;outline:none;text-align:center;' +
      'box-shadow:inset 0 0 0 0.5px rgba(255,255,255,0.25),0 2px 10px rgba(0,0,0,0.15);' +
      'transition:background 0.2s,box-shadow 0.2s}' +
    '.tl-inline-input input::placeholder{color:rgba(255,255,255,0.55);font-weight:400}' +
    '.tl-inline-input input:focus{background:rgba(255,255,255,0.26);' +
      'box-shadow:inset 0 0 0 0.5px rgba(255,255,255,0.35),0 0 0 2px rgba(255,255,255,0.2),0 2px 12px rgba(0,0,0,0.15)}' +
    '.tl-inline-input button{position:absolute;right:4px;top:50%;transform:translateY(-50%);' +
      'width:26px;height:26px;border:none;border-radius:50%;background:rgba(255,255,255,0.3);' +
      'color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;' +
      'transition:background 0.2s,transform 0.15s}' +
    '.tl-inline-input button:hover{background:rgba(255,255,255,0.45);transform:translateY(-50%) scale(1.08)}' +
    '.tl-inline-input button svg{width:13px;height:13px}' +

    /* Name screen */
    '.tl-name-screen{position:absolute;inset:0;z-index:20;display:none;flex-direction:column;' +
      'align-items:center;justify-content:center;gap:16px;opacity:0;' +
      'background:rgba(10,10,20,0.55);backdrop-filter:blur(30px);-webkit-backdrop-filter:blur(30px);' +
      'transition:opacity 0.5s ease}' +
    '.tl-name-screen.visible{display:flex;opacity:1}' +
    '.tl-name-greeting{font-size:clamp(28px,4vw,42px);font-weight:200;color:#fff}' +
    '.tl-name-prompt{font-size:14px;color:rgba(255,255,255,0.55);margin-bottom:8px}' +
    '.tl-name-input-wrap{position:relative;width:240px}' +
    '.tl-name-input-wrap input{width:100%;height:36px;padding:0 40px 0 16px;border:none;border-radius:18px;' +
      'background:rgba(255,255,255,0.12);backdrop-filter:blur(20px);color:#fff;font-size:14px;' +
      'font-family:inherit;outline:none;transition:background 0.2s,box-shadow 0.2s}' +
    '.tl-name-input-wrap input:focus{background:rgba(255,255,255,0.2);box-shadow:0 0 0 2px rgba(255,255,255,0.3)}' +
    '.tl-name-input-wrap input::placeholder{color:rgba(255,255,255,0.3)}' +
    '.tl-name-input-wrap button{position:absolute;right:5px;top:50%;transform:translateY(-50%);' +
      'width:26px;height:26px;border:none;border-radius:50%;background:rgba(255,255,255,0.25);' +
      'color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0}' +
    '.tl-name-input-wrap button:hover{background:rgba(255,255,255,0.4)}' +
    '.tl-name-input-wrap button svg{width:14px;height:14px}' +

    /* Loading */
    '.tl-loading{position:absolute;inset:0;z-index:30;display:none;flex-direction:column;' +
      'background:#000}' +
    '.tl-loading.active{display:flex}' +

    /* Welcome at top-middle */
    '.tl-loading-welcome{position:absolute;top:18%;left:50%;transform:translateX(-50%);' +
      'font-size:clamp(28px,4vw,44px);font-weight:300;color:#fff;letter-spacing:-0.01em;' +
      'font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display",system-ui,sans-serif;' +
      'text-align:center;white-space:nowrap}' +

    /* Center: progress bar + label directly below */
    '.tl-loading-center{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);' +
      'display:flex;flex-direction:column;align-items:center;gap:24px}' +

    '.tl-pbar{width:240px;height:4px;border-radius:2px;background:rgba(255,255,255,0.12);overflow:hidden}' +
    '.tl-pfill{width:0%;height:100%;border-radius:2px;background:#fff;' +
      'transition:width 1.5s cubic-bezier(0.4,0,0.2,1)}' +
    '.tl-loading-label{font-size:13px;font-weight:400;color:rgba(255,255,255,0.7);' +
      'letter-spacing:0.02em;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif}' +
    '.tl-loading-label em{font-style:normal;font-weight:500;color:#fff;' +
      'background:linear-gradient(135deg,#cfe6ff 0%,#a8d4ff 50%,#ffffff 100%);' +
      '-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;' +
      'letter-spacing:-0.005em;' +
      'transition:filter 0.6s ease,text-shadow 0.6s ease;' +
      'filter:drop-shadow(0 0 0 rgba(207,230,255,0))}' +
    '.tl-loading-label.glowing em{' +
      'filter:drop-shadow(0 0 12px rgba(207,230,255,0.9)) drop-shadow(0 0 24px rgba(168,212,255,0.6));' +
      'animation:tl-ai-glow 1.2s ease-in-out infinite}' +
    '@keyframes tl-ai-glow{' +
      '0%,100%{filter:drop-shadow(0 0 10px rgba(207,230,255,0.8)) drop-shadow(0 0 20px rgba(168,212,255,0.5))}' +
      '50%{filter:drop-shadow(0 0 18px rgba(207,230,255,1)) drop-shadow(0 0 32px rgba(168,212,255,0.8)) drop-shadow(0 0 44px rgba(207,230,255,0.4))}' +
    '}';
  document.head.appendChild(style);

  // ─── Clock ─────────────────────────────────────────────────────
  var timeEl = document.getElementById('tl-time');
  var dateEl = document.getElementById('tl-date');

  function updateClock() {
    var now = new Date();
    var h = (now.getHours() % 12 || 12).toString().padStart(2, '0');
    var m = now.getMinutes().toString().padStart(2, '0');
    timeEl.textContent = h + ':' + m;

    var days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    dateEl.textContent = days[now.getDay()] + ', ' + months[now.getMonth()] + ' ' + now.getDate();
  }
  updateClock();
  var clockInterval = setInterval(updateClock, 10000);

  // ─── Interactions ──────────────────────────────────────────────
  var avatarBtn = document.getElementById('tl-avatar-btn');
  var greetingEl = document.getElementById('tl-greeting');
  var inlineInputWrap = document.getElementById('tl-inline-input');
  var inlineInput = document.getElementById('tl-inline-name');
  var inlineSubmit = document.getElementById('tl-inline-submit');
  var nameScreen = document.getElementById('tl-name-screen');
  var nameInput = document.getElementById('tl-name-input');
  var nameSubmit = document.getElementById('tl-name-submit');
  var loadingEl = document.getElementById('tl-loading');
  var progressFill = document.getElementById('tl-pfill');

  // If name passed via URL, greet them on the lock screen
  if (visitorName) {
    greetingEl.innerHTML = 'Hi <em class="tl-name-em">' + visitorName + '</em>';
    // reveal after a beat so it feels intentional
    setTimeout(function() { greetingEl.classList.add('visible'); }, 400);
  }

  function proceedToName() {
    if (visitorName) {
      window.__visitorName = visitorName;
      sessionStorage.setItem('__sg_visitor_name', visitorName);
      enterDesktop();
      return;
    }
    // Inline input: reveal below memoji
    inlineInputWrap.classList.add('visible');
    setTimeout(function() { inlineInput.focus(); }, 300);
  }

  avatarBtn.addEventListener('click', function() { proceedToName(); });

  // Memoji: play once on load, play once on each hover
  var memojiVideo = document.getElementById('tl-memoji');
  if (memojiVideo) {
    memojiVideo.playbackRate = 1.3;

    // When video ends, reset to first frame so hover triggers a fresh play
    memojiVideo.addEventListener('ended', function() {
      memojiVideo.currentTime = 0;
    });

    // Autoplay once on page load
    var playOnce = memojiVideo.play();
    if (playOnce && typeof playOnce.catch === 'function') {
      playOnce.catch(function() {
        memojiVideo.currentTime = 0;
      });
    }

    // Play once on hover
    avatarBtn.addEventListener('mouseenter', function() {
      memojiVideo.currentTime = 0;
      memojiVideo.playbackRate = 1.3;
      var p = memojiVideo.play();
      if (p && typeof p.catch === 'function') p.catch(function(){});
    });
  }

  function enterDesktop() {
    var name = (inlineInput.value || nameInput.value || '').trim() || visitorName || 'Explorer';
    window.__visitorName = name;
    sessionStorage.setItem(STORAGE_KEY, '1');
    sessionStorage.setItem('__sg_visitor_name', name);

    // Hide inline input
    if (inlineInputWrap) {
      inlineInputWrap.style.opacity = '0';
      inlineInputWrap.style.pointerEvents = 'none';
    }
    if (greetingEl) greetingEl.classList.add('hidden');
    if (avatarBtn) avatarBtn.style.opacity = '0';

    nameScreen.style.opacity = '0';
    nameScreen.style.pointerEvents = 'none';
    loadingEl.classList.add('active');

    // Populate Welcome text at top of loading screen with visitor's name
    var loadingWelcome = document.getElementById('tl-loading-welcome');
    if (loadingWelcome) {
      loadingWelcome.innerHTML = 'Welcome <em class="tl-name-em">' + name.toUpperCase() + '</em>';
    }

    setTimeout(function() { progressFill.style.width = '70%'; }, 100);
    setTimeout(function() { progressFill.style.width = '100%'; }, 800);
    // Trigger glow when progress nearly complete
    setTimeout(function() {
      var label = document.getElementById('tl-loading-label');
      if (label) label.classList.add('glowing');
    }, 2100);

    setTimeout(function() {
      clearInterval(clockInterval);
      overlay.classList.add('fade-out');
      document.querySelectorAll('.top-nav, .progress-rail, .scroll-cue').forEach(function(el) {
        el.style.opacity = '1';
      });
      // Let the rest of the page know the visitor is ready · director.js
      // listens for this to re-read the name into the Welcome beat.
      window.dispatchEvent(new CustomEvent('sg:visitor-ready', {
        detail: { name: name }
      }));
      // Unlock body scroll so the portfolio experience can begin
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
      window.scrollTo(0, scrollLockY);
      setTimeout(function() { overlay.remove(); style.remove(); }, 1300);
    }, 1600);
  }

  inlineSubmit.addEventListener('click', function(e) { e.stopPropagation(); enterDesktop(); });
  inlineInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { e.preventDefault(); enterDesktop(); }
  });

  nameSubmit.addEventListener('click', function(e) { e.stopPropagation(); enterDesktop(); });
  nameInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { e.preventDefault(); enterDesktop(); }
  });

})();
