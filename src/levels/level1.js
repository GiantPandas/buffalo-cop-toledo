// LEVEL 1 — WEST SIDE ARRIVAL
// The player drives in from the west side. Everything looks normal... until it doesn't.
export default {
  id: 1,
  name: 'WEST SIDE ARRIVAL',
  objective: 'CLEAR THE ROAD.',
  flavor: [
    'DISPATCH: "Officer, we have a situation on the west side."',
    'YOU: "How bad?"',
    'DISPATCH: "...sir. How many buffalo do you see?"',
    'DISPATCH: "WHY ARE THERE THIS MANY."'
  ],
  duration: 78,
  lookAhead: 26,
  path: [
    [-170, 2.2, 0], [-140, 2.2, 1], [-110, 2.2, -2], [-80, 2.2, 3],
    [-50, 2.2, -3], [-20, 2.2, 2], [10, 2.2, -2], [40, 2.2, 3],
    [70, 2.2, 0], [100, 2.2, -2], [130, 2.2, 1], [160, 2.2, 0]
  ],
  world: {
    theme: 'city',
    ground: 'grass',
    roadWidth: 11,
    riverSide: -1,
    structures: [
      { type: 'storefront', u: 0.18, side: 1, dist: 12, text: 'WEST SIDE MART' },
      { type: 'sign', u: 0.3, side: -1, dist: 7, text: 'WELCOME TO\nTOLEDO', sub: 'EST. 1689 / BUFFALO: TODAY' },
      { type: 'policecar', u: 0.42, side: 1, dist: 7 },
      { type: 'storefront', u: 0.58, side: -1, dist: 12, text: 'RIVERBANK Diner' },
      { type: 'truck', u: 0.72, side: 1, dist: 8 },
      { type: 'sign', u: 0.84, side: -1, dist: 7, text: 'MAIN STREET\nAHEAD', sub: 'EXPECT DELAYS' }
    ]
  },
  encounters: [
    { time: 6, type: 'normal', count: 2, ahead: 20 },
    { time: 14, type: 'normal', count: 3, ahead: 22 },
    { time: 22, type: 'traffic', count: 2, ahead: 16 },
    { time: 26, type: 'bandit', count: 2, ahead: 18 }, // donut thieves, cross the road fast
    { time: 30, type: 'angry', count: 2, ahead: 24 },
    { time: 38, type: 'normal', count: 4, ahead: 22 },
    { time: 44, type: 'panicked', count: 2, ahead: 14 },
    { time: 50, type: 'herd', count: 7, ahead: 26 },
    { time: 58, type: 'angry', count: 3, ahead: 24 },
    { time: 66, type: 'normal', count: 3, ahead: 20 },
    { time: 70, type: 'giant', count: 1, ahead: 22 }
  ],
  events: [
    { time: 2, type: 'announce', text: 'TOLEDO, POPULATION: ???' },
    { time: 8, type: 'announce', text: 'BUFFALO!' },
    { time: 16, type: 'music', track: 'encounter' },
    { time: 24, type: 'announce', text: 'THAT IS NOT NORMAL.' },
    { time: 26.5, type: 'announce', text: 'SOMEONE STOLE THE STATION DONUTS.' },
    { time: 34, type: 'music', track: 'herd' },
    { time: 46, type: 'bigtext', text: 'OH COME ON.', freeze: 1.6 },
    { time: 52, type: 'announce', text: 'TOO MANY!' },
    { time: 68, type: 'announce', text: 'BIG ONE! CLEAR THE ROAD.' }
  ],
  npcs: [
    { kind: 'cop', u: 0.12, side: 1, dist: 5.5 },
    { kind: 'pedestrian', u: 0.34, side: -1, dist: 5 },
    { kind: 'shopper', u: 0.6, side: 1, dist: 5 },
    { kind: 'pedestrian', u: 0.78, side: -1, dist: 5 }
  ],
  shootables: [
    { type: 'sign', u: 0.24, side: 1, dist: 6, text: 'BUFFALO\nCROSSING', sub: 'EXPECT DELAYS' },
    { type: 'trafficlight', u: 0.48, side: -1, dist: 6 },
    // Barrel cluster: shoot one and the chain reaction does the rest.
    { type: 'barrel', u: 0.66, side: 1, dist: 5 },
    { type: 'barrel', u: 0.68, side: 1, dist: 6 },
    { type: 'barrel', u: 0.70, side: 1, dist: 4 }
  ]
};
