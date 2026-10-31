import * as THREE from 'three';
import { RailSystem } from './RailSystem.js';
import { buildWorld, clearWorld, mats, makeJokeSign, makeTrafficLight, makeBarrel, makeCrate, makeBalloonCluster, makeCarnivalGame, makeHayBale } from '../world/ProceduralWorld.js';
import { BossBuffalo } from '../enemies/BossBuffalo.js';
import { Rng } from '../utils/rng.js';
import { clamp } from '../utils/mathx.js';

// A shootable environmental prop (signs, traffic lights, barrels, balloons...).
class Shootable {
  constructor(type, group, game, placement) {
    this.type = type;
    this.group = group;
    this.game = game;
    this.u = placement ? placement.u : null;
    this.active = true;
    this.isShootable = true;
    this.removeAt = 0;
    group.traverse((o) => { if (o.isMesh) o.userData.owner = this; });
    game.scene.add(group);
  }

  onShot(game, point, depth = 0) {
    if (!this.active) return;
    const M = null; // materials handled per-type below
    switch (this.type) {
      case 'sign': {
        // The sign reveals hidden buffalo behind it.
        this.active = false;
        game.audio.obstacleBreak();
        game.particles.spawnBurst(point, {
          count: 14, colors: [0xd8d8d8, 0x9a9da1, 0xc23a3a],
          size: [0.3, 0.7], speed: [2, 5], life: [0.4, 0.8], gravity: 6
        });
        game.score.registerHit(50);
        game.ui.showCombo();
        game.announceMaybe('HIDDEN BUFFALO!');
        // They pour out onto the street at the sign's position (always on-road).
        for (let i = 0; i < 3; i++) {
          const pos = game.levelManager.roadPointAt(this.u, (Math.random() - 0.5) * 6);
          game.enemyManager.spawnBuffalo(Math.random() < 0.5 ? 'normal' : 'angry', pos);
        }
        this.group.rotation.z = 0.5; // topple
        this.removeAt = game.time + 2;
        break;
      }
      case 'trafficlight': {
        this.active = false;
        const lights = this.group.userData.lights;
        if (lights) {
          lights[0].material.emissive.setHex(0x000000); // red off
          lights[2].material.emissive.setHex(0x11aa33); // green on
        }
        game.audio.horn();
        game.score.registerHit(50);
        game.ui.showCombo();
        game.announceMaybe('HERD INCOMING!');
        // A herd crosses the street ahead of the camera (always on-road).
        const roadW = game.levelManager.levelData.world.roadWidth || 10;
        for (let i = 0; i < 6; i++) {
          const pos = game.levelManager.roadSpawnPos(
            12 + Math.random() * 8, (Math.random() - 0.5) * (roadW - 3));
          game.enemyManager.spawnBuffalo('panicked', pos);
        }
        this.removeAt = game.time + 3;
        break;
      }
      case 'balloon': {
        this.active = false;
        game.audio.obstacleBreak();
        const p = this.group.position.clone(); p.y += 2.8;
        game.particles.spawnBurst(p, {
          count: 22, colors: [0xff4fa0, 0x3ea6ff, 0xfff23e, 0x9dff6a],
          size: [0.25, 0.6], speed: [2, 6], life: [0.6, 1.2], gravity: 2
        });
        game.score.registerHit(50);
        game.ui.showCombo();
        this.group.visible = false;
        this.removeAt = game.time + 1.5;
        break;
      }
      case 'carnival': {
        this.active = false;
        game.audio.obstacleBreak();
        game.particles.spawnBurst(point, {
          count: 16, colors: [0xffffff, 0xd83a3a, 0x7fd4ff],
          size: [0.25, 0.6], speed: [3, 6], life: [0.5, 0.9], gravity: 6
        });
        game.score.registerHit(50);
        game.ui.showCombo();
        this.group.rotation.x = 0.7;
        this.removeAt = game.time + 2;
        break;
      }
      case 'barrel': {
        this.active = false;
        game.audio.explosion();
        game.cameraCtrl.addShake(0.5);
        game.particles.spawnBurst(point, {
          count: 26, colors: [0xffb03e, 0xff5a2a, 0x8a8a8a, 0xe8dcc0],
          size: [0.5, 1.2], speed: [3, 8], life: [0.5, 1.1], gravity: 4, grow: 1.6
        });
        game.score.registerHit(50);
        game.ui.showCombo();
        this.group.visible = false;
        this.removeAt = game.time + 1.5;
        // The blast: splash damage on nearby buffalo, chain to neighbouring barrels.
        game.barrelBlast(point || this.group.position.clone().setY(1), depth, this);
        break;
      }
      case 'crate': {
        this.active = false;
        game.audio.obstacleBreak();
        game.particles.spawnBurst(point, {
          count: 16, colors: [0x8a6a42, 0x6a4e30],
          size: [0.3, 0.7], speed: [2, 5], life: [0.4, 0.8], gravity: 6
        });
        game.score.registerHit(50);
        game.ui.showCombo();
        this.group.visible = false;
        this.removeAt = game.time + 1.5;
        break;
      }
      case 'haybale': {
        this.active = false;
        game.audio.obstacleBreak();
        game.particles.spawnBurst(point, {
          count: 20, colors: [0xc8a84a, 0xb89838],
          size: [0.3, 0.8], speed: [2, 5], life: [0.5, 1], gravity: 3
        });
        game.score.registerHit(50);
        game.ui.showCombo();
        this.group.visible = false;
        this.removeAt = game.time + 1.5;
        break;
      }
      case 'obstacle': {
        // Boss fight: shooting these creates obstacles that stop charges.
        this.active = false;
        this.obstacleActive = true;
        game.audio.explosion();
        game.cameraCtrl.addShake(0.4);
        const p = this.group.position.clone(); p.y = 1;
        game.particles.spawnBurst(p, {
          count: 20, colors: [0xc9b28a, 0xffd23e, 0x8a8a8a],
          size: [0.5, 1.1], speed: [3, 7], life: [0.5, 1], gravity: 3
        });
        game.score.registerHit(50);
        game.ui.showCombo();
        game.announceMaybe('OBSTACLE DEPLOYED!');
        break;
      }
    }
  }

