import type * as Phaser from 'phaser';
import type { DummyState, HitEvent } from '@cendres/shared';
import { DEPTH, TEXTURES } from '../config.ts';

const FLASH_MS = 70;
const FLASH_HEAVY_MS = 110;
/** Balancement amorti autour du pied, en degrés. */
const WOBBLE_STIFFNESS = 220;
const WOBBLE_DAMPING = 9;
const WOBBLE_IMPULSE = 70;
const WOBBLE_HEAVY_IMPULSE = 130;
const MAX_STEP_S = 0.05;

/** Mannequin : flash blanc à l'impact, puis balancement une fois le gel du coup terminé. */
export class DummyView {
  readonly sprite: Phaser.GameObjects.Image;
  private flashMs = 0;
  private angle = 0;
  private angularVelocity = 0;
  private pendingImpulse = 0;

  constructor(scene: Phaser.Scene, d: DummyState) {
    this.sprite = scene.add.image(d.x, d.y, TEXTURES.dummy).setOrigin(0.5, 1).setDepth(DEPTH.dummy);
  }

  onHit(hit: HitEvent): void {
    this.flashMs = hit.heavy ? FLASH_HEAVY_MS : FLASH_MS;
    this.pendingImpulse += hit.direction * (hit.heavy ? WOBBLE_HEAVY_IMPULSE : WOBBLE_IMPULSE);
  }

  update(d: DummyState, deltaMs: number): void {
    if (this.flashMs > 0) {
      this.sprite.setTintFill(0xffffff);
      this.flashMs -= deltaMs;
    } else {
      this.sprite.clearTint();
    }
    // Pendant le gel du coup, le mannequin reste figé.
    if (d.hitstop > 0) return;
    this.angularVelocity += this.pendingImpulse;
    this.pendingImpulse = 0;
    const dt = Math.min(deltaMs / 1000, MAX_STEP_S);
    const accel = -WOBBLE_STIFFNESS * this.angle - WOBBLE_DAMPING * this.angularVelocity;
    this.angularVelocity += accel * dt;
    this.angle += this.angularVelocity * dt;
    this.sprite.setAngle(this.angle);
  }
}
