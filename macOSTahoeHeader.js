// macOSTahoeHeader.js — macOS Tahoe-style top menu bar
// Injects a persistent header with Apple logo, app menus on the left,
// and system indicators on the right: Wi-Fi, battery, Spotlight,
// Control Center, keyboard/locale, and live date/time.
//
// Appears AFTER the lock screen has been dismissed (desktop phase).
// Self-contained IIFE. Idempotent — safe to include multiple times.

(function () {
  'use strict';

  // Prevent double-mount
  if (document.getElementById('mac-header')) return;

  // ── Build DOM ──────────────────────────────────────────────────
  var header = document.createElement('div');
  header.id = 'mac-header';
  header.innerHTML =
    // ── LEFT: Apple logo + app menu items ──
    '<div class="mh-left">' +
      '<div class="mh-item mh-apple" tabindex="0" aria-label="SameerAI">' +
        '<svg class="mh-atom" viewBox="-60 -60 120 120">' +
          '<defs>' +
            '<linearGradient id="mh-orb-cyan" x1="-1" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">' +
              '<stop offset="0" stop-color="#00d2ff" stop-opacity="0"/>' +
              '<stop offset="0.15" stop-color="#00d2ff" stop-opacity="0.6"/>' +
              '<stop offset="0.5" stop-color="#ffffff"/>' +
              '<stop offset="0.85" stop-color="#00d2ff" stop-opacity="0.6"/>' +
              '<stop offset="1" stop-color="#00d2ff" stop-opacity="0"/>' +
            '</linearGradient>' +
            '<linearGradient id="mh-orb-pink" x1="-1" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">' +
              '<stop offset="0" stop-color="#ff6b9d" stop-opacity="0"/>' +
              '<stop offset="0.15" stop-color="#ff6b9d" stop-opacity="0.6"/>' +
              '<stop offset="0.5" stop-color="#c4a0ff"/>' +
              '<stop offset="0.85" stop-color="#ff6b9d" stop-opacity="0.6"/>' +
              '<stop offset="1" stop-color="#ff6b9d" stop-opacity="0"/>' +
            '</linearGradient>' +
            '<linearGradient id="mh-orb-white" x1="-1" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">' +
              '<stop offset="0" stop-color="#a8d4ff" stop-opacity="0"/>' +
              '<stop offset="0.15" stop-color="#a8d4ff" stop-opacity="0.6"/>' +
              '<stop offset="0.5" stop-color="#ffffff"/>' +
              '<stop offset="0.85" stop-color="#a8d4ff" stop-opacity="0.6"/>' +
              '<stop offset="1" stop-color="#a8d4ff" stop-opacity="0"/>' +
            '</linearGradient>' +
            '<radialGradient id="mh-proton" cx="0.3" cy="0.3">' +
              '<stop offset="0" stop-color="#ffffff"/>' +
              '<stop offset="0.25" stop-color="#c4a0ff"/>' +
              '<stop offset="0.55" stop-color="#3a7bd5"/>' +
              '<stop offset="1" stop-color="#1a0a3e"/>' +
            '</radialGradient>' +
          '</defs>' +
          '<g class="mh-orbit mh-orbit-1">' +
            '<ellipse rx="48" ry="18" fill="none" stroke="url(#mh-orb-cyan)" stroke-width="3"/>' +
            '<circle r="6" fill="#00d2ff" filter="drop-shadow(0 0 4px #00d2ff)">' +
              '<animateMotion dur="14s" repeatCount="indefinite"' +
                ' path="M 48 0 A 48 18 0 1 1 -48 0 A 48 18 0 1 1 48 0 Z"/>' +
            '</circle>' +
          '</g>' +
          '<g class="mh-orbit mh-orbit-2" transform="rotate(60)">' +
            '<ellipse rx="48" ry="18" fill="none" stroke="url(#mh-orb-pink)" stroke-width="3"/>' +
            '<circle r="6" fill="#ff6b9d" filter="drop-shadow(0 0 4px #ff6b9d)">' +
              '<animateMotion dur="18s" repeatCount="indefinite"' +
                ' path="M 48 0 A 48 18 0 1 1 -48 0 A 48 18 0 1 1 48 0 Z"/>' +
            '</circle>' +
          '</g>' +
          '<g class="mh-orbit mh-orbit-3" transform="rotate(-60)">' +
            '<ellipse rx="48" ry="18" fill="none" stroke="url(#mh-orb-white)" stroke-width="3"/>' +
            '<circle r="6" fill="#ffffff" filter="drop-shadow(0 0 4px #ffffff)">' +
              '<animateMotion dur="22s" repeatCount="indefinite"' +
                ' path="M 48 0 A 48 18 0 1 1 -48 0 A 48 18 0 1 1 48 0 Z"/>' +
            '</circle>' +
          '</g>' +
          '<circle r="14" fill="url(#mh-proton)">' +
            '<animate attributeName="r" values="13;15;13" dur="4s" repeatCount="indefinite"/>' +
          '</circle>' +
        '</svg>' +
      '</div>' +
      '<div class="mh-item mh-bold">SameerAI</div>' +
    '</div>' +

    // ── RIGHT: Status icons + time ──
    '<div class="mh-right">' +
      /* Battery */
      '<div class="mh-item mh-status" id="mh-battery" title="Battery">' +
        '<span class="mh-battery-text" id="mh-battery-text">100%</span>' +
        '<svg class="mh-icon" viewBox="0 0 26 12" width="25" height="11">' +
          '<rect x="0.5" y="0.5" width="22" height="11" rx="2.5" ry="2.5" fill="none" stroke="currentColor" stroke-width="1" opacity="0.55"/>' +
          '<rect x="23.5" y="3.5" width="1.5" height="5" rx="0.5" fill="currentColor" opacity="0.55"/>' +
          '<rect x="2" y="2" width="19" height="8" rx="1" fill="currentColor" id="mh-battery-fill"/>' +
        '</svg>' +
      '</div>' +

      /* Wi-Fi */
      '<div class="mh-item mh-status" id="mh-wifi" title="Wi-Fi">' +
        '<svg class="mh-icon" viewBox="0 0 20 16" width="17" height="14"><path d="M10 11.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3zM6.5 8.5a5 5 0 017 0l-1.2 1.2a3.3 3.3 0 00-4.6 0L6.5 8.5zM3.5 5.5a9.2 9.2 0 0113 0l-1.2 1.2a7.5 7.5 0 00-10.6 0L3.5 5.5zM.5 2.5a13.4 13.4 0 0119 0L18.3 3.7a11.7 11.7 0 00-16.6 0L.5 2.5z" fill="currentColor"/></svg>' +
      '</div>' +

      /* Spotlight (magnifying glass) */
      '<div class="mh-item mh-status" id="mh-spotlight" title="Spotlight">' +
        '<svg class="mh-icon" viewBox="0 0 16 16" width="15" height="15" fill="none"><circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.5"/><path d="M11 11l3.5 3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>' +
      '</div>' +

      /* Control Center */
      '<div class="mh-item mh-status" id="mh-control" title="Control Center">' +
        '<svg class="mh-icon" viewBox="0 0 18 18" width="16" height="16" fill="none"><rect x="2.5" y="2.5" width="5" height="5" rx="1" fill="currentColor" opacity="0.55"/><rect x="10.5" y="2.5" width="5" height="5" rx="1" fill="currentColor"/><rect x="2.5" y="10.5" width="5" height="5" rx="1" fill="currentColor"/><rect x="10.5" y="10.5" width="5" height="5" rx="1" fill="currentColor" opacity="0.55"/></svg>' +
      '</div>' +

      /* Keyboard / Input locale */
      /* (Removed per user request) */

      /* Date + Time */
      '<div class="mh-item mh-time" id="mh-time"></div>' +
    '</div>';
  document.body.appendChild(header);

  // ── Styles ─────────────────────────────────────────────────────
  var style = document.createElement('style');
  style.id = 'mac-header-style';
  style.textContent =
    '#mac-header{' +
      'position:fixed;top:0;left:0;right:0;z-index:100;' +
      'height:26px;display:flex;align-items:stretch;justify-content:space-between;' +
      'padding:0 10px;' +
      'background:rgba(20,20,28,0.55);' +
      'backdrop-filter:blur(30px) saturate(180%);' +
      '-webkit-backdrop-filter:blur(30px) saturate(180%);' +
      'border-bottom:0.5px solid rgba(255,255,255,0.08);' +
      'font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif;' +
      'color:#fff;font-size:13px;font-weight:400;letter-spacing:0.01em;' +
      'user-select:none;' +
      'opacity:0;transition:opacity 0.6s ease 0.2s;' +
    '}' +
    '#mac-header.ready{opacity:1}' +

    /* Left / right groups */
    '.mh-left,.mh-right{display:flex;align-items:stretch}' +

    /* Menu items */
    '.mh-item{display:flex;align-items:center;padding:0 10px;cursor:default;' +
      'border-radius:5px;margin:2px 0;transition:background 0.12s ease}' +
    '.mh-item:hover{background:rgba(255,255,255,0.12)}' +
    '.mh-item:focus{outline:none;background:rgba(255,255,255,0.12)}' +

    /* Apple logo slot now holds the atom */
    '.mh-apple{padding:0 8px;display:flex;align-items:center;justify-content:center}' +
    '.mh-atom{width:20px;height:20px;display:block;' +
      'animation:mh-atom-spin 30s linear infinite;' +
      'transform-origin:50% 50%}' +
    '.mh-orbit-1{animation:mh-atom-tilt-1 40s linear infinite;transform-origin:50% 50%}' +
    '.mh-orbit-2{animation:mh-atom-tilt-2 50s linear infinite;transform-origin:50% 50%}' +
    '.mh-orbit-3{animation:mh-atom-tilt-3 60s linear infinite;transform-origin:50% 50%}' +
    '@keyframes mh-atom-spin{to{transform:rotate(360deg)}}' +
    '@keyframes mh-atom-tilt-1{from{transform:rotate(0)}to{transform:rotate(360deg)}}' +
    '@keyframes mh-atom-tilt-2{from{transform:rotate(60deg)}to{transform:rotate(420deg)}}' +
    '@keyframes mh-atom-tilt-3{from{transform:rotate(-60deg)}to{transform:rotate(300deg)}}' +

    /* Bold app name (first item after apple) */
    '.mh-bold{font-weight:600;letter-spacing:0.005em}' +

    /* Right-side status icons */
    '.mh-right .mh-status{padding:0 7px;gap:0}' +
    '.mh-icon{display:block;color:#fff}' +

    /* Battery */
    '#mh-battery{gap:5px;padding-right:6px}' +
    '.mh-battery-text{font-size:12px;font-weight:400;opacity:0.95}' +

    /* Keyboard */
    '.mh-keyboard{gap:5px}' +
    '.mh-kbd-flag{font-size:14px;line-height:1;filter:saturate(1.1)}' +
    '.mh-kbd-text{font-size:12px;font-weight:500}' +

    /* Time */
    '.mh-time{font-size:13px;font-weight:400;letter-spacing:0.01em;padding:0 8px}';

  document.head.appendChild(style);

  // ── Clock ──────────────────────────────────────────────────────
  var timeEl = document.getElementById('mh-time');

  function updateTime() {
    var now = new Date();
    var days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    var h = (now.getHours() % 12 || 12).toString();
    var m = now.getMinutes().toString().padStart(2, '0');
    var ampm = now.getHours() >= 12 ? 'PM' : 'AM';
    var dayStr = days[now.getDay()];
    // Format: "Tue 9:41 AM"
    timeEl.textContent = dayStr + ' ' + h + ':' + m + ' ' + ampm;
  }
  updateTime();
  setInterval(updateTime, 10000);

  // ── Battery: fixed at 100% (Battery API is deprecated in modern browsers) ──
  // Intentionally not calling navigator.getBattery() — icon stays at full charge.

  // ── Reveal after lock screen exits ─────────────────────────────
  // If no lock screen is present, show immediately.
  function shouldShow() {
    return !document.getElementById('tahoe-lock')
        && !document.getElementById('mac-intro')
        && !document.getElementById('intro-pclock')
        && !document.getElementById('intro-wp')
        && !document.getElementById('intro-snake')
        && !document.getElementById('intro-v2')
        && !document.getElementById('intro-v3')
        && !document.getElementById('intro-v4')
        && !document.getElementById('intro-v5')
        && !document.getElementById('particle-intro');
  }

  function tryReveal() {
    if (shouldShow()) {
      header.classList.add('ready');
      return true;
    }
    return false;
  }

  if (!tryReveal()) {
    // Poll every 300ms until lock screen is gone
    var poll = setInterval(function () {
      if (tryReveal()) clearInterval(poll);
    }, 300);
    // Safety: reveal after 15s regardless
    setTimeout(function () {
      clearInterval(poll);
      header.classList.add('ready');
    }, 15000);
  }

  // ── Interactions (visual only for now) ─────────────────────────
  // Control Center click — flash placeholder
  var controlBtn = document.getElementById('mh-control');
  if (controlBtn) {
    controlBtn.addEventListener('click', function () {
      controlBtn.style.background = 'rgba(255,255,255,0.22)';
      setTimeout(function () { controlBtn.style.background = ''; }, 180);
    });
  }

  // Spotlight click — open tweaks panel (useful dev shortcut)
  var spotBtn = document.getElementById('mh-spotlight');
  if (spotBtn) {
    spotBtn.addEventListener('click', function () {
      window.postMessage({ type: '__activate_edit_mode' }, '*');
    });
  }

  // Expose for debugging
  window.MacHeader = { el: header, style: style };
})();
