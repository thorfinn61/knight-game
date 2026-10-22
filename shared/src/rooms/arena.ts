import type { RoomDef } from '../room.ts';

const FLOOR_Y = 230;

/**
 * L'arène de duel : la grande salle d'une citadelle en ruine, sol plat, un seul écran de large.
 * Au fond, une brèche dans le mur laisse passer un peu de lune ; des torches sur les piliers et
 * deux braseros aux extrémités éclairent le combat. Le mannequin ne sert qu'à l'entraînement.
 * Aucun symbole religieux dans le décor : c'est une règle de direction artistique du projet.
 */
export const ARENA: RoomDef = {
  id: 'arena',
  width: 480,
  height: 270,
  solids: [
    { kind: 'stone', x: 0, y: FLOOR_Y, w: 480, h: 40 },
    { kind: 'stone', x: 0, y: 0, w: 480, h: 12 },
    { kind: 'stone', x: 0, y: 0, w: 16, h: 270 },
    { kind: 'stone', x: 464, y: 0, w: 16, h: 270 },
  ],
  decor: [
    { kind: 'backWall', x: 16, y: 12, w: 448, h: 218 },
    { kind: 'vault', x: 16, y: 12, w: 448, h: 10 },
    { kind: 'breach', x: 194, y: 40, w: 92, h: 104 },
    { kind: 'pillar', x: 92, y: 22, w: 24, h: 208 },
    { kind: 'pillarTrim', x: 88, y: 22, w: 32, h: 6 },
    { kind: 'pillarTrim', x: 88, y: 222, w: 32, h: 8 },
    { kind: 'pillar', x: 364, y: 22, w: 24, h: 208 },
    { kind: 'pillarTrim', x: 360, y: 22, w: 32, h: 6 },
    { kind: 'pillarTrim', x: 360, y: 222, w: 32, h: 8 },
    { kind: 'arch', x: 116, y: 22, w: 84, h: 8 },
    { kind: 'arch', x: 280, y: 22, w: 84, h: 8 },
    { kind: 'banner', x: 136, y: 30, w: 16, h: 74 },
    { kind: 'banner', x: 328, y: 30, w: 16, h: 74 },
    { kind: 'chain', x: 58, y: 12, w: 2, h: 74 },
    { kind: 'chain', x: 178, y: 12, w: 2, h: 40 },
    { kind: 'chain', x: 300, y: 12, w: 2, h: 46 },
    { kind: 'chain', x: 420, y: 12, w: 2, h: 66 },
    { kind: 'rubble', x: 20, y: 222, w: 9, h: 8 },
    { kind: 'rubble', x: 29, y: 226, w: 6, h: 4 },
    { kind: 'rubble', x: 451, y: 224, w: 9, h: 6 },
    { kind: 'rubble', x: 444, y: 227, w: 5, h: 3 },
    { kind: 'rubble', x: 236, y: 227, w: 7, h: 3 },
    { kind: 'brazier', x: 34, y: 206, w: 16, h: 24 },
    { kind: 'brazier', x: 430, y: 206, w: 16, h: 24 },
  ],
  spawns: [
    { x: 150, y: FLOOR_Y, facing: 1 },
    { x: 330, y: FLOOR_Y, facing: -1 },
  ],
  dummies: [{ x: 240, y: FLOOR_Y }],
  torches: [
    { x: 104, y: 126 },
    { x: 376, y: 126 },
    { x: 182, y: 120 },
    { x: 298, y: 120 },
  ],
  braziers: [
    { x: 42, y: 207 },
    { x: 438, y: 207 },
  ],
};
