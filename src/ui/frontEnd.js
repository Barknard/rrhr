import { createScreens, input, tick, typeChar, backspace, pointer, enterSeriesScreen, DEFAULT_SETTINGS } from './screens.js';
import { createHitRegions, toCanvas } from './hitRegions.js';
import { createTransitioner, transitionFor } from './transitions.js';
import { loadUnlocks } from '../series/series.js';
import { drawScreen, drawCaption } from './drawScreens.js';
import { loadIntroSettings, createIntroPlayer, shouldPlay, markPlayed, createGateVideo } from './introVideo.js';
import { createLavaBackdrop } from './lavaBackdrop.js';
import { createShowcase, portraitCanvas } from './showcase.js';
import { createAnnouncer } from '../audio/announcer.js';
import { busVolumes } from '../audio/soundMap.js';
import { LAYOUT, TIMING } from './theme.js';

// The whole front end (gate, title, options, select, VS, series screens) with the announcer as captions and voice,
// for one canvas. Every screen change plays a transition over the new screen (input is held for its first moments),
// and the mouse works everywhere: hover selects, click activates, right-click is back.
// audio (audioPlayer.js) plays the menu sfx and the gate drone; voice (voice.js) speaks Mel's lines; the OPTIONS
// switches set their volumes. The game calls frame(dt) and gets { start, actions } back: start when a race should
// begin, actions for anything online (host, join, pick, ready, startOnline, leaveOnline, cancelJoin).
const KEYMAP = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  Enter: 'ok', Space: 'ok', Escape: 'back',
};
const SETTINGS_KEY = 'rrhr.settings', NAME_KEY = 'rrhr.name';
const TYPING = new Set(['name', 'join']);
const UI_SFX = ['ui_move', 'ui_select', 'ui_back', 'ui_buy', 'ui_broke'];
const GATE_DRONE = 0.35; // gate_warning, quietly under the gate

