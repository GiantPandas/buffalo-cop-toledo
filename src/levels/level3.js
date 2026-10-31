// LEVEL 3 — THE FEED STORE
// The agricultural district is fully occupied. The buffalo have a feed store now.
export default {
  id: 3,
  name: 'THE FEED STORE',
  objective: 'SHUT DOWN THE FEED SUPPLY.',
  flavor: [
    'DISPATCH: "The buffalo found the feed store."',
    'YOU: "And?"',
    'DISPATCH: "They stocked up. Officer, they STOKED UP."',
    'UPDATE: BUFFALO COUNT: 47 → 90-something'
  ],
  duration: 84,
  lookAhead: 26,
  path: [
    [-150, 2.2, 10], [-115, 2.2, -4], [-80, 2.2, 8], [-45, 2.2, -6],
    [-10, 2.2, 6], [25, 2.2, -4], [60, 2.2, 8], [95, 2.2, -2],
    [130, 2.2, 6], [155, 2.2, 0]
  ],
  world: {
    theme: 'farm',
    ground: 'dirt',
    roadWidth: 9,
    riverSide: null,
    structures: [
      { type: 'barn', u: 0.14, side: -1, dist: 16 },
      { type: 'silo', u: 0.2, side: 1, dist: 18 },
      { type: 'sign', u: 0.3, side: -1, dist: 7, text: 'FEED STORE\nAHEAD', sub: 'DO NOT FEED THE BUFFALO' },
      { type: 'feedstore', u: 0.52, side: -1, dist: 16 },
      { type: 'barn', u: 0.68, side: 1, dist: 15 },
      { type: 'silo', u: 0.74, side: -1, dist: 17 },
      { type: 'truck', u: 0.84, side: 1, dist: 8 }
    ]
  },
  encounters: [
    { time: 5, type: 'normal', count: 3, ahead: 20 },
    { time: 12, type: 'traffic', count: 2, ahead: 16 },
    { time: 19, type: 'angry', count: 3, ahead: 24 },
    { time: 27, type: 'normal', count: 5, ahead: 24 },
    { time: 35, type: 'security', count: 2, ahead: 26 },
    { time: 43, type: 'panicked', count: 4, ahead: 14 },
    // The feed store doors blow open.
    { time: 50, type: 'feedstore_burst', count: 8, u: 0.52 },
    { time: 58, type: 'angry', count: 4, ahead: 24 },
    { time: 66, type: 'security', count: 3, ahead: 26 },
    { time: 74, type: 'herd', count: 10, ahead: 28 }
  ],
  events: [
    { time: 2, type: 'announce', text: 'AGRICULTURAL DISTRICT.' },
    { time: 9, type: 'music', track: 'encounter' },
    { time: 24, type: 'announce', text: 'THEY KNOW WHERE THE FEED IS.' },
    { time: 38, type: 'music', track: 'herd' },
    { time: 47, type: 'announce', text: 'HERE IT COMES...' },
    { time: 50, type: 'bigtext', text: 'OH COME ON.', freeze: 1.8 },
    { time: 56, type: 'announce', text: 'THAT IS A FEED STORE FULL OF BUFFALO.' },
    { time: 72, type: 'announce', text: 'KEEP FIRING!' }
  ],
  npcs: [
    { kind: 'shopowner', u: 0.36, side: -1, dist: 5 },
    { kind: 'pedestrian', u: 0.62, side: 1, dist: 5 },
    { kind: 'cop', u: 0.8, side: -1, dist: 5.5 }
  ],
  shootables: [
    { type: 'sign', u: 0.4, side: 1, dist: 6, text: 'NO BUFFALO\nBEYOND THIS POINT', sub: 'IGNORED' },
    { type: 'barrel', u: 0.58, side: -1, dist: 5 },
    { type: 'crate', u: 0.7, side: 1, dist: 6 },
    { type: 'haybale', u: 0.82, side: -1, dist: 6 }
  ]
};
