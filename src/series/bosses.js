import { CAR_STATS } from '../cars/carStats.js';
import { DRIVERS } from '../drivers/drivers.js';

// Series bosses. They live outside CAR_STATS/DRIVERS (and so outside CAR_KEYS/DRIVER_KEYS): the select screens
// and online validation never offer them. Anything that runs during a race looks keys up through
// vehicleStats()/driverDef(), which check the roster first and then the bosses.
export const MOLTEN_TRAIL = { every: 2.5, back: 1.0, damageMul: 0.5 };

// Tuned so the boss wins about half of the short Crucible check (see tests/boss.test.js): the heaviest car on
// the grid (mass 2.0) with a roster-top brawler pace, but modest armor, grip and accel. Slow to turn, like every brawler.
export const BOSS_CARS = {
  slaghog: { name: 'SLAGHOG', cls: 'brawler', size: [1.43, 1.02], color: '#ff6a1a', maxSpeed: 7.75, accel: 7, brake: 15, turnRate: 3.3, grip: 8, mass: 2.0, armor: 110, moltenTrail: MOLTEN_TRAIL.every,
    trait: { name: 'MOLTEN TRAIL', text: 'Drops a burning slag patch behind it every few seconds' } },
};

export const BOSS_DRIVERS = {
  kingCinder: {
    key: 'kingCinder', name: 'KING CINDER', short: 'King Cinder', look: 'Hulking molten-rock brute, obsidian crown, glowing seams',
    mods: { speed: 0, accel: 0, handling: 0, grip: 0, armor: 0 },
    skill: { id: 'kingsTemper', name: "KING'S TEMPER", text: 'Rules the Crucible. Bow, peasants' }, fav: 'slaghog',
  },
};

export const BOSS = { driver: 'kingCinder', vehicle: 'slaghog' };

const own = (table, key) => (typeof key === 'string' && Object.hasOwn(table, key) ? table[key] : undefined);
export const vehicleStats = key => own(CAR_STATS, key) ?? own(BOSS_CARS, key);
export const driverDef = key => own(DRIVERS, key) ?? own(BOSS_DRIVERS, key);
export const vehicleKeyOf = stats => [...Object.entries(CAR_STATS), ...Object.entries(BOSS_CARS)].find(([, s]) => s.name === stats.name)?.[0];
