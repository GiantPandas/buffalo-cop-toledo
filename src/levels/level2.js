// LEVEL 2 — MAIN STREET MADNESS
// Downtown is overwhelmed. Buffalo on sidewalks, in storefronts, everywhere.
export default {
  id: 2,
  name: 'MAIN STREET MADNESS',
  objective: 'RESTORE ORDER TO DOWNTOWN.',
  flavor: [
    'DISPATCH: "Main Street is... occupied."',
    'YOU: "Occupied by what?"',
    'DISPATCH: "By buffalo. All of them. The whole block."',
    'UPDATE: BUFFALO COUNT: 47'
  ],
  duration: 88,
  lookAhead: 24,
  path: [
    [-160, 2.2, -30], [-120, 2.2, -20], [-85, 2.2, -30], [-50, 2.2, -15],
    [-15, 2.2, -25], [20, 2.2, -10], [55, 2.2, -22], [90, 2.2, -8],
    [125, 2.2, -20], [160, 2.2, -10]
  ],
  world: {
    theme: 'downtown',
    ground: 'grass',
    roadWidth: 12,
    riverSide: null,
    structures: [
      { type: 'storefront', u: 0.1, side: -1, dist: 13, text: 'TOLEDO BANK' },
      { type: 'sign', u: 0.2, side: 1, dist: 7, text: 'MAIN STREET', sub: 'POPULATION:\nHUMANS: ???\nBUFFALO: TOO MANY' },
      { type: 'storefront', u: 0.32, side: 1, dist: 13, text: '5 & DIME' },
      { type: 'policecar', u: 0.4, side: -1, dist: 7 },
      { type: 'storefront', u: 0.5, side: -1, dist: 13, text: 'HOTEL' },
      { type: 'truck', u: 0.62, side: 1, dist: 8 },
      { type: 'storefront', u: 0.7, side: 1, dist: 13, text: 'BAR & GRILL' },
      { type: 'policecar', u: 0.8, side: -1, dist: 7 },
      { type: 'sign', u: 0.9, side: 1, dist: 7, text: 'NO BUFFALO\nPARKING', sub: 'ENFORCED BY WHOM?' }
    ]
  },
  encounters: [
    { time: 5, type: 'normal', count: 3, ahead: 20 },
    { time: 12, type: 'traffic', count: 3, ahead: 16 },
    { time: 19, type: 'angry', count: 2, ahead: 24 },
    { time: 26, type: 'normal', count: 4, ahead: 24 },
    { time: 33, type: 'security', count: 2, ahead: 26 },
    { time: 40, type: 'panicked', count: 4, ahead: 14 },
    { time: 47, type: 'herd', count: 8, ahead: 28 },
    { time: 55, type: 'angry', count: 3, ahead: 24 },
    { time: 62, type: 'security', count: 2, ahead: 26 },
    { time: 70, type: 'herd', count: 9, ahead: 30 },
    { time: 78, type: 'angry', count: 3, ahead: 24 }
  ],
  events: [
    { time: 2, type: 'announce', text: 'MAIN STREET. HERE WE GO.' },
    { time: 10, type: 'music', track: 'encounter' },
    { time: 28, type: 'announce', text: 'THEY HAVE SECURITY VESTS.' },
    { time: 36, type: 'music', track: 'herd' },
    { time: 45, type: 'bigtext', text: 'YOU HAVE GOT TO\nBE KIDDING.', freeze: 1.8 },
    { time: 52, type: 'announce', text: 'THAT\'S A LOT OF BUFFALO!' },
    { time: 68, type: 'announce', text: 'BUFFALO COUNT: WHY?' }
  ],
  npcs: [
    { kind: 'shopper', u: 0.15, side: -1, dist: 5 },
    { kind: 'pedestrian', u: 0.28, side: 1, dist: 5 },
    { kind: 'cop', u: 0.45, side: -1, dist: 5.5 },
    { kind: 'shopowner', u: 0.66, side: 1, dist: 5 },
    { kind: 'pedestrian', u: 0.85, side: -1, dist: 5 }
  ],
  shootables: [
    { type: 'sign', u: 0.26, side: -1, dist: 6, text: 'BUFFALO\nCROSSING', sub: 'EXPECT DELAYS' },
    { type: 'trafficlight', u: 0.55, side: 1, dist: 6 },
    { type: 'balloon', u: 0.74, side: -1, dist: 5 },
    { type: 'barrel', u: 0.88, side: 1, dist: 5 }
  ]
};
