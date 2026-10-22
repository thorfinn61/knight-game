/** Résolution interne du jeu, agrandie à l'écran par un multiple entier. */
export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 270;

/** Identifiant du joueur local dans la simulation. */
export const PLAYER_ID = 'p1';

/** Ordre d'affichage des calques. */
export const DEPTH = {
  room: 0,
  torch: 5,
  dummy: 10,
  knight: 20,
  fx: 30,
} as const;

/** Clés des textures générées par le code. */
export const TEXTURES = {
  dummy: 'dummy',
  spark: 'spark',
  parryRing: 'parry-ring',
  blazeRing: 'blaze-ring',
  ember: 'ember',
  torchBracket: 'torch-bracket',
  torchFlame: 'torch-flame',
} as const;

/** Nombre d'images de l'animation de flamme des torches. */
export const TORCH_FLAME_FRAMES = 4;
