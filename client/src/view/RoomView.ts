import type * as Phaser from 'phaser';
import type { DecorDef, Rect, RoomDef, SolidDef } from '@cendres/shared';
import { DEPTH } from '../config.ts';

/**
 * Couleurs de la salle, volontairement plus claires que le rendu final : le shader
 * d'ambiance désature et assombrit tout ce qui n'est pas dans la lumière.
 */
const COLORS = {
  backWall: 0x24211f,
  backWallMortar: 0x1a1816,
  backWallAccent: 0x1e1b19,
  pillar: 0x37322e,
  pillarLight: 0x45403a,
  pillarShadow: 0x29251f,
  pillarJoint: 0x2c2824,
  pillarTrim: 0x4a433c,
  arch: 0x302b27,
  archEdge: 0x403a34,
  chainLink: 0x55514c,
  chainGap: 0x2a2826,
  rubble: 0x3f3934,
  rubbleTop: 0x57504a,
  stone: 0x403a35,
  stoneMortar: 0x2e2925,
  stoneAccent: 0x38332e,
  stoneTop: 0x625a50,
  stoneLip: 0x4f4842,
  platform: 0x4b433b,
  platformTop: 0x6f6457,
  platformShadow: 0x2b2622,
  vault: 0x1b1918,
  vaultRib: 0x2c2825,
  breachRim: 0x2a2623,
  breachRimLight: 0x4a433c,
  night: 0x0d1322,
  nightLow: 0x16203a,
  moon: 0xaab6c8,
  moonShade: 0x7f8ba0,
  star: 0x55617a,
  banner: 0x5a1717,
  bannerShade: 0x3a0e0e,
  bannerEmblem: 0xb5a88f,
  bannerEmblemCore: 0x8a2a1c,
  bannerRod: 0x2b2927,
  iron: 0x3d3a37,
  ironLight: 0x5a5650,
  ironDark: 0x2a2826,
  embers: 0x9a3412,
} as const;

/** Dessine la salle une fois pour toutes : décor d'abord, solides par-dessus. */
export function drawRoom(scene: Phaser.Scene, room: RoomDef): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(DEPTH.room);
  for (const decor of room.decor) drawDecor(g, decor);
  for (const solid of room.solids) drawSolid(g, solid, room);
  return g;
}

