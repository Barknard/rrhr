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
  // Tight and technical: a long start straight, then a raised deck folded into four hairpins.
  cinderSwitchback: {
    name: 'CINDER SWITCHBACK',
    size: 90,
    width: 4.4,
    points: [
      [22, 83, 0], [38, 83, 0], [58, 82, 0], [70, 82, 0], [80, 76, 0], // start/finish, the straight, a right-hander
      [80, 67, 8], [80, 58, 16],                                      // the ramp onto the switchback deck
      [44, 58, 16], [44, 50, 16], [70, 50, 16], [76, 50, 16], [76, 42, 16], // deck: hairpins 1 and 2
      [38, 42, 16], [38, 34, 16], [66, 34, 16], [72, 34, 16], [72, 26, 16], // deck: hairpins 3 and 4
      [72, 20, 8], [72, 14, 0],                                       // down off the deck
      [58, 12, 0], [44, 12, 0], [30, 14, 0], [22, 16, 0], [18, 24, 0], // fast stretch west, the corner
      [18, 32, 0], [18, 38, 24], [18, 48, 6],                          // kicker, then the jump over the cinder pit
      [18, 54, 0], [16, 60, 0], [14, 66, 0], [14, 74, 0], [17, 80, 0],            // esses back toward the line
    ],
    pits: [{ seg: 25, t0: 0.08, t1: 0.42 }],
    crates: [20, 75, 130, 185, 240, 295, 350],
    pads: [6],
    lava: [[24, 62, 34, 78], [48, 62, 66, 78], [48, 14, 64, 28], [76, 4, 88, 20]],
    seed: 21,
  },
  // Fast: long straights joined by wide sweepers. The sweeper walls are shallow-angled and the
  // lava runs right up to them, so a fast hit on the outside is a fly-off.
  magmaMile: {
    name: 'MAGMA MILE',
    size: 100,
    width: 5.6,
    points: [
      [12, 10, 0], [44, 10, 0], [78, 10, 0], [88, 14, 0], [94, 22, 0], // start/finish, the mile-long straight, the first sweeper
      [94, 32, 0], [86, 46, 0], [70, 56, 0], [68, 66, 0], [80, 74, 0], // the S through the infield
      [92, 80, 0], [90, 87, 0], [80, 92, 0], [70, 92, 0],              // bottom-right sweeper onto the back straight
      [62, 92, 24], [52, 92, 6],                                       // the kicker and the jump over the magma channel
      [44, 92, 0], [30, 92, 0], [18, 88, 0], [10, 80, 0],              // west along the bottom, the sweeper up
      [8, 68, 0], [16, 56, 0], [34, 48, 0], [34, 38, 0], [16, 30, 0],  // the long left-right-left up the west side
      [8, 20, 0],
    ],
    pits: [{ seg: 14, t0: 0.08, t1: 0.42 }],
    crates: [20, 75, 130, 185, 240, 295, 350],
    pads: [6],
    lava: [[34, 22, 70, 44], [36, 60, 68, 82], [0, 0, 8, 10]],
    seed: 33,
  },
  // The boss course: a ring road around a big lava lake, a raised deck, a jump over a pit on
  // the east and the west, and a deck that pokes out over the lake and folds back on itself.
  crucible: {
    name: "KING CINDER'S CRUCIBLE",
    size: 112,
    width: 5,
    points: [
      [30, 98, 0], [48, 98, 0], [68, 98, 0], [86, 98, 0], [96, 94, 0], // start/finish and the bottom straight
      [101, 84, 0], [101, 70, 0], [101, 60, 12], [101, 52, 16],            // up the east side, climbing onto a deck
      [101, 44, 24], [101, 34, 6], [98, 26, 0],                          // kicker, the jump over the east pit, the drop
      [88, 22, 0], [74, 22, 0],                                        // the north-east corner
      [72, 30, 8], [72, 38, 16], [72, 62, 16], [70, 70, 16], [60, 70, 16], [58, 62, 16], [58, 38, 16], // the causeway out over the lake and back
      [58, 26, 4], [54, 22, 0], [42, 22, 0], [34, 26, 0], [30, 34, 0], // down off the causeway, west along the top
      [30, 44, 0], [30, 52, 24], [30, 62, 6],                          // kicker, the jump over the west pit
      [30, 70, 0], [24, 78, 0], [24, 86, 0], [26, 94, 0],              // the west side, back to the line
    ],
    pits: [{ seg: 9, t0: 0.08, t1: 0.42 }, { seg: 27, t0: 0.08, t1: 0.42 }],
    crates: [20, 75, 130, 185, 240, 295, 350],
    pads: [6],
    lava: [[34, 30, 96, 90], [38, 102, 60, 108]],
    seed: 45,
  },
};

export const SERIES = [{ key: 'slagCircuit', name: 'THE SLAG CIRCUIT', tracks: ['slagPit', 'cinderSwitchback', 'magmaMile', 'crucible'], boss: 'kingCinder' }];