  dispose(game) {
    // Geometries are unique per prop; materials may be shared by the level cache.
    this.group.traverse((o) => { if (o.isMesh && o.geometry) o.geometry.dispose(); });
    game.scene.remove(this.group);
  }
}

export class LevelManager {
  constructor(game) {
    this.game = game;
    this.levelData = null;
    this.rail = null;
    this.world = null;
    this.shootables = [];
    this.obstacles = [];   // {pos, active} for boss phase-2
    this.events = [];
    this.eventIndex = 0;
    this.time = 0;
    this.frozen = 0;
    this.bossActive = false;
    this.bossEnding = false;
    this.boss = null;
    this.endTimer = 0;
    this.pendingEnc = [];    // spawn director: encounters held back while the board is crowded
    this.rng = new Rng(1234);
  }

  load(levelIndex) {
    const game = this.game;
    // Teardown previous level.
    if (this.world) clearWorld(game.scene, this.world);
    game.enemyManager.clear();
    for (const s of this.shootables) s.dispose(game);
    this.shootables = [];
    this.obstacles = [];
    this.boss = null;
    this.bossActive = false;
    this.pendingEnc = [];

    const data = game.levelDataFor(levelIndex);
    this.levelData = data;
    this.rng = new Rng(1234 + levelIndex * 777);

    // Build the rail. Look targets default to a point ahead on the path.
    const posVecs = data.path.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    const tmpCurve = new THREE.CatmullRomCurve3(posVecs, false, 'centripetal');
    let lookAts;
    if (data.lookAts) {
      lookAts = data.lookAts.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    } else {
      const ahead = data.lookAhead || 24;
      const len = tmpCurve.getLength();
      lookAts = [];
      for (let i = 0; i < posVecs.length; i++) {
        const u = Math.min(1, (i / (posVecs.length - 1)) + ahead / len);
        lookAts.push(tmpCurve.getPointAt(u));
      }
    }
    this.rail = new RailSystem(posVecs.map((v) => [v.x, v.y, v.z]),
      lookAts.map((v) => [v.x, v.y, v.z]), data.duration);

    // Build the world.
    this.world = buildWorld(game.scene, this.rail.posCurve, data, this.rng);

    // Merge events + encounters into one time-sorted list.
    const items = [];
    for (const e of data.events || []) items.push({ ...e, kind: 'event' });
    for (const e of data.encounters || []) items.push({ ...e, kind: 'encounter' });
    items.sort((a, b) => a.time - b.time);
    this.events = items;
    this.eventIndex = 0;
    this.time = 0;
    this.frozen = 0;
    this.endTimer = 0;

    // Place NPCs.
    for (const n of data.npcs || []) {
      const pos = this._posAlong(n.u, n.side, n.dist);
      const npc = game.enemyManager.spawnNPC(n.kind, pos);
      if (npc) this._clearFromSolids(npc.group, npc.homePos, n.u, n.side, n.dist, 4.2);
    }

    // Place shootables.
    for (const s of data.shootables || []) {
      const group = this._makeShootableGroup(s);
      if (!group) continue;
      const sh = new Shootable(s.type, group, game, s);
      const pos = this._posAlong(s.u, s.side, s.dist);
      group.position.copy(pos);
      // Face the road.
      const p2 = this.rail.sampleAt(s.u, new THREE.Vector3());
      const dx = p2.x - pos.x, dz = p2.z - pos.z;
      group.rotation.y = Math.atan2(dx, dz);
      this._clearFromSolids(group, null, s.u, s.side, s.dist, 3.6);
      if (s.type === 'balloon') {
        // Balloons bob.
        this.world.anims.push((dt, time) => { group.position.y = Math.sin(time * 1.4 + s.u * 9) * 0.15; });
      }
      this.shootables.push(sh);
    }

    game.audio.playMusic('explore');
    game.ui.setMission(data.id, data.name);
  }

