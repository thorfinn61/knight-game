import { feetBox, overlaps, type Rect } from './geometry.ts';

export interface MoveResult {
  x: number;
  y: number;
  /** Côté du blocage horizontal : -1 à gauche, 1 à droite, 0 aucun. */
  hitX: -1 | 0 | 1;
  /** 1 si la boîte s'est posée sur un sol, -1 si elle a heurté un plafond, 0 sinon. */
  hitY: -1 | 0 | 1;
}

/**
 * Déplace une boîte ancrée aux pieds contre des rectangles statiques.
 * Les axes sont traités l'un après l'autre (x puis y) : la boîte glisse le long des surfaces.
 * Les déplacements par tick restent petits devant l'épaisseur des murs, il n'y a donc pas
 * d'effet tunnel.
 */
export function moveAndCollide(
  x: number,
  y: number,
  w: number,
  h: number,
  dx: number,
  dy: number,
  solids: readonly Rect[],
): MoveResult {
  let hitX: MoveResult['hitX'] = 0;
  let hitY: MoveResult['hitY'] = 0;

  if (dx !== 0) {
    x += dx;
    for (const solid of solids) {
      if (!overlaps(feetBox(x, y, w, h), solid)) continue;
      if (dx > 0) {
        x = solid.x - w / 2;
        hitX = 1;
      } else {
        x = solid.x + solid.w + w / 2;
        hitX = -1;
      }
    }
  }

  if (dy !== 0) {
    y += dy;
    for (const solid of solids) {
      if (!overlaps(feetBox(x, y, w, h), solid)) continue;
      if (dy > 0) {
        y = solid.y;
        hitY = 1;
      } else {
        y = solid.y + solid.h + h;
        hitY = -1;
      }
    }
  }

  return { x, y, hitX, hitY };
}

/** Vrai si une boîte ancrée aux pieds tient à cette position sans toucher aucun solide. */
export function fits(x: number, y: number, w: number, h: number, solids: readonly Rect[]): boolean {
  const box = feetBox(x, y, w, h);
  return solids.every((solid) => !overlaps(box, solid));
}

/** Vrai si un solide se trouve juste sous les pieds, même sans mouvement vertical ce tick. */
export function touchesGround(x: number, y: number, w: number, solids: readonly Rect[]): boolean {
  const probe = { x: x - w / 2, y, w, h: 1 };
  return solids.some((solid) => overlaps(probe, solid));
}
