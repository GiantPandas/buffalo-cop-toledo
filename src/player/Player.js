import { CONFIG } from '../config.js';
import { Weapon } from './Weapon.js';

// Player: health, aiming input, weapon ownership.
export class Player {
  constructor(camera, game) {
    this.game = game;
    this.hp = CONFIG.player.maxHp;
    this.maxHp = CONFIG.player.maxHp;
    this.damageReduction = 0;      // run upgrade: fraction of charge damage ignored
    this.flatDamageReduction = 0;  // run upgrade: flat points off every hit
    this.alive = true;
    this.weapon = new Weapon(camera, game);
    camera.add(this.weapon.model); // ensure in scene graph (camera is)
  }

  update(dt) {
    const g = this.game;
    if (!this.alive) return;

    // Fire on hold — the UZ-TOLEDO is full-auto; bloom converges when you let off.
    if ((g.input.firing || g.input.firePressed) && this.weapon.canFire) {
      this.weapon.fire();
    }
    if (g.input.reloadPressed) this.weapon.reload();
    // Auto-reload when empty.
    if (this.weapon.ammo === 0 && !this.weapon.reloading) this.weapon.reload();

    this.weapon.update(dt);
  }

  takeDamage(n) {
    if (!this.alive) return;
    const dmg = Math.max(1, (n - this.flatDamageReduction) * (1 - this.damageReduction));
    this.hp = Math.max(0, this.hp - dmg);
    this.game.audio.playerHurt();
    this.game.ui.flashDamage();
    this.game.ui.updateHp(this.hp, this.maxHp);
    this.game.cameraCtrl.addShake(0.5);
    this.game.stats.damageTaken += dmg;
    if (this.hp <= 0) {
      this.alive = false;
      this.game.onGameOver();
    }
  }

  // Fresh run: clear upgrade-derived stats and restore base health.
  resetRun() {
    this.damageReduction = 0;
    this.flatDamageReduction = 0;
    this.maxHp = CONFIG.player.maxHp;
    this.hp = this.maxHp;
    this.alive = true;
  }

  dispose() {
    // Gun model lives on the camera; removing camera children is handled by scene reset.
  }
}