  _makeShootableGroup(s) {
    const M = null;
    switch (s.type) {
      case 'sign': return makeJokeSign(s.text || '', s.sub || null, this._M(), s.w || 4);
      case 'trafficlight': return makeTrafficLight(this._M());
      case 'barrel': return makeBarrel(this._M());
      case 'crate': return makeCrate(this._M());
      case 'balloon': return makeBalloonCluster(this.rng, this._M()).group;
      case 'carnival': return makeCarnivalGame(this.rng, this._M());
      case 'haybale': return makeHayBale(this._M());
      default: return null;
    }
  }

  _M() {
    // Shared material cache (already initialized by buildWorld).
    return mats();
  }

  // Position along the rail at progress u, offset laterally.
  _posAlong(u, side, dist) {
    const p = this.rail.sampleAt(u, new THREE.Vector3());
    const right = this.rail.rightVector(new THREE.Vector3(), u);
    return new THREE.Vector3(
      p.x + right.x * (side || 0) * (dist || 0),
      0,
      p.z + right.z * (side || 0) * (dist || 0));
  }

  // Slide a roadside prop toward the road until its Box3 clears all solid
  // world footprints (buildings/structures). Keeps NPC homePos in sync via pos.
  _clearFromSolids(group, pos, u, side, dist, minDist) {
    const boxes = this.world && this.world.solidBoxes;
    if (!boxes || !boxes.length) return;
    const box = new THREE.Box3();
    const probe = (d) => {
      group.position.copy(this._posAlong(u, side, d));
      group.updateMatrixWorld(true);
      box.setFromObject(group);
      return !boxes.some((b) => b.intersectsBox(box));
    };
    for (let d = dist; d >= minDist; d -= 0.8) {
      if (probe(d)) { if (pos) pos.copy(group.position); return; }
    }
    group.position.copy(this._posAlong(u, side, minDist));
    group.updateMatrixWorld(true);
    if (pos) pos.copy(group.position);
  }

  // ---------- ON-ROAD SPAWNING ----------
  // Lateral offset clamped so spawns always stay on the asphalt, never in
  // the building zone off the road.
  _maxLateral() { return (this.levelData.world.roadWidth || 10) / 2 - 1.5; }

