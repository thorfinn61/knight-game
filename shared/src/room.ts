import type { Facing, Point, Rect } from './geometry.ts';

/** Nature d'un solide, pour choisir son rendu. La physique les traite tous pareil. */
export type SolidKind = 'stone' | 'platform';

/** Éléments de décor sans collision, ignorés par la simulation et donc par le serveur. */
export type DecorKind =
  | 'backWall'
  | 'vault'
  | 'pillar'
  | 'pillarTrim'
  | 'arch'
  | 'breach'
  | 'banner'
  | 'chain'
  | 'rubble'
  | 'brazier';

export interface SolidDef extends Rect {
  kind: SolidKind;
}

export interface DecorDef extends Rect {
  kind: DecorKind;
}

/** Point d'apparition d'un joueur, avec le sens dans lequel il regarde. */
export interface SpawnPoint extends Point {
  facing: Facing;
}

/** Salle décrite en données pures : la même définition sert au client et au serveur. */
export interface RoomDef {
  id: string;
  width: number;
  height: number;
  solids: readonly SolidDef[];
  decor: readonly DecorDef[];
  /** Points d'apparition, dans l'ordre des joueurs : en duel, gauche puis droite. */
  spawns: readonly SpawnPoint[];
  /** Position des pieds de chaque mannequin d'entraînement. */
  dummies: readonly Point[];
  /** Torches fixées aux murs : position de la flamme. Purement visuel. */
  torches: readonly Point[];
  /** Braseros posés au sol : position de la base de la flamme. Purement visuel. */
  braziers: readonly Point[];
}
