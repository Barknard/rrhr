import { smallWidth } from './smallFont.js';
import { LAYOUT, COLOR, drawStyled } from '../ui/theme.js';

// Name-tag cards above every live car: a car-colour stripe, the race place and the driver's short name.
// The player's card says YOU and is highlighted. Cards that would overlap are stacked upward so all stay readable.
export const TAG_H = LAYOUT.nameTag.h, TAG_GAP = LAYOUT.nameTag.gap, TAG_LIFT = LAYOUT.nameTag.lift, NAME_MAX = LAYOUT.nameTag.nameMax;

export function layoutTags(cars, project, order, player = null) {
  const tags = [];
  for (const car of cars) {
    if (car.wrecked || car.fallen || car.flying) continue;
    const place = order.indexOf(car) + 1;
    const label = car === player ? 'YOU' : String(car.name).slice(0, NAME_MAX);
    const p = project(car);
    const w = 3 + 3 + smallWidth(`${place} ${label}`) + 3; // stripe, gaps, text
    tags.push({ car, x: Math.round(p.x - w / 2), y: Math.round(p.y) - TAG_LIFT, w, label, place });
  }
  // Resolve overlaps: process lowest on screen first and lift any card that hits one already placed.
  const placed = [];
  for (const t of [...tags].sort((a, b) => b.y - a.y || a.car.id - b.car.id)) {
    let moved = true;
    while (moved) {
      moved = false;
      for (const o of placed) {
        if (t.x < o.x + o.w && o.x < t.x + t.w && t.y < o.y + TAG_H + TAG_GAP && o.y < t.y + TAG_H + TAG_GAP) { t.y = o.y - TAG_H - TAG_GAP; moved = true; }
      }
    }
    placed.push(t);
  }
  return tags;
}

export function drawTags(ctx, tags, player) {
  for (const t of tags) {
    const you = t.car === player;
    ctx.fillStyle = you ? COLOR.tagYouBack : COLOR.tagBack;
    ctx.fillRect(t.x, t.y, t.w, TAG_H);
    ctx.fillStyle = t.car.color ?? COLOR.tagFallback;
    ctx.fillRect(t.x, t.y, 3, TAG_H);
    if (you) { ctx.fillStyle = COLOR.gold; ctx.fillRect(t.x + 3, t.y, t.w - 3, 1); ctx.fillRect(t.x + 3, t.y + TAG_H - 1, t.w - 3, 1); }
    drawStyled(ctx, `${t.place} ${t.label}`, t.x + 6, t.y + 2, 'small', you ? 'gold' : 'text', { shadow: null });
  }
}
