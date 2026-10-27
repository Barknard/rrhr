import { CAR_STATS, CAR_KEYS } from './cars/carStats.js';
import { RIGS } from './cars/rigs/index.js';
import { bakeRig } from './cars/rigs/rig.js';
import { createAnim, stepAnim } from './cars/anim.js';
import { createVehicleDrawer } from './render/vehicleDraw.js';
import { drawText, textWidth } from './render/font.js';
import { scaleForWindow, VIEW_W, VIEW_H } from './game/camera.js';

// The showroom: every vehicle on a slowly turning turntable, idling or driving a loop so its wheels,
// legs, rotors and swinging bits animate. ←/→ change vehicle, space toggles motion, ↑/↓ nudge the angle.
const screen = document.getElementById('screen');
const ctx = screen.getContext('2d');
ctx.imageSmoothingEnabled = false;
function fit() {
  const dpr = devicePixelRatio || 1, s = scaleForWindow(innerWidth, innerHeight, dpr);
  screen.style.width = `${(VIEW_W * s) / dpr}px`; screen.style.height = `${(VIEW_H * s) / dpr}px`;
}
addEventListener('resize', fit);
fit();

const vdraw = createVehicleDrawer();
let index = 0, moving = true, spin = 0.5, heading = 0.6, t = 0;
let anim = createAnim();
// a stand-in sim car: drives in place so the animation sees speed, throttle and turning
const car = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, heading: 0, grounded: true, prevInput: {} };
const trailers = [{ x: -1, y: 0, z: 0, heading: 0 }, { x: -2, y: 0, z: 0, heading: 0 }];

function select(i) {
  index = (i + CAR_KEYS.length) % CAR_KEYS.length;
  const key = CAR_KEYS[index];
  ctx.fillStyle = '#0d0a10'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  drawText(ctx, `LOADING ${CAR_STATS[key].name}`, 250, 176, '#ffd84a', '#000', 2);
  anim = createAnim();
  return new Promise(r => setTimeout(() => { bakeRig(RIGS[key]); r(); }, 20));
}

addEventListener('keydown', e => {
  if (e.code === 'ArrowRight') select(index + 1);
  if (e.code === 'ArrowLeft') select(index - 1);
  if (e.code === 'Space') { moving = !moving; e.preventDefault(); }
  if (e.code === 'ArrowUp') heading += Math.PI / 16;
  if (e.code === 'ArrowDown') heading -= Math.PI / 16;
});

function step(dt) {
  t += dt;
  heading += spin * dt;
  // a drive cycle: accelerate, cruise with a weave, brake, idle
  const ph = (t % 8) / 8, speed = moving ? (ph < 0.6 ? Math.min(7, ph * 30) : ph < 0.75 ? 7 * (1 - (ph - 0.6) / 0.15) : 0) : 0;
  const weave = moving && ph > 0.2 && ph < 0.6 ? Math.sin(t * 2.2) : 0;
  car.heading = heading;
  car.vx = Math.cos(heading) * speed; car.vy = Math.sin(heading) * speed;
  car.prevInput = { throttle: moving && ph < 0.6 ? 1 : moving && ph < 0.75 ? -1 : 0, steer: weave };
  stepAnim(anim, car, dt, RIGS[CAR_KEYS[index]].stride ?? 1);
  anim.aim = heading + Math.sin(t * 0.7) * 1.5;
  trailers.forEach((tr, i) => { tr.heading = heading; tr.x = -Math.cos(heading) * (i + 1); tr.y = -Math.sin(heading) * (i + 1); });
}

function render() {
  const key = CAR_KEYS[index], rig = RIGS[key], baked = bakeRig(rig), s = CAR_STATS[key];
  ctx.fillStyle = '#16121a'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  for (let y = 0; y < VIEW_H; y++) { ctx.fillStyle = `rgba(255,90,30,${(y / VIEW_H) * 0.12})`; ctx.fillRect(0, y, VIEW_W, 1); }
  // everything on the turntable is drawn at 2x so the detail is easy to inspect
  ctx.save();
  ctx.translate(VIEW_W / 2, Math.round(VIEW_H * 0.62));
  ctx.scale(2, 2);
  ctx.fillStyle = '#2a2330'; // the turntable: a dithered diamond plate
  for (let y = -30; y <= 30; y++) for (let x = -60; x <= 60; x++) if (Math.abs(x) / 60 + Math.abs(y) / 30 <= 1 && ((x + y) & 1) === 0) ctx.fillRect(x, y, 1, 1);
  const view = (gx, gy) => [(gx - gy) * 28, (gx + gy) * 14];
  const items = [{ d: 0, draw: () => vdraw.blit(ctx, baked, rig.pose(anim, car, t), car.heading, 0, 0) }];
  if (rig.trailerPose) trailers.forEach((tr, i) => items.push({ d: tr.x + tr.y, draw: () => { const [x, y] = view(tr.x, tr.y); vdraw.blit(ctx, baked, rig.trailerPose(anim, { ...tr, index: i }, car, t), tr.heading, x, y); } }));
  items.sort((a, b) => a.d - b.d).forEach(i => i.draw());
  ctx.restore();

  drawText(ctx, s.name, ((VIEW_W - textWidth(s.name, 3)) / 2) | 0, 18, s.color, '#000', 3);
  const facts = [`TOP SPEED ${s.maxSpeed}`, `ACCEL ${s.accel}`, `GRIP ${s.grip}`, `ARMOR ${s.armor}`,
    ...['hover', 'pivot', 'ram', 'ball', 'trailers', 'glide', 'knockMul', 'spinResist'].filter(k => s[k]).map(k => ({
      hover: 'FLOATS OVER MINES AND NAPALM', pivot: 'TURNS ON THE SPOT', ram: 'RAMMING HURTS', ball: 'WRECKING BALL',
      trailers: 'TRAILERS SHOVE CARS', glide: 'GLIDES OFF PADS', knockMul: 'GETS THROWN AROUND', spinResist: 'SHRUGS OFF HARPOONS' }[k]))];
  facts.forEach((f, i) => drawText(ctx, f, 20, 300 - (facts.length - i) * 8 + 40, '#cfd3dc'));
  drawText(ctx, `${index + 1}/${CAR_KEYS.length}   LEFT/RIGHT CHANGE   SPACE ${moving ? 'IDLE' : 'DRIVE'}   UP/DOWN TURN`, 20, VIEW_H - 12, '#a99fb8');
}

let last = performance.now();
function frame(now) {
  step(Math.min(0.05, (now - last) / 1000));
  last = now;
  render();
  requestAnimationFrame(frame);
}
select(0).then(() => requestAnimationFrame(frame));

// Debug handle for checking every vehicle at every angle without the animation loop.
window.showroom = { select, render, step, set heading(h) { heading = h; car.heading = h; }, get key() { return CAR_KEYS[index]; }, anim, car };