export function createFrontEnd(canvas, { storage = globalThis.localStorage ?? null, onLeave = () => {}, audio = null, voice = null } = {}) {
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  let settings = { ...DEFAULT_SETTINGS };
  try { Object.assign(settings, JSON.parse(storage?.getItem(SETTINGS_KEY) ?? '{}')); } catch { /* bad save: defaults */ }
  const announcer = createAnnouncer({ storage });
  let savedName = '';
  try { savedName = storage?.getItem(NAME_KEY) ?? ''; } catch { /* no storage */ }
  const s = createScreens({ settings, playerName: savedName, unlocks: loadUnlocks(storage) });
  const actions = [];
  audio?.preload(UI_SFX);
  audio?.setVolumes(busVolumes(s.settings));
  const hits = createHitRegions(), tr = createTransitioner();
  const assets = { lava: createLavaBackdrop(), showcase: createShowcase(), portrait: portraitCanvas, hits };
  // The outgoing frame for a transition: copied off the canvas before the new screen draws over it.
  const snap = Object.assign(document.createElement('canvas'), { width: canvas.width, height: canvas.height });
  const snapCtx = snap.getContext('2d');
  const nameOf = () => (s.screen === 'select' ? s.select.step : s.screen); // the select's phases are 'driver' and 'ride'
  let shown = nameOf();
  function transition(from, to) {
    snapCtx.clearRect(0, 0, snap.width, snap.height);
    snapCtx.drawImage(canvas, 0, 0);
    tr.start(transitionFor(from, to), snap);
  }
  let introSettings = null, introStore = null;
  try { introStore = globalThis.sessionStorage ?? null; } catch { /* blocked */ }
  loadIntroSettings().then(cfg => {
    introSettings = cfg;
    if (cfg?.placement === 'gate' && s.screen === 'gate') { assets.gateVideo = createGateVideo(cfg); assets.gateVideo.start(); } // on the gate's left side
  }); // the intro video slot; null: straight to the title
  const refreshIntro = () => { s.introReady = shouldPlay(introSettings, introStore); };
  let caption = null, captionT = 0, pending = null;

  // Show a line long enough to read it; the announcer won't cut in with something less important meanwhile.
  function show(text) {
    if (!text) return;
    const secs = text.split(/\s+/).length / TIMING.readWordsPerSec + TIMING.readPadSecs;
    announcer.speaking(secs);
    if (!s.settings.captions) return;
    caption = text; captionT = secs;
  }

  // Mel's voice for announcer utterances, one after another; a newer line cuts the rest. Lines without clips are quiet.
  // While a line plays the announcer counts as busy (speaking), so only a bigger moment cuts him off. Resolves when
  // he's done (at once with the voice off).
  let voiceTurn = 0;
  function speak(...utterances) {
    const mine = ++voiceTurn;
    if (!voice || !s.settings.voice) return Promise.resolve();
    const busy = secs => announcer.speaking(secs);
    return utterances.filter(Boolean).reduce((p, u) => p.then(() => (mine === voiceTurn ? voice.speak(u, { onStart: busy }) : null)), Promise.resolve());
  }

  function handle(out) {
    if (!out) return;
    if (out.leave) onLeave();
    if (out.sfx) audio?.play(out.sfx);
    if (out.setSetting) {
      settings = { ...s.settings };
      audio?.setVolumes(busVolumes(settings));
      if (!settings.voice) { voiceTurn++; voice?.stop(); }
      try { storage?.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* not saved */ }
    }
    if (out.introStart && introSettings) {
      assets.introPlayer = createIntroPlayer(introSettings, { lava: assets.lava, onPlaying: () => { if (introSettings.oncePerSession) markPlayed(introStore); } });
      assets.introPlayer.start(); // inside the gate's key or click: autoplay is allowed
    }
    if (out.gateAccept && assets.gateVideo) { assets.gateVideo.unmute(); assets.gateVideo.stop(); assets.gateVideo = null; } // the click that accepts also unmutes; then it is released
    if (out.introStop) { assets.introPlayer?.stop(); assets.introPlayer = null; }
    if (out.speak) show(out.speak);
    if (out.say) {
      const lines = out.say.map(x => announcer.say(x.trigger, x.vars)).filter(Boolean);
      show(lines.map(u => u.text).join(' '));
      speak(...lines);
    }
    if (out.start) { pending = out.start; announcer.save(); }
    for (const k of ['seriesNext', 'seriesRetry', 'seriesQuit']) if (out[k]) actions.push({ [k]: true });
    if (out.saveName) { try { storage?.setItem(NAME_KEY, out.saveName); } catch { /* not saved */ } }
    for (const k of ['online', 'join', 'pick', 'ready', 'startOnline', 'leaveOnline', 'cancelJoin']) if (out[k]) actions.push({ [k]: out[k] });
  }

  const onKey = e => {
    if (TYPING.has(s.screen) && !e.ctrlKey && !e.metaKey && !e.altKey) { // the name and room-code boxes take letters
      if (e.key === 'Backspace') { e.preventDefault(); backspace(s); return; }
      if (e.key.length === 1 && e.key !== ' ' || (e.key === ' ' && s.screen === 'name')) { e.preventDefault(); typeChar(s, e.key); return; }
      if (e.code !== 'Enter' && e.code !== 'Escape') return;
    }
    const action = KEYMAP[e.code];
    if (!action || s.screen === 'race') return;
    e.preventDefault();
    if (tr.locked) return; // a transition is holding input: a double-press can't skip a screen
    // only the arrows auto-repeat: a held Enter or Esc must not race through screens (or off the 18+ gate)
    if (!e.repeat || ['up', 'down', 'left', 'right'].includes(action)) handle(input(s, action));
  };
  // The pointer: regions are in canvas pixels, the events in CSS pixels.
  const regionAt = e => { const p = toCanvas(e.clientX, e.clientY, canvas.getBoundingClientRect(), canvas.width, canvas.height); return hits.at(p.x, p.y); };
  const live = () => s.screen !== 'race';
  const onMove = e => {
    if (!live()) return;
    const r = regionAt(e);
    canvas.style.cursor = r ? 'pointer' : 'default';
    for (const out of pointer(s, r, 'move', tr.locked)) handle(out);
  };
  const onClick = e => { if (live()) for (const out of pointer(s, regionAt(e), 'click', tr.locked)) handle(out); };
  const onContext = e => { e.preventDefault(); if (live()) for (const out of pointer(s, null, 'back', tr.locked)) handle(out); };
  addEventListener('keydown', onKey);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('click', onClick);
  canvas.addEventListener('contextmenu', onContext);

  function drawTransition(dt) { tr.step(dt); tr.draw(ctx); }

  // The announcer's caption strip, drawn over whatever is on screen (menus or the race).
  function overlay(dt, place) {
    if (captionT <= 0) return;
    captionT -= dt;
    drawCaption(ctx, caption, Math.min(1, captionT * 2), place);
  }

  return {
    state: s, announcer, overlay,
    frame(dt) {
      if (s.screen === 'gate') refreshIntro();
      s.introEnded = !!assets.introPlayer?.ended;
      handle(tick(s, dt));
      announcer.tick(dt);
      if (s.screen === 'gate') audio?.loop('gate', 'gate_warning', { gain: GATE_DRONE }); else audio?.stopLoop('gate');
      s.captionOn = captionT > 0;
      const now = nameOf();
      if (now !== shown && now !== 'race') transition(shown, now); // the canvas still holds the old screen
      shown = now;
      hits.clear();
      drawScreen(ctx, s, assets, dt);
      // full-screen pages keep their buttons at the bottom, so captions take the title's place at the top
      overlay(dt, ['select', 'standings'].includes(s.screen) ? { top: LAYOUT.caption.comboTop } : undefined);
      drawTransition(dt);
      const start = pending; pending = null;
      return { start, actions: actions.splice(0) };
    },
    // The game's own screen changes (into a race or a transmission): snapshot what's on the canvas now, then play
    // the effect over whatever the game draws next (it calls drawTransition after drawing).
    transition(from, to) { transition(from, to); shown = to; },
    drawTransition,
    get locked() { return tr.locked; },
    setTouch(on) { s.touch = !!on; },
    showSeries(screen, view) { enterSeriesScreen(s, screen, view); },
    // Show an in-race announcer line (from announcer.hear) the same way the menus do.
    caption: show,
    // ...and voice it (an utterance from announcer.say / hear), when ANNOUNCER VOICE is on.
    speak,
    // The game owns the keyboard during a race, however the race was started.
    suspend() { s.screen = 'race'; shown = 'race'; },
    toSelect() { s.screen = 'select'; s.select.step = 'driver'; },
    toLobby() { s.screen = 'lobby'; },
    toTitle(message) { s.screen = 'title'; s.online = null; s.lobby = null; if (message) s.flash = { text: message, t: TIMING.titleMessageSecs }; },
    // A shared #join=CODE link: straight to the join screen with the code filled in (after the name, if needed).
    openJoin(code) {
      s.joinCode = code; s.joinError = null; s.joinStatus = null;
      if (s.playerName) s.screen = 'join'; else { s.screen = 'name'; s.nameFor = 'join'; s.nameInput = ''; s.keepJoinCode = code; }
    },
    dispose() {
      removeEventListener('keydown', onKey);
      canvas.removeEventListener('pointermove', onMove); canvas.removeEventListener('click', onClick); canvas.removeEventListener('contextmenu', onContext);
    },
  };
}
