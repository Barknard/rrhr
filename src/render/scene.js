import { Z_SCALE } from '../core/iso.js';
import { composite, stamp } from './world/composite.js';
import { drawFx, drawDisc, pixelLine } from './fx/drawFx.js';
import { bakeModel } from './voxel/bake.js';
import { framesToCanvases } from './vehicleDraw.js';
import { stackModel, beaconModel, crateModel, mineModel, flatSawModel, STACK_TOP, BEACON_TOP } from './props.js';

// Draws a whole frame of the race in HD: the animated world, road stamps, launch pads, ground effects,
// then everything standing on the track depth-sorted (props, crates, mines, fire, saws, harpoons,
// vehicles, trailers), then flying effects and the flash. Browser only.
export { STACK_TOP };

export function bakeSceneSprites() {
  return {
    stack: framesToCanvases(bakeModel(stackModel(), 1))[0],
    beacon: framesToCanvases(bakeModel(beaconModel(), 1))[0],
    crate: framesToCanvases(bakeModel(crateModel(), 32)),
    mine: framesToCanvases(bakeModel(mineModel(), 1))[0],
    saw: framesToCanvases(bakeModel(flatSawModel(), 32)),
  };
}

let shadowCanvas = null;
function shadow() {
  if (shadowCanvas) return shadowCanvas;
  const w = 56, h = 28, c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#05030a';
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const d = Math.hypot((x - w / 2 + 0.5) / (w / 2), (y - h / 2 + 0.5) / (h / 2));
    if (d < 1 && ((x + y) & 1) === 0) g.fillRect(x, y, 1, 1);
  }
  return (shadowCanvas = c);
}

const blit = (ctx, s, x, y) => ctx.drawImage(s.canvas, Math.round(x) - s.ox, Math.round(y) - s.oy);

