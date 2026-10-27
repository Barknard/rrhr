// Every weapon number in one place, so balance can be tuned without hunting through the code.
// Damage in armor HP, distances in tiles, speeds in tiles/s, times in s. Hit radii (r, passRange) are gaps
// measured from a car's body (its footprint box), not from its centre.
export const BALANCE = {
  arc:     { range: 7, coneDeg: 30, chain: 4.5, links: 2, dmg: 10, chainDmg: 6 },
  saw:     { speed: 13, life: 3, bounces: 5, dmg: 15, safe: 0.4, r: 0.2, knock: 1.4 },
  harpoon: { speed: 18, range: 9, dmg: 9, reel: 3.5, r: 0.2, spin: Math.PI / 2, slow: 0.55 },
  mine:    { arm: 0.5, life: 20, pull: 2.0, pullAccel: 5, trigger: 0.9, blast: 1.6, dmg: 18, knock: 2 },
  napalm:  { patches: 6, every: 0.2, life: 5, r: 0.5, dps: 18 },
  bomb:    { holderDmg: 40, splashDmg: 12, splash: 1.6, passRange: 0.15, passCooldown: 0.6 },
};
