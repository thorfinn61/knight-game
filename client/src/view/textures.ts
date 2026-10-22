import type * as Phaser from 'phaser';
import { TEXTURES, TORCH_FLAME_FRAMES } from '../config.ts';

/** Textures dessinées en code au démarrage : mannequin, éclats d'impact, torches. */
export function createGeneratedTextures(scene: Phaser.Scene): void {
  drawDummy(scene);
  drawSpark(scene);
  drawParryRing(scene);
  drawBlazeRing(scene);
  drawEmber(scene);
  drawTorchBracket(scene);
  drawTorchFlame(scene);
}

type Paint = (color: number, x: number, y: number, w: number, h: number) => void;

function withGraphics(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  draw: (paint: Paint) => void,
): void {
  const g = scene.make.graphics({}, false);
  draw((color, x, y, rw, rh) => {
    g.fillStyle(color, 1);
    g.fillRect(x, y, rw, rh);
  });
  g.generateTexture(key, w, h);
  g.destroy();
}

/**
 * Mannequin de 24 × 47 px : pieu, sac de paille aux bras ballants, tête de toile et cible
 * ronde. Les bras pendent le long du corps : la silhouette ne forme pas de croix.
 */
function drawDummy(scene: Phaser.Scene): void {
  withGraphics(scene, TEXTURES.dummy, 24, 47, (paint) => {
    // Pied et pieu.
    paint(0x3b2d20, 6, 44, 13, 3);
    paint(0x2f241a, 9, 42, 7, 2);
    paint(0x4a3828, 11, 28, 3, 16);
    paint(0x5c4632, 11, 28, 1, 16);
    // Corps en sac de paille, cerclé de cordes.
    paint(0x8c7448, 6, 12, 13, 17);
    paint(0x6e5a37, 15, 12, 4, 17);
    paint(0xa48a58, 7, 13, 2, 14);
    paint(0x3e2f1f, 6, 17, 13, 1);
    paint(0x3e2f1f, 6, 25, 13, 1);
    paint(0x9c8452, 7, 29, 2, 2);
    paint(0x9c8452, 13, 29, 2, 3);
    // Bras ballants, cousus aux épaules, paille qui dépasse aux poignets.
    paint(0x7d6640, 3, 13, 3, 11);
    paint(0x7d6640, 19, 13, 3, 11);
    paint(0x5f4d30, 21, 13, 1, 11);
    paint(0x9c8452, 3, 24, 3, 2);
    paint(0x9c8452, 19, 24, 3, 2);
    // Tête de toile et cible ronde peinte.
    paint(0x7d6a4f, 8, 3, 9, 9);
    paint(0x5f503b, 14, 3, 3, 9);
    paint(0x3e2f1f, 9, 11, 7, 1);
    paint(0x6b2a20, 11, 5, 2, 1);
    paint(0x6b2a20, 10, 6, 1, 2);
    paint(0x6b2a20, 13, 6, 1, 2);
    paint(0x6b2a20, 11, 8, 2, 1);
  });
}

/** Éclat d'impact de 9 × 9 px en losange plein : pas d'étoile à branches, qui ferait une croix. */
function drawSpark(scene: Phaser.Scene): void {
  withGraphics(scene, TEXTURES.spark, 9, 9, (paint) => {
    for (let y = 0; y < 9; y++) {
      const half = 4 - Math.abs(y - 4);
      paint(0xffe6a0, 4 - half, y, half * 2 + 1, 1);
      if (half > 1) paint(0xfff2c0, 5 - half, y, half * 2 - 1, 1);
    }
    paint(0xffffff, 3, 3, 3, 3);
  });
}

/** Anneau de 15 × 15 px, d'un blanc froid : l'onde d'une parade réussie. */
function drawParryRing(scene: Phaser.Scene): void {
  const radius = 6.5;
  withGraphics(scene, TEXTURES.parryRing, 15, 15, (paint) => {
    for (let y = 0; y < 15; y++) {
      for (let x = 0; x < 15; x++) {
        const d = Math.hypot(x - 7, y - 7);
        if (d > radius - 1.2 && d <= radius) paint(0xe4ecff, x, y, 1, 1);
      }
    }
  });
}

