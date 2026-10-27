import { createScreens, input, tick, typeChar, backspace } from './screens.js';
import { drawScreen, drawCaption } from './drawScreens.js';
import { createLavaBackdrop } from './lavaBackdrop.js';
import { createShowcase, portraitCanvas } from './showcase.js';
import { createAnnouncer } from '../audio/announcer.js';

// The whole front end (gate, title, options, select, VS) with the announcer as captions, for one canvas.
// There is no audio (Eddie's call). The game calls frame(dt) and gets { start, actions } back: start when a race
// should begin, actions for anything online (host, join, pick, ready, startOnline, leaveOnline, cancelJoin).
const KEYMAP = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  Enter: 'ok', Space: 'ok', Escape: 'back',
};
const SETTINGS_KEY = 'rrhr.settings', NAME_KEY = 'rrhr.name';
const TYPING = new Set(['name', 'join']);
const READ_WORDS_PER_SEC = 3.2;

export function createFrontEnd(canvas, { storage = globalThis.localStorage ?? null, onLeave = () => {} } = {}) {
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  let settings = { captions: true };
  try { Object.assign(settings, JSON.parse(storage?.getItem(SETTINGS_KEY) ?? '{}')); } catch { /* bad save: defaults */ }
  const announcer = createAnnouncer({ storage });
  let savedName = '';
  try { savedName = storage?.getItem(NAME_KEY) ?? ''; } catch { /* no storage */ }
  const s = createScreens({ settings, playerName: savedName });
  const actions = [];
  const assets = { lava: createLavaBackdrop(), showcase: createShowcase(), portrait: portraitCanvas };
  let caption = null, captionT = 0, pending = null;

  // Show a line long enough to read it; the announcer won't cut in with something less important meanwhile.
  function show(text) {
    if (!text) return;
    const secs = text.split(/\s+/).length / READ_WORDS_PER_SEC + 0.8;
    announcer.speaking(secs);
    if (!s.settings.captions) return;
    caption = text; captionT = secs;
  }

  function handle(out) {
    if (!out) return;
    if (out.leave) onLeave();
    if (out.setSetting) {
      settings = { ...s.settings };
      try { storage?.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* not saved */ }
    }
    if (out.speak) show(out.speak);
    if (out.say) show(out.say.map(x => announcer.say(x.trigger, x.vars)?.text).filter(Boolean).join(' '));
    if (out.start) { pending = out.start; announcer.save(); }
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
    // only the arrows auto-repeat: a held Enter or Esc must not race through screens (or off the 18+ gate)
    if (!e.repeat || ['up', 'down', 'left', 'right'].includes(action)) handle(input(s, action));
  };
  const onClick = () => { if (s.screen === 'gate') handle(input(s, 'ok')); };
  addEventListener('keydown', onKey);
  canvas.addEventListener('click', onClick);

  // The announcer's caption strip, drawn over whatever is on screen (menus or the race).
  function overlay(dt, place) {
    if (captionT <= 0) return;
    captionT -= dt;
    drawCaption(ctx, caption, Math.min(1, captionT * 2), place);
  }

  return {
    state: s, announcer, overlay,
    frame(dt) {
      handle(tick(s, dt));
      announcer.tick(dt);
      drawScreen(ctx, s, assets, dt);
      // the combo screen's loadout and GO button live at the bottom, so its captions go over the title instead
      overlay(dt, s.screen === 'select' && s.select.step === 'combo' ? { top: 4 } : undefined);
      const start = pending; pending = null;
      return { start, actions: actions.splice(0) };
    },
    // Show an in-race announcer line (from announcer.hear) the same way the menus do.
    caption: show,
    // The game owns the keyboard during a race, however the race was started.
    suspend() { s.screen = 'race'; },
    toSelect() { s.screen = 'select'; s.select.step = 'driver'; },
    toLobby() { s.screen = 'lobby'; },
    toTitle(message) { s.screen = 'title'; s.online = null; s.lobby = null; if (message) s.flash = { text: message, t: 3 }; },
    // A shared #join=CODE link: straight to the join screen with the code filled in (after the name, if needed).
    openJoin(code) {
      s.joinCode = code; s.joinError = null; s.joinStatus = null;
      if (s.playerName) s.screen = 'join'; else { s.screen = 'name'; s.nameFor = 'join'; s.nameInput = ''; s.keepJoinCode = code; }
    },
    dispose() { removeEventListener('keydown', onKey); canvas.removeEventListener('click', onClick); },
  };
}