/** Pseudo-hasard déterministe, pour varier les briques sans changer d'une partie à l'autre. */
function hash2(x: number, y: number): number {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

function fill(
  g: Phaser.GameObjects.Graphics,
  color: number,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  g.fillStyle(color, 1);
  g.fillRect(x, y, w, h);
}

/** Appareil de briques décalées d'une rangée sur l'autre, avec quelques briques plus sombres. */
function drawBricks(
  g: Phaser.GameObjects.Graphics,
  r: Rect,
  brickW: number,
  brickH: number,
  colors: { base: number; mortar: number; accent: number },
): void {
  fill(g, colors.base, r.x, r.y, r.w, r.h);
  const right = r.x + r.w;
  const bottom = r.y + r.h;
  for (let row = 0; r.y + row * brickH < bottom; row++) {
    const y = r.y + row * brickH;
    const h = Math.min(brickH, bottom - y);
    const offset = row % 2 === 0 ? 0 : Math.floor(brickW / 2);
    for (let x = r.x - offset; x < right; x += brickW) {
      const x0 = Math.max(x, r.x);
      const x1 = Math.min(x + brickW, right);
      if (x1 - x0 <= 1) continue;
      if (hash2(x, y) < 0.22) fill(g, colors.accent, x0, y, x1 - x0, h);
      fill(g, colors.mortar, x0, y, x1 - x0, 1);
      if (x >= r.x) fill(g, colors.mortar, x, y, 1, h);
    }
  }
}

function drawDecor(g: Phaser.GameObjects.Graphics, d: DecorDef): void {
  switch (d.kind) {
    case 'backWall':
      drawBricks(g, d, 16, 8, {
        base: COLORS.backWall,
        mortar: COLORS.backWallMortar,
        accent: COLORS.backWallAccent,
      });
      return;
    case 'pillar':
      fill(g, COLORS.pillar, d.x, d.y, d.w, d.h);
      fill(g, COLORS.pillarLight, d.x, d.y, 2, d.h);
      fill(g, COLORS.pillarShadow, d.x + d.w - 3, d.y, 3, d.h);
      for (let y = d.y + 14; y < d.y + d.h; y += 14) fill(g, COLORS.pillarJoint, d.x, y, d.w, 1);
      return;
    case 'pillarTrim':
      fill(g, COLORS.pillarTrim, d.x, d.y, d.w, d.h);
      fill(g, COLORS.pillarShadow, d.x, d.y + d.h - 1, d.w, 1);
      return;
    case 'arch':
      fill(g, COLORS.arch, d.x, d.y, d.w, d.h);
      fill(g, COLORS.archEdge, d.x, d.y + d.h - 1, d.w, 1);
      return;
    case 'chain':
      for (let y = d.y; y < d.y + d.h; y += 3) {
        fill(g, COLORS.chainLink, d.x, y, d.w, 2);
        fill(g, COLORS.chainGap, d.x, y + 2, d.w, 1);
      }
      return;
    case 'rubble':
      fill(g, COLORS.rubble, d.x, d.y, d.w, d.h);
      fill(g, COLORS.rubbleTop, d.x, d.y, d.w, 1);
      return;
    case 'vault':
      fill(g, COLORS.vault, d.x, d.y, d.w, d.h);
      for (let x = d.x + 20; x < d.x + d.w; x += 40) fill(g, COLORS.vaultRib, x, d.y, 3, d.h);
      return;
    case 'breach':
      drawBreach(g, d);
      return;
    case 'banner':
      drawBanner(g, d);
      return;
    case 'brazier':
      drawBrazier(g, d);
      return;
  }
}

/**
 * Brèche dans le mur du fond : une ouverture aux bords déchiquetés sur le ciel nocturne,
 * avec la lune et quelques étoiles. Les bords suivent un tracé fixe, pour un rendu stable.
 */
function drawBreach(g: Phaser.GameObjects.Graphics, d: DecorDef): void {
  const rows = Math.floor(d.h / 4);
  for (let row = 0; row < rows; row++) {
    const y = d.y + row * 4;
    // Ouverture plus étroite en haut et en bas, bords irréguliers.
    const t = row / (rows - 1);
    const bulge = Math.sin(t * Math.PI);
    const jag = (hash2(row, d.x) - 0.5) * 10;
    const jagRight = (hash2(row + 31, d.y) - 0.5) * 10;
    const half = (d.w / 2) * (0.35 + 0.65 * bulge);
    const left = Math.round(d.x + d.w / 2 - half + jag);
    const right = Math.round(d.x + d.w / 2 + half + jagRight);
    if (right - left < 4) continue;
    fill(g, COLORS.breachRim, left - 3, y, right - left + 6, 4);
    fill(g, COLORS.breachRimLight, left - 3, y, 1, 4);
    fill(g, t > 0.65 ? COLORS.nightLow : COLORS.night, left, y, right - left, 4);
  }
  // Lune et étoiles.
  const mx = d.x + Math.round(d.w * 0.62);
  const my = d.y + Math.round(d.h * 0.3);
  fill(g, COLORS.moon, mx - 3, my - 5, 7, 11);
  fill(g, COLORS.moon, mx - 5, my - 3, 11, 7);
  fill(g, COLORS.moonShade, mx + 1, my - 2, 3, 3);
  fill(g, COLORS.moonShade, mx - 3, my + 2, 2, 2);
  for (const [sx, sy] of [
    [0.3, 0.2],
    [0.42, 0.55],
    [0.75, 0.62],
    [0.55, 0.12],
    [0.25, 0.7],
  ] as const) {
    fill(g, COLORS.star, d.x + Math.round(d.w * sx), d.y + Math.round(d.h * sy), 1, 1);
  }
}

/** Bannière de l'Ordre des Cendres : drap pourpre, flamme brodée, bas fendu en queue d'aronde. */
function drawBanner(g: Phaser.GameObjects.Graphics, d: DecorDef): void {
  const tail = 6;
  fill(g, COLORS.bannerRod, d.x - 2, d.y - 2, d.w + 4, 2);
  fill(g, COLORS.banner, d.x, d.y, d.w, d.h - tail);
  fill(g, COLORS.bannerShade, d.x, d.y, 1, d.h - tail);
  fill(g, COLORS.bannerShade, d.x + d.w - 2, d.y, 2, d.h - tail);
  const half = Math.floor(d.w / 2);
  for (let i = 0; i < tail; i++) {
    const notch = Math.floor((tail - i) * (half / tail));
    fill(g, COLORS.banner, d.x, d.y + d.h - tail + i, half - (half - notch), 1);
    fill(g, COLORS.banner, d.x + d.w - notch, d.y + d.h - tail + i, notch, 1);
  }
  // Emblème : une flamme, symbole de l'ordre. Aucun signe religieux.
  const left = d.x + half - 4;
  const top = d.y + 14;
  BANNER_FLAME.forEach((row, y) => {
    Array.from(row).forEach((cell, x) => {
      if (cell === '#') fill(g, COLORS.bannerEmblem, left + x, top + y, 1, 1);
      if (cell === 'o') fill(g, COLORS.bannerEmblemCore, left + x, top + y, 1, 1);
    });
  });
}

/** Flamme brodée des bannières, 8 × 13 px : contour d'os, cœur de braise. */
const BANNER_FLAME: readonly string[] = [
  '....#...',
  '...##...',
  '...##...',
  '..###...',
  '..####..',
  '.##o##..',
  '.#ooo##.',
  '##ooo##.',
  '##oooo##',
  '##oooo##',
  '.##oo##.',
  '..####..',
  '...##...',
];

/** Brasero au sol : coupe de fer, braises, pied et socle. La flamme est animée à part. */
function drawBrazier(g: Phaser.GameObjects.Graphics, d: DecorDef): void {
  fill(g, COLORS.embers, d.x + 2, d.y - 1, d.w - 4, 2);
  fill(g, COLORS.iron, d.x, d.y, d.w, 5);
  fill(g, COLORS.ironLight, d.x, d.y, d.w, 1);
  fill(g, COLORS.ironDark, d.x + 2, d.y + 5, d.w - 4, 1);
  const stand = Math.floor(d.w / 2) - 2;
  fill(g, COLORS.ironDark, d.x + stand, d.y + 6, 4, d.h - 10);
  fill(g, COLORS.iron, d.x + 2, d.y + d.h - 4, d.w - 4, 4);
  fill(g, COLORS.ironLight, d.x + 2, d.y + d.h - 4, d.w - 4, 1);
}

function drawSolid(g: Phaser.GameObjects.Graphics, s: SolidDef, room: RoomDef): void {
  if (s.kind === 'platform') {
    fill(g, COLORS.platform, s.x, s.y, s.w, s.h);
    fill(g, COLORS.platformTop, s.x, s.y, s.w, 2);
    fill(g, COLORS.platformShadow, s.x, s.y + s.h - 1, s.w, 1);
    return;
  }
  drawBricks(g, s, 12, 6, {
    base: COLORS.stone,
    mortar: COLORS.stoneMortar,
    accent: COLORS.stoneAccent,
  });
  // Arête claire sur les surfaces où l'on marche, rebord sur les dessous visibles.
  if (s.y > 20) fill(g, COLORS.stoneTop, s.x, s.y, s.w, 2);
  if (s.y + s.h < room.height - 20) fill(g, COLORS.stoneLip, s.x, s.y + s.h - 1, s.w, 1);
}
