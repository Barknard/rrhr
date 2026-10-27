import { builder } from '../../render/voxel/builder.js';
import { partSet } from './rig.js';
import { tyre, rod, ball, bodyOffset, fourWheels } from './parts.js';
import { VOX } from '../../core/iso.js';
import { BALL } from '../../combat/abilities.js';

// Demo Derrick: a yellow tow truck whose crane swings a wrecking ball on a chain behind it.
// The ball's position is simulation state (car.ball); here it is drawn where the sim says it is.
const YEL = 0xffd23a, YEL_L = 0xffe98a, YEL_D = 0xa08010, BLK = 0x16141c, CHROME = 0xd2d8e2, GLASS = 0x1f4f7a,
  IRON = 0x3a3a44, IRON_L = 0x6a6a78, STEEL = 0x7d8494, AMBER = 0xff9a1e, HEAD = 0xfff2b8;
const BOOM_TIP = [-20, 0, 26], LINKS = 7;

function body() {
  const m = builder(40, 20, 30);
  m.box(2, 5, 1, 37, 14, 2, BLK);
  for (let x = 2; x <= 37; x++) for (let y = 2; y <= 17; y++) {
    const cabin = x >= 22 && x <= 31, hood = x > 31, top = cabin ? 15 : hood ? 9 : 6;
    m.box(x, y, 3, x, y, top, y === 2 || y === 17 ? YEL_D : YEL);
    m.set(x, y, top, ((x + y) >> 1) & 1 && !cabin && !hood ? BLK : YEL_L); // hazard deck
  }
  for (let y = 4; y <= 15; y++) for (let z = 11; z <= 14; z++) m.set(31, y, z, GLASS, 'glass');
  for (const y of [2, 17]) m.box(24, y, 11, 29, y, 14, GLASS, 'glass');
  for (const y of [7, 12]) m.set(29, y, 16, AMBER, 'emit'); // roof beacons
  m.box(26, 6, 16, 28, 13, 16, BLK);
  // the crane: an A-frame from the deck up and back to the boom tip
  const tip = [BOOM_TIP[0] + 20, 9.5, BOOM_TIP[2]];
  for (const y of [5, 14]) rod(m, [16, y, 6], tip, 1, YEL_D);
  rod(m, [8, 9.5, 6], tip, 0.6, STEEL);
  ball(m, ...tip, 1.6, CHROME, 'chrome');
  for (const y of [4, 15]) m.set(38, y, 6, HEAD, 'emit');
  return m.done();
}

function wreckingBall() {
  const m = builder(13, 13, 13);
  ball(m, 6, 6, 6, 5.6, IRON);
  for (const [x, y, z] of [[8, 4, 9], [9, 4, 8], [8, 5, 10]]) m.set(x, y, z, IRON_L);
  m.box(5, 5, 11, 7, 7, 12, STEEL); // shackle
  return m.done();
}

function link() {
  const m = builder(3, 3, 3);
  m.box(0, 1, 0, 2, 1, 2, STEEL, 'chrome'); m.set(1, 1, 1, BLK);
  return m.done();
}

export const demoDerrick = {
  key: 'demoDerrick',
  sets: { body: partSet(body), ball: partSet(wreckingBall), link: partSet(link), rear: tyre(5.5, 4), front: tyre(4.5, 3) },
  pose(anim, car, t) {
    const b = bodyOffset(anim);
    // where the sim's ball is, in this vehicle's own space (voxels); default: hanging straight behind
    let bx = -BALL.chain * VOX, by = 0;
    if (car.ball && Number.isFinite(car.ball.x)) {
      const dx = car.ball.x - car.x, dy = car.ball.y - car.y, c = Math.cos(car.heading), s = Math.sin(car.heading);
      bx = (dx * c + dy * s) * VOX; by = (-dx * s + dy * c) * VOX;
    }
    const top = [bx, by, 12], tip = [BOOM_TIP[0] + b.ox, BOOM_TIP[1] + b.oy, BOOM_TIP[2] + b.oz];
    const links = [];
    for (let i = 1; i < LINKS; i++) {
      const k = i / LINKS, sag = Math.sin(Math.PI * k) * 3;
      links.push({ set: 'link', ox: tip[0] + (top[0] - tip[0]) * k, oy: tip[1] + (top[1] - tip[1]) * k, oz: tip[2] + (top[2] - tip[2]) * k - sag - 1 });
    }
    return [
      { set: 'body', ...b },
      ...fourWheels(anim, t, { rx: -10, ry: 9, rr: 5.5, fx: 12, fy: 9, fr: 4.5 }),
      { set: 'ball', ox: bx, oy: by, oz: 1 },
      ...links,
    ];
  },
};
