import * as Phaser from 'phaser';
import { activeHitbox, dummyBox, isInvulnerable, knightBox, type Rect } from '@cendres/shared';
import type { Session } from '../session/Session.ts';

export interface DebugOverlayData {
  session: Session;
  camera: Phaser.Cameras.Scene2D.Camera;
}

const COLORS = {
  knight: 0x40e070,
  invulnerable: 0x40c0ff,
  hitbox: 0xff4040,
  dummy: 0xe0c040,
};

/**
 * Boîtes de collision et hitbox, dessinées dans une scène à part posée par-dessus le jeu :
 * elle échappe ainsi au shader d'ambiance et reste lisible dans le noir.
 */
export class DebugOverlayScene extends Phaser.Scene {
  /** Session et caméra de la scène de jeu (le nom `data` est déjà pris par Phaser). */
  private source!: DebugOverlayData;
  private graphics!: Phaser.GameObjects.Graphics;

  constructor() {
    super('DebugOverlay');
  }

  init(data: DebugOverlayData): void {
    this.source = data;
  }

  create(): void {
    this.graphics = this.add.graphics();
  }

  override update(): void {
    const { session, camera } = this.source;
    const g = this.graphics;
    g.clear();
    const outline = (r: Rect, color: number): void => {
      const x = Math.round(r.x - camera.scrollX);
      const y = Math.round(r.y - camera.scrollY);
      const w = Math.round(r.w);
      const h = Math.round(r.h);
      g.fillStyle(color, 1);
      g.fillRect(x, y, w, 1);
      g.fillRect(x, y + h - 1, w, 1);
      g.fillRect(x, y, 1, h);
      g.fillRect(x + w - 1, y, 1, h);
    };
    for (const d of session.dummies()) outline(dummyBox(d), COLORS.dummy);
    for (const { state } of session.knights()) {
      outline(knightBox(state), isInvulnerable(state) ? COLORS.invulnerable : COLORS.knight);
      const hitbox = activeHitbox(state);
      if (hitbox) {
        g.fillStyle(COLORS.hitbox, 0.3);
        g.fillRect(
          Math.round(hitbox.x - camera.scrollX),
          Math.round(hitbox.y - camera.scrollY),
          hitbox.w,
          hitbox.h,
        );
        outline(hitbox, COLORS.hitbox);
      }
    }
  }
}
