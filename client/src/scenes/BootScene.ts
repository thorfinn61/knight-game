import * as Phaser from 'phaser';
import {
  KNIGHT_FRAME_HEIGHT,
  KNIGHT_FRAME_WIDTH,
  KNIGHT_SHEETS,
  KNIGHT_VARIANTS,
  knightTextureKey,
  sheetPath,
  type KnightSheet,
} from '../knight/sheets.ts';
import { createGeneratedTextures } from '../view/textures.ts';

/** Événement émis sur `game.events` quand toutes les textures sont prêtes. */
export const ASSETS_READY = 'cendres:assets-ready';

/** Charge les planches des deux armures et génère les textures en code. Le menu lance la suite. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      console.error(`Échec du chargement : ${file.src}`);
    });
    for (const variant of KNIGHT_VARIANTS) {
      for (const sheet of Object.keys(KNIGHT_SHEETS) as KnightSheet[]) {
        this.load.spritesheet(
          knightTextureKey(variant, sheet),
          sheetPath(variant) + KNIGHT_SHEETS[sheet].file,
          {
            frameWidth: KNIGHT_FRAME_WIDTH,
            frameHeight: KNIGHT_FRAME_HEIGHT,
          },
        );
      }
    }
  }

  create(): void {
    createGeneratedTextures(this);
    this.registry.set(ASSETS_READY, true);
    this.game.events.emit(ASSETS_READY);
  }
}