  // Point on the road centerline at arc progress u, with a clamped lateral offset.
  roadPointAt(u, lateral = 0) {
    const p = this.rail.sampleAt(u, new THREE.Vector3());
    const right = this.rail.rightVector(new THREE.Vector3(), u);
    p.addScaledVector(right, clamp(lateral, -this._maxLateral(), this._maxLateral()));
    p.y = 0;
    return p;
  }

  // Spawn position `ahead` meters ahead of the camera, following the rail curve.
  roadSpawnPos(ahead, lateral = 0) {
    const len = this.rail.posCurve.getLength();
    return this.roadPointAt(clamp(this.rail.easedProgress() + ahead / len, 0, 1), lateral);
  }

  freeze(seconds) { this.frozen = Math.max(this.frozen, seconds); }

  update(dt, time) {
    const game = this.game;

    // Frozen set pieces: hold the world, keep rendering.
    if (this.frozen > 0) {
      this.frozen = Math.max(0, this.frozen - dt);
      return;
    }

    // Boss defeat cinematic finished -> end the level.
    if (this.bossEnding) {
      this.bossEnding = false;
      if (this.boss) { this.boss.dispose(); this.boss = null; }
      game.completeLevel(true);
      return;
    }

    this.time += dt;

    // Boss mode overrides rail movement.
    if (this.bossActive) {
      this._updateBoss(dt, time);
      game.enemyManager.update(dt, time);
      for (const a of this.world.anims) a(dt, time);
      return;
    }

    // Advance the rail.
    this.rail.update(dt);

    // Spawn director: hold encounters back while the board is already crowded,
    // fire them once it clears (or after 5s regardless).
    if (this.pendingEnc.length) {
      const alive = game._aliveHerdCount();
      for (let i = this.pendingEnc.length - 1; i >= 0; i--) {
        const pe = this.pendingEnc[i];
        if (alive < 12 || game.time >= pe.deadline) {
          this.pendingEnc.splice(i, 1);
          this._fireEncounter(pe.enc, true);
        }
      }
    }

    // Fire due events/encounters.
    while (this.eventIndex < this.events.length && this.events[this.eventIndex].time <= this.time) {
      const item = this.events[this.eventIndex++];
      if (item.kind === 'event') this._fireEvent(item);
      else this._fireEncounter(item);
    }

    game.enemyManager.update(dt, time);
    for (const a of this.world.anims) a(dt, time);

    // Cleanup expired shootables.
    for (let i = this.shootables.length - 1; i >= 0; i--) {
      const s = this.shootables[i];
      if (s.removeAt && time >= s.removeAt) {
        s.dispose(game);
        this.shootables.splice(i, 1);
      }
    }

    // Level end.
    if (this.rail.finished) {
      if (this.levelData.boss) {
        if (!this.bossActive) this._startBoss();
      } else {
        this.endTimer += dt;
        if (this.endTimer > 1.2) game.completeLevel();
      }
    }
  }

  _fireEvent(item) {
    const game = this.game;
    switch (item.type) {
      case 'announce': game.announce(item.text); break;
      case 'bigtext':
        game.showBigText(item.text, item.freeze || 1.6);
        this.freeze(item.freeze || 1.6);
        break;
      case 'music': game.audio.playMusic(item.track); break;
    }
  }