/** Anneau de flammes de 64 × 64 px, orange au bord, jaune à l'intérieur : l'onde de l'Embrasement. */
function drawBlazeRing(scene: Phaser.Scene): void {
  const radius = 31;
  withGraphics(scene, TEXTURES.blazeRing, 64, 64, (paint) => {
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        const d = Math.hypot(x - 31.5, y - 31.5);
        if (d > radius || d <= radius - 4) continue;
        paint(d > radius - 1.5 ? 0xe0702a : 0xffc860, x, y, 1, 1);
      }
    }
  });
}

/** Braise de 2 × 2 px, au cœur plus clair. */
function drawEmber(scene: Phaser.Scene): void {
  withGraphics(scene, TEXTURES.ember, 2, 2, (paint) => {
    paint(0xe0702a, 0, 0, 2, 2);
    paint(0xffd080, 0, 0, 1, 1);
  });
}

/** Support de torche en fer forgé, 7 × 6 px : coupelle, tige, platine fixée au mur. */
function drawTorchBracket(scene: Phaser.Scene): void {
  withGraphics(scene, TEXTURES.torchBracket, 7, 6, (paint) => {
    paint(0x57524c, 0, 0, 7, 1);
    paint(0x3d3a37, 1, 1, 5, 1);
    paint(0x34312e, 3, 2, 1, 2);
    paint(0x2b2927, 2, 4, 3, 2);
    paint(0x45413d, 2, 4, 1, 1);
  });
}

/** Couleurs de la flamme, du bord vers le cœur. */
const FLAME_COLORS: Readonly<Record<string, number>> = {
  r: 0xa83a1a,
  o: 0xe67a26,
  y: 0xffc85a,
  c: 0xfff2c4,
};

/** Quatre images de 7 × 10 px : la pointe de la flamme oscille. */
const FLAME_FRAMES: readonly (readonly string[])[] = [
  [
    '...r...',
    '...r...',
    '..ror..',
    '..ror..',
    '.rooor.',
    '.royor.',
    '.rycyr.',
    '.rycyr.',
    '..ryr..',
    '...r...',
  ],
  [
    '..r....',
    '..rr...',
    '..ror..',
    '.roor..',
    '.rooor.',
    '.royor.',
    '.rycyr.',
    '.rycyr.',
    '..ryr..',
    '...r...',
  ],
  [
    '...r...',
    '..rr...',
    '..ror..',
    '..ror..',
    '.royor.',
    '.royor.',
    '.rycyr.',
    '.rycyr.',
    '..ryr..',
    '...r...',
  ],
  [
    '....r..',
    '...rr..',
    '..ror..',
    '..roor.',
    '.rooor.',
    '.royor.',
    '.rycyr.',
    '.rycyr.',
    '..ryr..',
    '...r...',
  ],
];
const FLAME_WIDTH = 7;
const FLAME_HEIGHT = 10;

function drawTorchFlame(scene: Phaser.Scene): void {
  withGraphics(
    scene,
    TEXTURES.torchFlame,
    FLAME_WIDTH * TORCH_FLAME_FRAMES,
    FLAME_HEIGHT,
    (paint) => {
      FLAME_FRAMES.forEach((rows, frame) => {
        rows.forEach((row, y) => {
          Array.from(row).forEach((cell, x) => {
            const color = FLAME_COLORS[cell];
            if (color !== undefined) paint(color, frame * FLAME_WIDTH + x, y, 1, 1);
          });
        });
      });
    },
  );
  const texture = scene.textures.get(TEXTURES.torchFlame);
  for (let frame = 0; frame < TORCH_FLAME_FRAMES; frame++) {
    texture.add(frame, 0, frame * FLAME_WIDTH, 0, FLAME_WIDTH, FLAME_HEIGHT);
  }
}
