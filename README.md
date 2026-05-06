# sol

Act I · Director's Cut — **The Meaningful World.** A scroll-driven landing
experience: two intelligences (Inner + Artificial) converge into Earth, which
becomes a rotating dial for a portfolio of six solutions.

## Run locally

Any static server from this directory works. Easiest:

```bash
python3 -m http.server 8765
# then open http://localhost:8765/
```

Hard-refresh (Cmd+Shift+R) after edits.

## Files

- `index.html` — DOM scaffolding, importmap, beats, stock-footage slots
- `styles.css` — typography, atmosphere gradient, footage split, dial chrome
- `director.js` — scroll loop, inner brain canvas, artificial net canvas,
  narration, Earth camera, solutions dial
- `earth-scene.js` — Three.js globe engine (`window.EarthScene`)

## Optional footage

Drop the following to enable the split-screen stock footage behind the menu:

```
assets/footage-war.mp4    # left · the world as it is
assets/footage-help.mp4   # right · the world we build together
```

If absent, a tonal fallback (red wash left, teal wash right) shows instead.
