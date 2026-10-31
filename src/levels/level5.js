// LEVEL 5 — THE OLD CAR WASH
// The final buffalo stronghold. An abandoned car wash on the industrial edge of town.
export default {
  id: 5,
  name: 'THE OLD CAR WASH',
  objective: 'DEFEAT THE BIGGEST BUFFALO IN TOLEDO.',
  flavor: [
    'DISPATCH: "We found the source of the buffalo."',
    'YOU: "Where?"',
    'DISPATCH: "The old car wash. It is... a lot. Bring a big gun."',
    'NOTE: The gun has six rounds. You will need all of them.'
  ],
  duration: 64,
  lookAhead: 26,
  path: [
    [-150, 2.2, -6], [-120, 2.2, 2], [-90, 2.2, -4], [-60, 2.2, 4],
    [-30, 2.2, -2], [0, 2.2, 3], [30, 2.2, -3], [60, 2.2, 2],
    [90, 2.2, 0], [115, 2.2, -1]
  ],
  world: {
    theme: 'industrial',
    ground: 'concrete',
    roadWidth: 10,
    riverSide: null,
    structures: [
      { type: 'gasstation', u: 0.2, side: -1, dist: 16 },
      { type: 'sign', u: 0.34, side: 1, dist: 7, text: 'INDUSTRIAL DISTRICT', sub: 'AUTHORIZED BUFFALO ONLY' },
      { type: 'carwash', u: 0.82, side: -1, dist: 14 },
      { type: 'sign', u: 0.62, side: -1, dist: 7, text: 'CAR WASH\nAHEAD', sub: 'LAST CAR: 1987' }
    ]
  },
  encounters: [
    { time: 5, type: 'normal', count: 3, ahead: 20 },
    { time: 12, type: 'security', count: 3, ahead: 26 },
    { time: 20, type: 'angry', count: 3, ahead: 24 },
    { time: 28, type: 'traffic', count: 3, ahead: 16 },
    { time: 36, type: 'security', count: 3, ahead: 26 },
    { time: 44, type: 'angry', count: 3, ahead: 24 },
    { time: 52, type: 'herd', count: 6, ahead: 26 }
  ],
  events: [
    { time: 2, type: 'announce', text: 'INDUSTRIAL DISTRICT.' },
    { time: 12, type: 'announce', text: 'OLD GLASS WORKS — LIBBEY FIRES BURN. BUFFALO DO NOT.' },
    { time: 9, type: 'music', track: 'encounter' },
    { time: 24, type: 'announce', text: 'THEY GUARD THE CAR WASH.' },
    { time: 38, type: 'music', track: 'herd' },
    { time: 50, type: 'bigtext', text: 'THE STRONGHOLD.', freeze: 1.6 },
    { time: 56, type: 'announce', text: 'BIG ONE.' }
  ],
  npcs: [
    { kind: 'cop', u: 0.3, side: -1, dist: 5.5 },
    { kind: 'driver', u: 0.5, side: 1, dist: 6 },
    { kind: 'pedestrian', u: 0.7, side: -1, dist: 5 }
  ],
  shootables: [
    { type: 'barrel', u: 0.42, side: 1, dist: 5 },
    { type: 'crate', u: 0.56, side: -1, dist: 6 },
    { type: 'sign', u: 0.72, side: 1, dist: 6, text: 'NO BUFFALO\nBEYOND THIS POINT', sub: 'IT IS NOT WORKING' }
  ],
  // Boss fight config (used after the rail ends).
  boss: {
    distanceAhead: 20,
    obstacles: [
      { offset: [-4, 10] }, { offset: [4, 10] },
      { offset: [-5, 16] }, { offset: [5, 16] }
    ]
  }
};
