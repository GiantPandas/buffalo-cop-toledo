# BUFFALO COP: TOO MANY GODDAMN BUFFALO IN TOLEDO

An original arcade light-gun rail shooter built with Three.js + Vite. You are the last
sensible cop in Toledo, driving a camera rail down a highway of escalating buffalo
disasters across 5 levels, ending in a multi-phase boss fight against
THE BIGGEST BUFFALO IN TOLEDO. All art is procedural (geometry + canvas textures),
all audio is synthesized with Web Audio. No external assets.

**▶ Play the live demo: https://giantpandas.github.io/buffalo-cop-toledo/**

## Run it

Requirements: Node 18+ and a modern desktop browser with WebGL.

```bash
npm install
npm run dev        # Vite dev server -> http://localhost:5173
```

Production build + preview:

```bash
npm run build      # outputs to dist/
npm run preview    # serves dist/ locally
```

Note for Windows PowerShell: if `npm` fails with a script-execution-policy error,
use `npm.cmd` instead (e.g. `npm.cmd run dev`).

## Controls

| Input | Action |
|---|---|
| Mouse | Aim (crosshair) |
| Left mouse button | Fire (hold for rapid fire) |
| R | Reload (6-round mag, auto-reloads when empty) |
| P / Esc | Pause (options inside pause menu) |

There is no driving input: the rail moves on its own. You aim and shoot at what
comes down the road.

## Scoring

- Hit 100, head shot +300, fast takedown (kill within 4s of spawn) +250
- Environmental props (barrels, crates, signs, traffic lights) 50; every buffalo caught in a barrel blast +75 x combo
- Boss damage 500 per hit
- Civilian penalty -500 (do not shoot the cop, shoppers, drivers, etc.)
- Combo multiplier: x2 at 5 hits, x3 at 10, x4 at 20, x5 at 30 (breaks on a miss)
- Bullet time ("LAST OF THE HERD"): all kills score x2 while it is active; clearing the last buffalo during it pays a +750 HERD CLEARED bonus
- Donut bandits: killing one recovers the loot (+400); letting it escape means the donut gets away
- Level-complete bonus: remaining HP x100 + ammo bonus + accuracy bonus
- High scores (top 10) persist in localStorage; enter a 3-letter callsign when you qualify

## Special mechanics

- **LAST OF THE HERD (bullet time)** — when exactly one buffalo is left on the road, the world drops to ~1/3 speed (blue-tinted vignette, falling whoosh) while your trigger stays at full speed and score doubles. Lasts 3.5 real seconds, has a 10s cooldown, and never fires during boss fights or set-piece freezes. Logic: `Game._updateFocus` in `src/core/Game.js`.
- **BARREL CHAINS** — a shot barrel blasts every buffalo within 6.5m (flat points, no combo inflation) and detonates barrels within 8m, chaining up to 3 deep. The boss takes 1 damage per blast. Logic: `Game.barrelBlast` + the `barrel` case in `src/systems/LevelManager.js`.
- **DONUT BANDIT** — a fast lateral runner carrying a stolen donut on its head (head accessories count as headshots). hp 2; kill it for +400 and a sprinkle burst, or watch the donut flee. Behavior: `src/enemies/Buffalo.js` (`bandit`), model: `src/world/buffaloModel.js`.
- **SPAWN DIRECTOR** — encounters never land in your face and never stack. Spawn distance is derived from the rail's live speed (`RailSystem.speedAt`) with per-type reaction budgets (chargers spawn ≥28m out), aggressive buffalo telegraph at 21m, a fresh wave is held back while ≥14 buffalo are alive (queued, fires when the road clears or after 5s), and anything the rail has passed despawns off-stage. Every arrival gets a dust puff + low thud so you notice it. Logic: `LevelManager._fireEncounter`.
- **COLLISION-AWARE WORLD BUILD** — level structures (barns, feed stores, ferris wheels…) place first, then buildings and street props (parked cars, trees, lights, tents, pens…) are rejected if their `Box3` footprint would clip into anything solid; NPCs and shootable props slide toward the road until they clear. A **road-clearance guard** (`crossesRoad`) also rejects any low prop whose footprint intrudes into the asphalt even on curves — no more walls across the road; overhead gantries like the harbor crane stay passable. Logic: `solidBoxes` registry + `crossesRoad` in `src/world/ProceduralWorld.js`, `LevelManager._clearFromSolids`.
- **TOLEDO LANDMARKS** — every map references the real Glass City: the Museum of Art peristyle with reflecting pool and "The Olympians", Falls of the Maumee rapids weir, the Zoo lion fountain and Olmsted gate arch, Five Points spiral interchange, Walbridge Hall, Mud Hens ballpark, Dossin Great American mall, Libbey glass works with glowing furnaces, harbor locks, working container cranes and a bobbing lake freighter, a flickering GLASS CITY neon, and distant lit skylines on the horizon. Landmarks respect the collision registry and announce themselves over the radio. Logic: `src/world/landmarks.js`.
- **STREET FIDELITY** — roads wear tar patches, cracks, manholes and faded paint; sidewalks are mismatched slabs with cracks and tree pits; buildings get storefront ground floors, cornices, setback upper floors, water tanks/AC units, varied palettes, and downtown rises as lit glass towers. Hydrants and trash cans line the sidewalks. The view-model **TPD-9** cycles its pump on every shot, drops/ejects its mag on reload, and shows a status light (cyan ready / amber low / red empty). Textures: `src/world/textures.js`; gun: `src/player/Weapon.js`.
- **MUSIC** — a 4-bar lookahead sequencer per intensity track (menu/explore/encounter/herd/boss/victory/gameover): chord pads walk a progression, bass and lead get distinct per-bar variations with fills, humanized drums (ghost hats, velocity jitter, open hats, tom fills, crash on phrase tops) and an echo bus under the lead. Logic: `TRACKS` + `_playStep` in `src/core/AudioManager.js`.

