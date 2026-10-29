// The pause overlay as a pure state machine: RESUME / QUIT TO MENU offline, RESUME / LEAVE RACE online (an online
// race cannot actually pause). Quitting a series and leaving an online race ask YES / NO first.
import { LAYOUT } from '../ui/theme.js';

const VIEW_W = 640;
export const PAUSE_LABEL = { resume: 'RESUME', quit: 'QUIT TO MENU', leave: 'LEAVE RACE', yes: 'YES', no: 'NO' };
const wrap = (i, n) => ((i % n) + n) % n;

export const createPauseMenu = ({ series = false, online = false } = {}) => ({ series, online, confirm: null, idx: 0 });

export const pauseItems = p => (p.confirm ? ['yes', 'no'] : p.online ? ['resume', 'leave'] : ['resume', 'quit']);
export const pauseTitle = p => (p.confirm === 'series' ? 'QUIT THE SERIES?' : p.confirm === 'leave' ? 'LEAVE THE RACE?' : p.online ? 'RACE MENU' : 'PAUSED');

// action: 'up' | 'down' | 'left' | 'right' | 'ok' | 'back' | 'select' (arg = item index).
// Returns 'resume' | 'menu' | 'leave' when the overlay is finished, else null.
export function pauseInput(p, action, arg = 0) {
  const items = pauseItems(p);
  if (action === 'select') { p.idx = wrap(arg, items.length); return null; }
  if (action === 'up' || action === 'down' || action === 'left' || action === 'right') {
    p.idx = wrap(p.idx + (action === 'up' || action === 'left' ? -1 : 1), items.length); return null;
  }
  if (action === 'back') { if (p.confirm) { p.confirm = null; p.idx = 0; return null; } return 'resume'; }
  if (action !== 'ok') return null;
  const item = items[p.idx];
  if (item === 'resume') return 'resume';
  if (item === 'no') { p.confirm = null; p.idx = 0; return null; }
  if (item === 'yes') return p.confirm === 'leave' ? 'leave' : 'menu';
  if (item === 'leave') { p.confirm = 'leave'; p.idx = 1; return null; } // NO is the safe default
  if (p.series) { p.confirm = 'series'; p.idx = 1; return null; }
  return 'menu';
}

// Button rectangles in canvas pixels, for drawing and for hit regions.
export function pauseRects(p) {
  const { btnW, btnH, btnGap, btnY } = LAYOUT.pause;
  return pauseItems(p).map((id, i) => ({ id, i, x: (VIEW_W - btnW) / 2, y: btnY + i * (btnH + btnGap), w: btnW, h: btnH }));
}
