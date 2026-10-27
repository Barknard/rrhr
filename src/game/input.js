// WASD and arrow keys both drive the same car. Opposite keys cancel; doubled keys don't stack.
const UP = ['KeyW', 'ArrowUp'], DOWN = ['KeyS', 'ArrowDown'], LEFT = ['KeyA', 'ArrowLeft'], RIGHT = ['KeyD', 'ArrowRight'];
const any = (keys, codes) => codes.some(c => keys.has(c));

export function combineKeys(keys) {
  return {
    throttle: (any(keys, UP) ? 1 : 0) - (any(keys, DOWN) ? 1 : 0),
    steer: (any(keys, RIGHT) ? 1 : 0) - (any(keys, LEFT) ? 1 : 0),
  };
}

// Nitro is deliberately not on Ctrl: Ctrl+W closes the browser tab mid-race.
const FIRE = ['Space'], DROP = ['ShiftLeft', 'ShiftRight'], NITRO = ['KeyE', 'Enter'];

export function actionKeys(keys) {
  return { fire: any(keys, FIRE), drop: any(keys, DROP), nitro: any(keys, NITRO) };
}

const CAPTURED = new Set([...UP, ...DOWN, ...LEFT, ...RIGHT, ...FIRE, ...DROP, ...NITRO, 'Tab']);

// Browser-only: tracks held keys. onPress(code) fires once per key press (not on repeat).
export function createInput(target = window, onPress = () => {}) {
  const keys = new Set();
  target.addEventListener('keydown', e => {
    if (CAPTURED.has(e.code)) e.preventDefault();
    if (!e.repeat) onPress(e.code);
    keys.add(e.code);
  });
  target.addEventListener('keyup', e => keys.delete(e.code));
  target.addEventListener('blur', () => keys.clear());
  return { keys, read: () => ({ ...combineKeys(keys), ...actionKeys(keys) }) };
}
