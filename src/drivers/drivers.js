import { CAR_STATS } from '../cars/carStats.js';
import { driverDef, vehicleKeyOf } from '../series/bosses.js';

// The eight drivers. mods are percentages applied to the vehicle's handling stats; each driver's mods sum
// to about zero so nobody is strictly better. Driving a driver's favourite ride adds +5% to all five.
export const DRIVERS = {
  vinnie: {
    key: 'vinnie', name: 'VINNIE "TWO TANKS" BOLOGNESE', short: 'Vinnie', look: 'Huge mobster in a tank top, gold chain, cigar',
    mods: { speed: 0, accel: -2, handling: -2, grip: 0, armor: 6 },
    skill: { id: 'thickHide', name: 'THICK HIDE', text: 'Refunds 20% of every non-lethal hit as armor' }, fav: 'boneshaker',
  },
  dolly: {
    key: 'dolly', name: 'DOLLY DETONATOR', short: 'Dolly', look: 'Rockabilly demolition girl, beehive with a lit fuse',
    mods: { speed: 1, accel: 3, handling: 0, grip: -2, armor: -3 },
    skill: { id: 'shortFuse', name: 'SHORT FUSE', text: '+1 dropped-weapon charge every lap' }, fav: 'demoDerrick',
  },
  professor: {
    key: 'professor', name: 'PROFESSOR PISTONS', short: 'The Professor', look: 'Wild-haired mad scientist, goggles, burnt lab coat',
    mods: { speed: 0, accel: 0, handling: 3, grip: 0, armor: -5 },
    skill: { id: 'calculated', name: 'CALCULATED', text: 'Nitro lasts 30% longer' }, fav: 'nullHalo',
  },
  mama: {
    key: 'mama', name: 'MAMA MAYHEM', short: 'Mama', look: 'Biker grandma in leathers and curlers',
    mods: { speed: 0, accel: 2, handling: 0, grip: 2, armor: -2 },
    skill: { id: 'mamaBear', name: 'MAMA BEAR', text: 'In the back half of the pack, earns a nitro every 8 seconds' }, fav: 'hogHitch',
  },
  juice: {
    key: 'juice', name: 'JUICE JACKSON', short: 'Juice', look: 'Flashy ex-drag racer, gold teeth, shades, track suit',
    mods: { speed: 1, accel: 2, handling: -3, grip: -2, armor: 0 },
    skill: { id: 'jackrabbit', name: 'JACKRABBIT', text: 'Free nitro burst at GO and after every respawn' }, fav: 'afterburner',
  },
  voltage: {
    key: 'voltage', name: 'LADY VOLTAGE', short: 'Voltage', look: 'Punk electrician, spiked hair crackling with sparks',
    mods: { speed: 0, accel: 0, handling: 2, grip: 2, armor: -4 },
    skill: { id: 'overcharge', name: 'OVERCHARGE', text: 'Arc Coil hits deal +5 damage to each target' }, fav: 'whirlybird',
  },
  count: {
    key: 'count', name: 'COUNT CRASHULA', short: 'The Count', look: 'Pale undertaker-vampire in a top hat',
    mods: { speed: 0, accel: 1, handling: 0, grip: 0, armor: 1 },
    skill: { id: 'bloodsucker', name: 'BLOODSUCKER', text: 'Wrecking a car heals 30 armor' }, fav: 'lastRide',
  },
  sprocket: {
    key: 'sprocket', name: "LIL' SPROCKET", short: 'Sprocket', look: 'Tiny goblin mechanic with a giant wrench',
    mods: { speed: 0, accel: 0, handling: 2, grip: 2, armor: -4 },
    skill: { id: 'greaseMonkey', name: 'GREASE MONKEY', text: 'Regenerates armor after 4 seconds without damage' }, fav: 'stomper',
  },
};
export const DRIVER_KEYS = Object.keys(DRIVERS);

const FAV_BONUS = 1.05;

// Vehicle stats with the driver's percentages applied. Returns a new object; extras are copied as-is.
export function combineStats(vehicle, driverKey) {
  const d = driverDef(driverKey);
  if (!d) return { ...vehicle };
  const fav = vehicleKeyOf(vehicle) === d.fav, f = fav ? FAV_BONUS : 1;
  const k = p => (1 + p / 100) * f;
  return {
    ...vehicle,
    maxSpeed: vehicle.maxSpeed * k(d.mods.speed),
    accel: vehicle.accel * k(d.mods.accel),
    turnRate: vehicle.turnRate * k(d.mods.handling),
    grip: vehicle.grip * k(d.mods.grip),
    armor: Math.round(vehicle.armor * k(d.mods.armor)),
    driver: driverKey, fav,
  };
}

// Select-screen bars, 0..1, scaled against the best vehicle on the roster (with room for driver bonuses).
const BAR_STATS = [['TOP SPEED', 'maxSpeed'], ['ACCEL', 'accel'], ['HANDLING', 'turnRate'], ['GRIP', 'grip'], ['ARMOR', 'armor']];
const BAR_MAX = Object.fromEntries(BAR_STATS.map(([, f]) => [f, Math.max(...Object.values(CAR_STATS).map(s => s[f])) * 1.2]));
export function statBars(vehicle, driverKey) {
  const total = combineStats(vehicle, driverKey);
  return BAR_STATS.map(([label, f]) => ({ label, base: vehicle[f] / BAR_MAX[f], total: total[f] / BAR_MAX[f] }));
}