  _fireEncounter(enc, forced = false) {
    const game = this.game;

    // Spawn director: don't stack a fresh wave onto an already-full road.
    if (!forced && enc.type !== 'feedstore_burst' && game._aliveHerdCount() >= 14) {
      this.pendingEnc.push({ enc, deadline: game.time + 5 });
      return;
    }

    const scale = game.difficulty.spawnScale;
    const count = Math.max(1, Math.round((enc.count || 1) * scale));
    const roadW = this.levelData.world.roadWidth || 10;
    // Reaction-time guarantee: charging types spawn farther out, and everyone
    // scales with the rail's current speed (the ride eases in/out, so a fixed
    // "ahead" would land much closer at the slow start of a level).
    const REACTION_AHEAD = { angry: 28, security: 28, giant: 30, herd: 24, traffic: 18, bandit: 22, panicked: 18 };
    const speed = this.rail.speedAt(this.rail.progress);
    const ahead = Math.max(enc.ahead || 20, REACTION_AHEAD[enc.type] || 18, speed * 4 + 10);

    if (enc.type === 'feedstore_burst') {
      // Doors of the feed store blow open; buffalo pour onto the street ahead.
      const p = this.roadSpawnPos(8, 0);
      game.audio.explosion();
      game.cameraCtrl.addShake(0.7);
      game.particles.spawnBurst(p.clone().setY(2), {
        count: 30, colors: [0x8a6a42, 0xc8a84a, 0xd8d8d8],
        size: [0.5, 1.2], speed: [3, 8], life: [0.5, 1], gravity: 4
      });
      // They pour out onto the street just ahead of the player (always on-road).
      // Never closer than 12m — a burst in your face is not a fair ambush.
      for (let i = 0; i < count; i++) {
        const pos = this.roadSpawnPos(12 + Math.random() * 10, (Math.random() - 0.5) * (roadW - 4));
        game.enemyManager.spawnBuffalo(i % 3 === 0 ? 'angry' : 'normal', pos);
      }
      return;
    }

    for (let i = 0; i < count; i++) {
      let lateral;
      if (enc.type === 'herd') {
        // Spread across the whole road width.
        lateral = (Math.random() - 0.5) * (roadW - 3);
      } else if (enc.type === 'traffic') {
        // A jam blocking the street, side by side.
        lateral = (i - (count - 1) / 2) * 2.4;
      } else {
        lateral = (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * (roadW / 2 - 3));
      }
      const pos = this.roadSpawnPos(ahead + (Math.random() - 0.5) * 4, lateral);
      game.enemyManager.spawnBuffalo(enc.type, pos);
    }
  }

  // ---------- BOSS ----------
  _startBoss() {
    const game = this.game;
    const data = this.levelData;
    const endPos = this.rail.sampleAt(1, new THREE.Vector3());
    const tan = this.rail.tangentAt(1, new THREE.Vector3());
    const bossPos = new THREE.Vector3(
      endPos.x + tan.x * (data.boss.distanceAhead || 20), 0,
      endPos.z + tan.z * (data.boss.distanceAhead || 20));

    this.boss = new BossBuffalo(bossPos, game);
    game.enemyManager.buffalos.push(this.boss);
    this.bossActive = true;

    // Obstacle barrels along the boss's charge path (between boss and camera).
    const toCam = new THREE.Vector3().subVectors(endPos, bossPos);
    toCam.y = 0; toCam.normalize();
    for (const o of data.boss.obstacles || []) {
      // offset = [lateral, depth-along-charge-path]
      const lateral = o.offset[0], depth = o.offset[1];
      const pos = new THREE.Vector3(
        bossPos.x + toCam.x * depth, 0, bossPos.z + toCam.z * depth);
      pos.x += -toCam.z * lateral;
      pos.z += toCam.x * lateral;
      const group = makeBarrel(this._M());
      group.position.copy(pos);
      const sh = new Shootable('obstacle', group, game, null);
      this.shootables.push(sh);
      this.obstacles.push({ pos: pos.clone(), active: false, shootable: sh });
    }

    game.audio.playMusic('boss');
    game.announceForce('THE BIGGEST BUFFALO IN TOLEDO');
  }

  _updateBoss(dt, time) {
    // The boss lives in enemyManager.buffalos, so its AI runs there.
    // We only keep obstacle flags in sync for charge collisions.
    for (const o of this.obstacles) {
      o.active = !!(o.shootable && o.shootable.obstacleActive);
    }
  }

  onBossDefeated() {
    const game = this.game;
    game.audio.victory();
    game.showBigText('THE BIGGEST BUFFALO IN TOLEDO HAS FALLEN', 3.2);
    this.freeze(3.4);
    this.bossActive = false;
    this.bossEnding = true; // update() will finish the level once the freeze ends
  }

  dispose() {
    const game = this.game;
    if (this.world) clearWorld(game.scene, this.world);
    this.world = null;
    game.enemyManager.clear();
    for (const s of this.shootables) s.dispose(game);
    this.shootables = [];
    this.obstacles = [];
  }
}
