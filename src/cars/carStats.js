// Handling stats. Speeds in tiles/s, accel/brake in tiles/s², turnRate in rad/s,
// grip = how fast sideways slide dies out (lower = more drift), armor in HP.
// size: [length, width] footprint in tiles (the body as drawn), used for car-to-car collision.
// trait: the vehicle's signature, shown on the select screen. Mechanics flags: noseSaw (damage a nose-first
// bump deals), wallCrawler (no speed lost on walls), crusher (no ram damage, never tumbles), momentum (top-speed
// bonus after 3 s flat out), antigrav (floats over pits), gunner (extra forward shots a lap), nitroBoost (extra
// nitro duration). Extras: hover (immune to mines and napalm), arcWeak (Arc Coil damage multiplier), knockMul (weapon and
// wrecking-ball knockback multiplier), pivot (full turn rate at any speed), glide (gravity multiplier while
// launched), ram (bump damage per tile/s of closing speed), ball (wrecking ball), trailers (Rattler's
// trailers), spinResist (fraction of harpoon spin and slowdown ignored).
export const CAR_STATS = {
  grinder:     { name: 'GRINDER', cls: 'allRounder',      size: [1.36, 0.75], color: '#ff5a36', maxSpeed: 7.65, accel: 9,   brake: 14, turnRate: 3.4, grip: 7,   mass: 1.0, armor: 85, noseSaw: 8,
    trait: { name: 'BUZZ NOSE', text: 'Ramming nose-first saws 6 armor off whoever you hit' } },
  widowmaker:  { name: 'WIDOWMAKER', cls: 'handler',   size: [1.22, 0.88], color: '#2fbf73', maxSpeed: 7.6, accel: 8,   brake: 14, turnRate: 3.9, grip: 13,  mass: 0.9, armor: 70, hover: true, arcWeak: 1.25, wallCrawler: true,
    trait: { name: 'SPIDER LEGS', text: 'Floats over mines and napalm; walls do not slow it. Weak to lightning' } },
  boneshaker:  { name: 'BONESHAKER', cls: 'brawler',   size: [1.43, 1.02], color: '#b48bff', maxSpeed: 7.72, accel: 6.5, brake: 12, turnRate: 2.8, grip: 10.4,   mass: 1.6, armor: 140, crusher: true, knockMul: 0.5,
    trait: { name: 'MONSTER TIRES', text: 'Never tumbles, shrugs off rams, takes half the knockback' } },
  hellwheel:   { name: 'HELLWHEEL', cls: 'speedster',    size: [1.02, 0.48], color: '#f4c21b', maxSpeed: 7.72, accel: 8,   brake: 10, turnRate: 3.0, grip: 3.5, mass: 1.1, armor: 90, momentum: 0.12,
    trait: { name: 'MOMENTUM', text: '+12% top speed after 3 seconds flat out without touching a wall' } },
  skimmer:     { name: 'SKIMMER', cls: 'speedster',      size: [1.36, 0.82], color: '#3aa8ff', maxSpeed: 8.25, accel: 8,   brake: 9,  turnRate: 3.3, grip: 2.5, mass: 0.8, armor: 55, hover: true,
    trait: { name: 'HOVERCRAFT', text: 'Floats over mines and napalm. Slides like a greased pig' } },
  nullHalo:    { name: 'NULL HALO', cls: 'handler',    size: [1.22, 0.75], color: '#e8f4ff', maxSpeed: 7.6, accel: 8.5, brake: 14, turnRate: 4.4, grip: 9,   mass: 0.7, armor: 85, knockMul: 1.4, antigrav: true,
    trait: { name: 'ANTI-GRAVITY', text: 'Floats over the pits and can never fall in. Light: weapons knock it far' } },
  hogHitch:    { name: 'HOG & HITCH', cls: 'allRounder',  size: [1.22, 0.88], color: '#ff8a1e', maxSpeed: 7.48, accel: 11,  brake: 14, turnRate: 3.6, grip: 8,   mass: 0.8, armor: 75, gunner: 1,
    trait: { name: 'SIDECAR GUNNER', text: '+1 forward weapon shot every lap' } },
  stomper:     { name: 'STOMPER', cls: 'handler',      size: [1.15, 0.88], color: '#9aa4b4', maxSpeed: 7.45, accel: 8.4,   brake: 16, turnRate: 4.6, grip: 15,  mass: 1.3, armor: 95, spinResist: 0.5,
    trait: { name: 'SURE FOOTED', text: 'Best grip in the game; harpoons spin and slow it half as much' } },
  gravedigger: { name: 'GRAVEDIGGER', cls: 'brawler',  size: [1.29, 0.95], color: '#6f8a3a', maxSpeed: 7.6, accel: 8,   brake: 16, turnRate: 2.6, grip: 12,  mass: 2.0, armor: 150, pivot: true,
    trait: { name: 'TANK TREADS', text: 'Turns on the spot. The toughest armor on the grid' } },
  rattler:     { name: 'RATTLER', cls: 'brawler',      size: [0.95, 0.68], color: '#d6352f', maxSpeed: 7.85, accel: 7,   brake: 12, turnRate: 2.9, grip: 6.5,   mass: 1.7, armor: 130, trailers: true,
    trait: { name: 'ROAD TRAIN', text: 'Its two trailers shove anyone alongside out of the way' } },
  lastRide:    { name: 'LAST RIDE', cls: 'brawler',    size: [1.49, 0.68], color: '#c89048', maxSpeed: 7.7, accel: 7,   brake: 12, turnRate: 2.9, grip: 9.1,   mass: 1.8, armor: 120, ram: 2.6,
    trait: { name: 'HEARSE RAM', text: 'Bumps deal damage by impact speed' } },
  afterburner: { name: 'AFTERBURNER', cls: 'speedster',  size: [1.63, 0.61], color: '#ff3df0', maxSpeed: 7.7, accel: 7.5, brake: 10, turnRate: 2.3, grip: 6,   mass: 1.0, armor: 80, nitroBoost: 0.75,
    trait: { name: 'AFTERBURNER', text: 'Fastest in a straight line; nitro lasts 75% longer' } },
  demoDerrick: { name: 'DEMO DERRICK', cls: 'brawler', size: [1.36, 0.68], color: '#ffd23a', maxSpeed: 7.65, accel: 7,   brake: 13, turnRate: 3.0, grip: 8,   mass: 1.6, armor: 120, ball: true,
    trait: { name: 'WRECKING BALL', text: 'A swinging ball smashes anyone tailgating' } },
  whirlybird:  { name: 'WHIRLYBIRD', cls: 'allRounder',   size: [1.22, 0.54], color: '#4fe0c8', maxSpeed: 8.05, accel: 8,   brake: 12, turnRate: 3.4, grip: 7,   mass: 0.9, armor: 80, glide: 0.45,
    trait: { name: 'ROTOR GLIDE', text: 'Glides much farther off every jump and launch pad' } },
};
export const CAR_KEYS = Object.keys(CAR_STATS);

// How each class wins (shown on the select screen). Lap pace is tuned per class: speedsters fastest,
// brawlers slowest but toughest (see docs/balance/ and tools/tune-pace.mjs).
export const CLASSES = {
  speedster: { label: 'SPEEDSTER', wins: 'Wins on raw pace. Fragile' },
  allRounder: { label: 'ALL-ROUNDER', wins: 'No weakness, no gimmick: wins with skill' },
  handler: { label: 'HANDLER', wins: 'Wins in the corners and stays out of trouble' },
  brawler: { label: 'BRAWLER', wins: 'Slow, but wins by wrecking everyone else' },
};
