// Track definitions. points: centerline [x, y, heightPx], closed loop.
// width: road width in tiles (walls follow the smooth centerline, not the tile grid).
// pits: ranges of a centerline segment that are bottomless holes across the whole road.
// lava: [x0, y0, x1, y1) tile rects of decorative lava off the road.
export const TRACKS = {
  slagPit: {
    name: 'SLAG PIT SPEEDWAY',
    size: 90,
    width: 4.8,
    points: [
      [13, 6, 0], [42, 6, 0], [62, 6, 0],     // start/finish line, then the long straight east
      [76, 10, 0], [84, 22, 0],               // sweeping right-hander into the east loop
      [84, 44, 16], [80, 56, 16],             // the long climb onto the east deck
      [68, 58, 16], [64, 58, 24],             // a straight run-up on the deck, then the kicker...
      [54, 58, 6],                            // ...the east jump over pit 2, and the drop
      [48, 52, 0], [50, 40, 0], [58, 34, 0],  // back north through the gully
      [64, 24, 0], [58, 16, 4],               // hairpin west
      [52, 22, 12], [52, 28, 16],             // the ramp up, a flat top before the corner
      [40, 28, 16], [40, 18, 16], [26, 18, 16], [26, 32, 16], // raised horseshoe with 90° hairpins
      [26, 36, 24], [26, 46, 6],              // kicker, then the jump over the slag pit and the drop
      [26, 60, 0], [20, 72, 0], [8, 76, 0],   // south loop
      [4, 66, 0], [4, 54, 0],                 // up the west edge
      [8, 44, 0], [14, 40, 0], [8, 34, 0],    // chicane
      [8, 22, 0], [12, 17, 0], [8, 12, 0],    // S-bends home
      [6, 6, 0],                              // last corner onto the straight
    ],
    pits: [{ seg: 21, t0: 0.08, t1: 0.42 }, { seg: 8, t0: 0.08, t1: 0.42 }],
    crates: [20, 76, 124, 188, 244, 300, 356], // s positions; each spot holds a pair of crates
    pads: [6],                              // launch pad s positions (need ~12 tiles of runway after)
    lava: [[31, 37, 47, 49], [52, 62, 70, 72]],
    seed: 7,
  },
};