## Upgrades (roguelike)

After clearing each mission (except the final boss), pick **one** weapon upgrade that stays for the rest of the run. Three are offered at random from a pool of 12:

- OVERCLOCKED TRIGGER — +25% fire rate
- HEAVY CALIBER — +1 damage per shot
- EXTENDED MAG — +2 mag size (tops off)
- QUICK SWAP — -20% reload time
- STABILIZER — less camera kick
- LUCKY ROUNDS — +8% crit chance (crits deal 2x, with their own "ting")
- HOLLOW POINTS — bullets pierce +1 buffalo
- SNIPER GLASS — +3 damage on headshots
- REINFORCED VEST — -20% damage from charges (max 75%)
- CERAMIC PLATING — -3 damage per hit taken
- FIELD MEDIC — +20 max HP, full heal now
- CASH FOR BUFFALO — kills & hits pay +25% more

Upgrades live in `src/systems/upgrades.js` and mutate the live `Weapon` instance (`src/player/Weapon.js`). They reset on a fresh run from the menu but persist through retries within a run.

Hit feedback: buffaloes flinch on every hit — a quick whole-body squash, head jerk, leg scramble and tail snap, plus a dazed head wobble while staggered (see `src/enemies/Buffalo.js` `_animate`). The boss takes a bigger flinch, larger on head shots.

## Levels

| # | Name | Theme |
|---|---|---|
| 1 | WEST SIDE ARRIVAL | city |
| 2 | MAIN STREET MADNESS | downtown |
| 3 | THE FEED STORE | farm |
| 4 | COUNTY FAIR FRENZY | fair |
| 5 | THE OLD CAR WASH (boss) | industrial |

Levels unlock sequentially; progress persists in localStorage.

## Creating a level

Levels are plain data modules in `src/levels/` (`level1.js` ... `level5.js`),
registered in `src/levels/index.js`. Copy an existing file and change:

- `id`, `name`, `objective`, `flavor` — flavor lines play in the briefing screen.
- `duration` — seconds of rail travel before the level ends.
- `lookAhead` — how far down the road the camera looks (aim assist distance).
- `path` — array of `[x, y, z]` waypoints for the Catmull-Rom rail. Keep `y` around
  `2.2` (camera height). The road is built along this curve; total travel length
  should roughly match `duration`.
- `world`:
  - `theme`: one of `city`, `downtown`, `farm`, `fair`, `industrial`
    (drives sky/fog palette and theme extras like the ferris wheel or car wash).
  - `ground`: `grass` | `dirt` | `concrete`.
  - `roadWidth`, `riverSide` (`-1`, `1`, or `null`).
  - `structures[]`: `{ type, u, side, dist, text?, sub? }` where `u` is rail
    progress (0..1), `side` is left/right of the road and `dist` is lateral
    distance. Types: `storefront`, `sign`, `policecar`, `truck`, `gasstation`,
    `carwash`, `feedstore`. Keep `side: 0` clear — that's the rail line itself.