// s: { race, world, frame: { img, u32 }, cam: { x, y } (top-left of the view in layer px), t, fx, sprites,
//      vehicles: [{ car, rig, baked, anim }], vdraw, viewW, viewH }
export function drawScene(ctx, s) {
  const { race, world, cam, t, fx, sprites, vdraw } = s;
  const view = (gx, gy, zPx = 0) => [world.origin.x + (gx - gy) * 28 - cam.x, world.origin.y + (gx + gy) * 14 - zPx - cam.y];

  for (const st of fx.stamps) { const [x, y] = world.toLayer(st.x, st.y, st.z ?? 0); stamp(world, x, y, st.r, st.type, st.strength); }
  fx.stamps.length = 0;
  composite(world, cam.x, cam.y, t, s.frame.u32, s.viewW, s.viewH);
  ctx.putImageData(s.frame.img, 0, 0);

  // launch pads: blinking cyan chevrons painted on the road
  for (const pad of race.pads) {
    const blink = Math.floor(t * 6) % 3;
    for (let i = 0; i < 3; i++) {
      const along = (i - 1) * 0.7, gx = pad.x + Math.cos(pad.dir) * along, gy = pad.y + Math.sin(pad.dir) * along;
      const [x, y] = view(gx, gy, pad.z * Z_SCALE);
      const [tx, ty] = view(gx + Math.cos(pad.dir), gy + Math.sin(pad.dir), pad.z * Z_SCALE), len = Math.hypot(tx - x, ty - y);
      const ux = (tx - x) / len, uy = (ty - y) / len;
      ctx.fillStyle = i === blink ? '#bff6ff' : '#29e3ff';
      for (let k = -11; k <= 11; k++) {
        const back = Math.abs(k) * 0.6;
        ctx.fillRect(Math.round(x - uy * k - ux * back), Math.round(y + ux * k * 0.5 - uy * back), 3, 2);
      }
    }
  }

  drawFx(ctx, fx, view, 'ground', t);

  const items = [];
  const add = (gx, gy, draw) => items.push({ d: gx + gy, draw });
  for (const p of world.props) {
    add(p.x, p.y, () => {
      const [x, y] = view(p.x, p.y, 0);
      drawDisc(ctx, x + 2, y + 1, 9, 8, 0x05030a);
      blit(ctx, p.type === 'stack' ? sprites.stack : sprites.beacon, x, y);
      if (p.type === 'beacon') {
        const on = (t + p.x) % 1.2 < 0.5;
        if (on) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; drawDisc(ctx, x, y - BEACON_TOP - 1, 9, 5, 0x801010); drawDisc(ctx, x, y - BEACON_TOP - 1, 4, 12, 0xff3030); ctx.restore(); }
        ctx.fillStyle = on ? '#ffe0e0' : '#5a1010'; ctx.fillRect(Math.round(x) - 1, Math.round(y - BEACON_TOP - 2), 2, 2);
      }
    });
  }
  for (const c of race.crates) {
    if (!c.active) continue;
    add(c.x, c.y, () => {
      const [x, y] = view(c.x, c.y, c.z * Z_SCALE);
      drawDisc(ctx, x, y + 1, 6, 6, 0x05030a);
      blit(ctx, sprites.crate[Math.floor(t * 5 + c.s) % 32], x, y - 8 - Math.round(Math.sin(t * 4 + c.s) * 2.5));
    });
  }
  for (const e of race.entities) {
    if (e.type === 'fire') {
      add(e.x, e.y, () => {
        const [x, y] = view(e.x, e.y, e.z * Z_SCALE), fade = Math.max(0.3, 1 - e.age / 5);
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; drawDisc(ctx, x, y, 14 * fade, 6, 0x802a08); ctx.restore();
        for (let i = 0; i < 8 * fade; i++) {
          const a = i * 2.4 + t * 3, r = (i % 4) * 3, fy = y - ((t * 30 + i * 9) % 14);
          drawDisc(ctx, x + Math.cos(a) * r * 1.6, fy + Math.sin(a) * r * 0.5, 2.5 - ((t * 30 + i * 9) % 14) / 8, 16, [0xff3d00, 0xffb21e, 0xfff3a0][i % 3]);
        }
      });
    } else if (e.type === 'mine') {
      add(e.x, e.y, () => {
        const [x, y] = view(e.x, e.y, e.z * Z_SCALE);
        if (e.age >= 0.5) {
          const cols = ['#6b2bb8', '#b14dff', '#e2b3ff'];
          for (let k = 0; k < 3; k++) {
            const rx = 24 - k * 7;
            ctx.fillStyle = cols[k];
            for (let q = 0; q < 36; q++) {
              if (q % 4 === 0) continue;
              const a = (q / 36) * 6.283 + t * (2 + k * 1.5);
              ctx.fillRect(Math.round(x + Math.cos(a) * rx), Math.round(y + Math.sin(a) * rx * 0.5), 2, 1);
            }
          }
        }
        blit(ctx, sprites.mine, x, y);
        if (Math.floor(t * 5) % 2) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; drawDisc(ctx, x, y - 5, 4, 10, 0xff2440); ctx.restore(); }
      });
    } else if (e.type === 'saw') {
      add(e.x, e.y, () => {
        const [x, y] = view(e.x, e.y, e.z * Z_SCALE), [gx, gy] = view(e.x, e.y, (e.z - 4) * Z_SCALE);
        drawDisc(ctx, gx, gy + 1, 6, 7, 0x05030a);
        blit(ctx, sprites.saw[Math.floor(t * 40) % 32], x, y);
      });
    } else if (e.type === 'harpoon') {
      add(e.x, e.y, () => {
        const [x, y] = view(e.x, e.y, e.z * Z_SCALE), [ox, oy] = view(e.owner.x, e.owner.y, (e.owner.z + 5) * Z_SCALE);
        pixelLine(ctx, ox, oy + 1, x, y + 1, '#5a4a30'); pixelLine(ctx, ox, oy, x, y, '#d8c49a');
        ctx.fillStyle = '#e8e8f0'; ctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 5, 5);
        ctx.fillStyle = '#6a7080'; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
      });
    }
  }
  // a vehicle's composite spans 112 px around its anchor: skip any whose box is entirely off the view
  const onScreen = (gx, gy, zPx) => { const [x, y] = view(gx, gy, zPx); return x > -112 && x < s.viewW + 112 && y > -112 && y < s.viewH + 112; };
  for (const v of s.vehicles) {
    const { car, rig, baked, anim } = v;
    if (car.wrecked) continue;
    if (onScreen(car.x, car.y, car.z * Z_SCALE)) add(car.x, car.y, () => {
      const g = race.track.groundAt(car.x, car.y);
      if (Number.isFinite(g) && !car.fallen) { const [sx, sy] = view(car.x, car.y, g * Z_SCALE); ctx.drawImage(shadow(), Math.round(sx) - 28, Math.round(sy) - 12); }
      const [x, y] = view(car.x, car.y, car.z * Z_SCALE);
      vdraw.blit(ctx, baked, rig.pose(anim, car, t), car.heading, x, y);
      if (car.bomb) {
        const [bx, by] = view(car.x, car.y, car.z * Z_SCALE + 44);
        drawDisc(ctx, bx, by, 4, 16, 0x16141c, 0x4a4652);
        ctx.fillStyle = Math.floor(t * (car.bomb.fuse < 1.5 ? 14 : 6)) % 2 ? '#ff3b5c' : '#ffe14a';
        ctx.fillRect(Math.round(bx) + 2, Math.round(by) - 7, 2, 3);
      }
      if (car.human) {
        const [hx, hy] = view(car.x, car.y, car.z * Z_SCALE + 54 + Math.sin(t * 5) * 2);
        ctx.fillStyle = '#000'; ctx.fillRect(Math.round(hx) - 4, Math.round(hy) - 1, 9, 6);
        ctx.fillStyle = car.color;
        ctx.fillRect(Math.round(hx) - 3, Math.round(hy), 7, 1); ctx.fillRect(Math.round(hx) - 2, Math.round(hy) + 1, 5, 1);
        ctx.fillRect(Math.round(hx) - 1, Math.round(hy) + 2, 3, 1); ctx.fillRect(Math.round(hx), Math.round(hy) + 3, 1, 1);
      }
    });
    if (rig.trailerPose && car.trailers && !car.wrecked) {
      car.trailers.forEach((tr, index) => onScreen(tr.x, tr.y, tr.z * Z_SCALE) && add(tr.x, tr.y, () => {
        const g = race.track.groundAt(tr.x, tr.y);
        if (Number.isFinite(g)) { const [sx, sy] = view(tr.x, tr.y, g * Z_SCALE); ctx.drawImage(shadow(), Math.round(sx) - 28, Math.round(sy) - 12); }
        const [x, y] = view(tr.x, tr.y, tr.z * Z_SCALE);
        vdraw.blit(ctx, baked, rig.trailerPose(anim, { ...tr, index }, car, t), tr.heading, x, y);
      }));
    }
  }
  items.sort((a, b) => a.d - b.d);
  for (const it of items) it.draw();

  drawFx(ctx, fx, view, 'air', t);
  if (fx.flash > 0) { ctx.fillStyle = `rgba(255,244,214,${Math.min(0.6, fx.flash * 5)})`; ctx.fillRect(0, 0, s.viewW, s.viewH); }
  return view;
}
