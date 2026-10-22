/** Orientation d'une entité : 1 vers la droite, -1 vers la gauche. */
export type Facing = 1 | -1;

/** Rectangle aligné sur les axes, défini par son coin haut-gauche (axe y vers le bas). */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Point {
  x: number;
  y: number;
}

/** Vrai si les deux rectangles se chevauchent. Des bords qui se touchent ne comptent pas. */
export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Zone commune à deux rectangles, ou null s'ils ne se chevauchent pas. */
export function intersection(a: Rect, b: Rect): Rect | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.w, b.x + b.w);
  const bottom = Math.min(a.y + a.h, b.y + b.h);
  if (right <= x || bottom <= y) return null;
  return { x, y, w: right - x, h: bottom - y };
}

/** Boîte d'une entité ancrée par le milieu de ses pieds. */
export function feetBox(x: number, y: number, w: number, h: number): Rect {
  return { x: x - w / 2, y: y - h, w, h };
}

/**
 * Place dans le monde une boîte décrite relativement aux pieds, pour une entité tournée vers la
 * droite. Tournée vers la gauche, la boîte est retournée en miroir autour des pieds.
 */
export function orientBox(local: Rect, x: number, y: number, facing: Facing): Rect {
  return {
    x: facing === 1 ? x + local.x : x - local.x - local.w,
    y: y + local.y,
    w: local.w,
    h: local.h,
  };
}