- `encounters[]`: `{ time, type, count, ahead }`. Buffalo types (see
  `CONFIG.buffalos` in `src/config.js`): `normal`, `angry`, `panicked`, `bandit`,
  `traffic`, `fair`, `security`, `giant`, plus `herd` (large group) and the
  special `feedstore_burst`. `ahead` is spawn distance down the road — it acts as a
  **minimum**: the spawn director widens it by rail speed and type, and queues waves
  that would exceed ~14 live buffalo.
- `events[]`: `{ time, type: 'announce' | 'bigtext' | 'music', text/track/freeze }`.
  `bigtext` freezes the world for `freeze` seconds (set pieces).
- `npcs[]`: `{ kind, u, side, dist }` — kinds: `cop`, `shopper`, `pedestrian`,
  `shopowner`, `fairworker`, `driver`. Shooting them is a civilian penalty.
- `shootables[]`: `{ type: 'sign' | 'trafficlight' | 'barrel' | 'crate' | 'balloon' | 'carnival', u, side, dist, text?, sub? }`.
  Barrels placed within 8m of each other chain-detonate when shot.

For a boss level (like level 5), add:

```js
boss: {
  distanceAhead: 20,           // how far past the rail end the boss blocks the road
  obstacles: [                 // barrels on the charge path between boss and camera
    { offset: [-4, 10] },      // [lateral, depth-along-charge-path]
    { offset: [4, 16] }
  ]
}
```

The boss (hp in `CONFIG.boss`) starts a multi-phase fight when the rail ends:
phases escalate at 75/50/25% hp — charges, cover movement between obstacles,
and minion spawns. Obstacle barrels are shootable; the boss rams them during
charges.

## Creating an enemy / variant

1. Add a stat block to `CONFIG.buffalos` in `src/config.js`:
   `{ hp, speed, scale: [min, max] }` (`speed: 0` = stationary).
2. Reference the key as `type` in level `encounters[]`.
3. Optional per-variant look/behavior lives in `src/enemies/Buffalo.js`
   (state machine: idle -> walk -> telegraph -> charge -> stagger/dead) and
   `src/world/buffaloModel.js` (`buildBuffalo` adds variant accessories, e.g.
   the giant's extra hump; it returns shared materials + a `shadow` part that
   `Buffalo.dispose` frees — keep disposal in sync if you add meshes).

Boss behavior is in `src/enemies/BossBuffalo.js`; its obstacle/charge syncing is
in `LevelManager._updateBoss`.

## Project layout

```
index.html            All screens/HUD DOM (menu, briefing, pause, results, victory...)
src/
  main.js             Entry: instantiates Game, exposes window.__BUFFALO_COP__
  config.js           Global tuning (weapon, scoring, combos, variants, difficulty)
  core/Game.js        State machine + main tick loop + event callbacks
  core/InputManager.js / AudioManager.js / SaveManager.js / ScoreManager.js
  systems/            RailSystem, CameraController, ParticleManager,
                      EnemyManager, LevelManager, UIManager, upgrades.js
  player/             Player (hp/damage), Weapon (fire/reload/raycast + upgrade stats)
  enemies/            Buffalo, BossBuffalo, NPC
  world/              ProceduralWorld + procedural textures/geometry/buffalo model
                      + landmarks.js (stylized real Toledo structures)
  levels/             level1..5.js data modules + index.js registry
scripts/
  smoke.js            Node logic tests (levels, rails, combos, rng) - no browser
  headless-test.mjs   Headless Chrome CDP integration test of the full game loop
  boss-probe.mjs      Boss-fight aim/damage diagnostic probe
```

## Tests

```bash
node scripts/smoke.js            # logic tests (no browser needed)
node scripts/headless-test.mjs   # full in-browser integration test (needs Chrome)
node scripts/music-probe.mjs     # drives the music sequencer with a mock AudioContext
node scripts/spawn-audit.mjs     # reports spawn pacing per level (reaction times, alive peaks)
```

The headless test boots the built game (`dist/`) in headless Chrome, drives the
real tick loop with a fake clock, and validates: menu -> briefing -> play ->
kills -> results -> level 2 -> pause/resume -> game over/retry -> level 5 boss
fight -> boss death -> victory -> high-score save. It fails on any page
exception or console error.
