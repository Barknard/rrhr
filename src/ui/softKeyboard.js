import { LAYOUT } from './theme.js';

// The tap keyboard for the name and room-code screens on a phone, where a canvas brings up no keyboard of its own.
// Rows are 10 units wide; a key's number is how many units it spans. Room codes are letters only.
const ROWS = {
  name: [[...'1234567890'], [...'QWERTYUIOP'], [...'ASDFGHJKL', 'DEL'], [...'ZXCVBNM', 'SPC', ['OK', 2]]],
  join: [[...'QWERTYUIOP'], [...'ASDFGHJKL', 'DEL'], [...'ZXCVBNM', ['OK', 3]]],
};

// -> [{ k, x, y, w, h }] in 640x360 canvas pixels; empty on any other screen.
export function softKeys(screen) {
  const rows = ROWS[screen];
  if (!rows) return [];
  const { keyW, keyH, gap, top, back } = LAYOUT.keyboard;
  const rowW = 10 * keyW + 9 * gap, x0 = Math.round((LAYOUT.screen.w - rowW) / 2), keys = [];
  rows.forEach((row, r) => {
    let x = x0;
    for (const key of row) {
      const [k, units] = Array.isArray(key) ? key : [key, 1], w = units * keyW + (units - 1) * gap;
      keys.push({ k, x, y: top[screen] + r * (keyH + gap), w, h: keyH });
      x += w + gap;
    }
  });
  keys.push({ k: 'BACK', ...back });
  return keys;
}
