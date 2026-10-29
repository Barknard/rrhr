// One place for the look: text styles, colours, layout anchors and UI timings. Change a value here and it changes
// everywhere the HUD, the screens, the captions and the name tags draw it. Sprite and art palettes (voxels, pin-up
// ramps, track and lava colours) are art, not theme, and stay with their art.
import { drawText, textWidth } from './uiFont.js';

const W = 640, H = 360;

// Text styles: which font size a kind of text uses. scale 1 is the 5x7 small font, bigger scales the 3x5 font.
export const TEXT = {
  small:   { scale: 1 }, // hints, card text, HUD labels
  body:    { scale: 2 }, // menu items, headlines on cards
  heading: { scale: 3 },
  title:   { scale: 4 }, // screen titles
  display: { scale: 5 },
  huge:    { scale: 6 }, // PAUSED, GET READY, OPTIONS
  logo:    { scale: 7 },
  mega:    { scale: 9 },
};

export const rgba = (r, g, b, a) => `rgba(${r},${g},${b},${a})`;
// Translucent inks: a base colour plus an alpha chosen at the call site (fades, pulses, scrims).
const INK = { black: [0, 0, 0], veil: [6, 3, 8], panelInk: [8, 6, 12], flash: [255, 244, 214], glow: [216, 60, 22], toast: [60, 10, 8], youTag: [60, 40, 0] };
export const tint = (name, a) => {
  if (!INK[name]) throw new Error(`unknown tint '${name}'`);
  return rgba(...INK[name], a);
};

export const COLOR = {
  // text
  text: '#e8e2ea', white: '#fff', muted: '#a99fb8', hint: '#8a8094', dim: '#6a6070', shadow: '#000', outline: '#1a0608',
  // accents
  gold: '#ffd84a', accent: '#ff6a1a', amber: '#ffb21e', orange: '#ff9a1e', salmon: '#ff8a6a',
  danger: '#ff3b5c', dangerDim: '#7a1020', ok: '#3cff7a', cyan: '#29e3ff', purple: '#d07bff', soon: '#8a5a30',
  // panels and bars
  panel: tint('panelInk', 0.78), panelStrong: tint('panelInk', 0.85), panelSoft: tint('panelInk', 0.55), veil: tint('panelInk', 0.62),
  panelEdge: '#3a2a40', barBack: '#2a2030', armorBack: '#331', portraitBack: '#140e18',
  toast: tint('toast', 0.9), titleVeil: tint('veil', 0.45), pauseVeil: tint('veil', 0.6),
  tagBack: tint('black', 0.7), tagYouBack: tint('youTag', 0.9), tagFallback: '#ccc',
  // buttons and highlighted rows (ember = the hot, selected look)
  ember: '#7a1e0c', emberDim: '#4a120a', emberDeep: '#3a0e08', rowHi: '#3a1810', rowHiDim: '#2a120c',
  // full-screen backgrounds
  gateBg: '#060406', gateHazard: '#7a0c12', loadBg: '#0d0a10',
  // big flaming title text, hottest row first
  fire: ['#fff3a0', '#ffd84a', '#ffb21e', '#ff6a1a', '#d83c16', '#8a1e0c'],
};

export const LAYOUT = {
  screen: { w: W, h: H },
  margin: 3,
  footerY: H - 14, // the key-hint line at the foot of a menu screen
  hud: {
    standings: { x: 3, y: 3, w: 84, h: 6, rowH: 9 }, // w is the minimum; the box widens to fit the longest row. h: 6 + rows * rowH
    lap: { x: W - 58, y: 3, w: 55, h: 24 },
    minimap: { x: W - 123, y: 30, w: 120, h: 76 }, // under the lap timer (the minimap is 120 wide, right-aligned)
    inventory: { x: 4, y: H - 96, w: 172, h: 86 },
    driver: { x: 4, y: H - 120, w: 172, h: 22 },
    banner: { x: 0, y: 28, w: W, h: 11 },
    bomb: { x: 0, y: 44, w: W, h: 11 },
    hint: { x: 150, y: 44, w: W - 300, h: 13 },
    graceY: 44,
    results: { x: 60, y: 50, w: W - 120, h: 38 }, // h grows 11 px per row
    bottomBar: { x: 0, y: H - 10, w: W, h: 10 },
    countdownY: 130,
  },
  caption: { x: 30, w: W - 60, bottomGap: 14, comboTop: 4 },
  nameTag: { x: 0, y: 0, w: 60, h: 11, gap: 1, lift: 30, nameMax: 8 },
  toast: { y: H - 46, h: 20 },
  loading: { bigY: 140, nameY: 182, dotsY: 202 },
  pause: { titleY: 150, hintY: 190 },
};

export const TIMING = {
  bannerSecs: 2, // the default time a race banner stays up
  comingSoonSecs: 1.5, titleMessageSecs: 3,
  readWordsPerSec: 3.2, readPadSecs: 0.8, // caption reading speed
  // the title's intro beats, in seconds after it appears
  slamStart: 0.3, slamEnd: 0.6, taglineStart: 0.5, taglineSecs: 0.6, menuStart: 0.7, menuStagger: 0.07, menuSlideSecs: 0.25, hintAt: 1.2,
  flashStart: 0.3, flashEnd: 0.55,
  pauseBlinkSecs: 0.5,
  // screen transitions (each 0.6 s or less), and how long input is held at the start of one
  trSlam: 0.5, trFlame: 0.55, trWhip: 0.4, trShutter: 0.6, trStatic: 0.35, trLock: 0.15,
  seriesResultsSecs: 1.2, // the race results stay up at least this long before a click moves on to the standings
};

const style = name => TEXT[name] ?? (() => { throw new Error(`unknown text style '${name}'`); })();
// A colour token, or a raw colour that is data (a car's paint, a driver's colour).
export function resolveColor(name) {
  if (name === null) return null;
  const c = COLOR[name];
  if (typeof c === 'string') return c;
  if (typeof name === 'string' && (name.startsWith('#') || name.startsWith('rgb'))) return name;
  throw new Error(`unknown colour '${name}'`);
}

export const styledWidth = (str, styleName) => textWidth(str, style(styleName).scale);

// The one text helper the screens use. align: 'left' (x is the left edge), 'center' (x is the middle), 'right'.
// shadow: a colour token, or null for none; scale overrides the style (animated sizes, like the countdown number).
export function drawStyled(ctx, str, x, y, styleName, colorName = 'text', { align = 'left', shadow = 'shadow', scale = null } = {}) {
  const sc = scale ?? style(styleName).scale;
  const w = textWidth(str, sc);
  const left = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  drawText(ctx, str, left, y, resolveColor(colorName), shadow === null ? null : resolveColor(shadow), sc);
}

// The smoky spotlight behind the gate's pin-up: r is the ring radius, redder toward the middle.
export const smoke = r => rgba(120 + r / 3 | 0, 20, 50 + r / 4 | 0, 0.07);
