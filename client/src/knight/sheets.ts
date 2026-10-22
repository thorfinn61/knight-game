/**
 * Planches du pack FreeKnight utilisées par le client. Voir le CLAUDE.md pour le détail du
 * pack ; les planches composites et les variantes « avec déplacement » ne sont pas chargées.
 */

/** Variantes chargées : armure os et cendre, armure acier, toutes deux avec contour. */
export const KNIGHT_VARIANTS = ['Colour1/Outline', 'Colour2/Outline'] as const;
export type KnightVariant = (typeof KNIGHT_VARIANTS)[number];

export interface SkinLook {
  variant: KnightVariant;
  /** Teinte multipliée sur le sprite, ou null pour les couleurs d'origine. */
  tint: number | null;
}

/**
 * Apparence de chaque joueur d'un groupe, dans l'ordre d'arrivée. Le pack n'a que deux
 * armures : les joueurs 3 et 4 reçoivent une teinte provisoire.
 */
export const SKIN_LOOKS: readonly SkinLook[] = [
  { variant: 'Colour1/Outline', tint: null },
  { variant: 'Colour2/Outline', tint: null },
  { variant: 'Colour1/Outline', tint: 0xe0a69c },
  { variant: 'Colour2/Outline', tint: 0xa9cfa2 },
];

export function sheetPath(variant: KnightVariant): string {
  return `knight/${variant}/120x80_PNGSheets/`;
}

export const KNIGHT_FRAME_WIDTH = 120;
export const KNIGHT_FRAME_HEIGHT = 80;
/** Abscisse du centre du corps dans la frame : il n'est pas au centre de l'image. */
export const KNIGHT_ANCHOR_X = 55;

export interface SheetDef {
  file: string;
  frames: number;
  /** Durée d'une frame dans le pack, utilisée pour les animations en boucle. */
  frameMs: number;
}

export const KNIGHT_SHEETS = {
  Idle: { file: '_Idle.png', frames: 10, frameMs: 80 },
  Run: { file: '_Run.png', frames: 10, frameMs: 60 },
  TurnAround: { file: '_TurnAround.png', frames: 3, frameMs: 70 },
  Jump: { file: '_Jump.png', frames: 3, frameMs: 60 },
  JumpFallInbetween: { file: '_JumpFallInbetween.png', frames: 2, frameMs: 60 },
  Fall: { file: '_Fall.png', frames: 3, frameMs: 60 },
  Attack: { file: '_AttackNoMovement.png', frames: 4, frameMs: 60 },
  Attack2: { file: '_Attack2NoMovement.png', frames: 6, frameMs: 60 },
  CrouchAttack: { file: '_CrouchAttack.png', frames: 4, frameMs: 60 },
  CrouchTransition: { file: '_CrouchTransition.png', frames: 1, frameMs: 100 },
  Crouch: { file: '_Crouch.png', frames: 1, frameMs: 60 },
  CrouchWalk: { file: '_CrouchWalk.png', frames: 8, frameMs: 80 },
  Roll: { file: '_Roll.png', frames: 12, frameMs: 50 },
  Dash: { file: '_Dash.png', frames: 2, frameMs: 60 },
  SlideStart: { file: '_SlideTransitionStart.png', frames: 1, frameMs: 100 },
  Slide: { file: '_Slide.png', frames: 2, frameMs: 60 },
  SlideEnd: { file: '_SlideTransitionEnd.png', frames: 1, frameMs: 100 },
  Hit: { file: '_Hit.png', frames: 1, frameMs: 60 },
  Death: { file: '_DeathNoMovement.png', frames: 10, frameMs: 60 },
} as const satisfies Record<string, SheetDef>;

export type KnightSheet = keyof typeof KNIGHT_SHEETS;

export function knightTextureKey(variant: KnightVariant, sheet: KnightSheet): string {
  return `knight:${variant}:${sheet}`;
}

export function skinLook(skin: number): SkinLook {
  return SKIN_LOOKS[skin] ?? SKIN_LOOKS[0]!;
}
