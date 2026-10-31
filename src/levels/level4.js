// LEVEL 4 — COUNTY FAIR FRENZY
// The county fair has been taken over. Buffalo at every booth, on the ferris wheel grounds.
export default {
  id: 4,
  name: 'COUNTY FAIR FRENZY',
  objective: 'LIBERATE THE COUNTY FAIR.',
  flavor: [
    'DISPATCH: "The buffalo got into the county fair."',
    'YOU: "They probably just want a funnel cake."',
    'DISPATCH: "Officer. They are IN the funnel cake stand."',
    'UPDATE: BUFFALO COUNT: WHY ARE THERE THIS MANY'
  ],
  duration: 90,
  lookAhead: 24,
  path: [
    [-160, 2.2, 0], [-130, 2.2, -8], [-100, 2.2, 4], [-70, 2.2, -6],
    [-40, 2.2, 6], [-10, 2.2, -4], [20, 2.2, 6], [50, 2.2, -4],
    [80, 2.2, 4], [110, 2.2, -6], [140, 2.2, 2], [160, 2.2, 0]
  ],
  world: {
    theme: 'fair',
    ground: 'dirt',
    roadWidth: 10,
    riverSide: null,
    structures: [
      { type: 'ferriswheel', u: 0.3, side: -1, dist: 22 },
      { type: 'sign', u: 0.42, side: 1, dist: 7, text: 'TOLEDO COUNTY FAIR', sub: 'EST. 1902 / BUFFALO ENTRY: FREE' },
      { type: 'tent', u: 0.55, side: -1, dist: 16 },
      { type: 'foodstand', u: 0.68, side: 1, dist: 10 },
      { type: 'sign', u: 0.82, side: -1, dist: 7, text: 'PRIZE BOOTH', sub: 'ALL PRIZES WON BY BUFFALO' }
    ]
  },
  encounters: [
    { time: 5, type: 'fair', count: 3, ahead: 20 },
    { time: 12, type: 'normal', count: 4, ahead: 22 },
    { time: 19, type: 'traffic', count: 3, ahead: 16 },
    { time: 27, type: 'fair', count: 5, ahead: 24 },
    { time: 31, type: 'bandit', count: 3, ahead: 16 }, // prize-donut raid
    { time: 35, type: 'panicked', count: 3, ahead: 14 },
    // The whole herd arrives at the fair.
    { time: 44, type: 'herd', count: 9, ahead: 30 },
    { time: 52, type: 'angry', count: 3, ahead: 24 },
    { time: 60, type: 'fair', count: 4, ahead: 24 },
    { time: 68, type: 'security', count: 2, ahead: 26 },
    { time: 76, type: 'herd', count: 8, ahead: 28 }
  ],
  events: [
    { time: 2, type: 'announce', text: 'THE COUNTY FAIR.' },
    { time: 8, type: 'music', track: 'encounter' },
    { time: 16, type: 'announce', text: 'THEY WON EVERY PRIZE BOOTH.' },
    { time: 29, type: 'announce', text: 'THAT BUFFALO IS HOLDING YOUR DONUT.' },
    { time: 30, type: 'music', track: 'herd' },
    { time: 42, type: 'bigtext', text: 'THE HERD ARRIVES.', freeze: 1.8 },
    { time: 50, type: 'announce', text: 'THAT\'S A LOT OF BUFFALO!' },
    { time: 64, type: 'announce', text: 'KEEP FIRING!' },
    { time: 74, type: 'announce', text: 'MORE BUFFALO. AGAIN.' }
  ],
  npcs: [
    { kind: 'fairworker', u: 0.2, side: -1, dist: 5 },
    { kind: 'shopper', u: 0.48, side: 1, dist: 5 },
    { kind: 'fairworker', u: 0.6, side: -1, dist: 5 },
    { kind: 'pedestrian', u: 0.78, side: 1, dist: 5 }
  ],
  shootables: [
    { type: 'balloon', u: 0.34, side: 1, dist: 5 },
    { type: 'balloon', u: 0.52, side: -1, dist: 5 },
    { type: 'carnival', u: 0.64, side: 1, dist: 6 },
    { type: 'sign', u: 0.72, side: -1, dist: 6, text: 'BUFFALO\nWELCOME', sub: 'NO REFUNDS' }
  ]
};
