import { describe, expect, it } from 'vitest';
import { fits, moveAndCollide, touchesGround } from '../src/physics.ts';

const floor = { x: 0, y: 100, w: 200, h: 20 };
const wall = { x: 150, y: 0, w: 10, h: 100 };
const ceiling = { x: 0, y: 0, w: 200, h: 10 };

describe('moveAndCollide', () => {
  it('pose la boîte sur le sol', () => {
    const r = moveAndCollide(50, 95, 10, 20, 0, 10, [floor]);
    expect(r.y).toBe(100);
    expect(r.hitY).toBe(1);
  });

  it('bloque contre un mur', () => {
    const r = moveAndCollide(140, 100, 10, 20, 10, 0, [floor, wall]);
    expect(r.x).toBe(145);
    expect(r.hitX).toBe(1);
  });

  it('glisse sur le sol sans accrocher', () => {
    const r = moveAndCollide(50, 100, 10, 20, 5, 0, [floor]);
    expect(r.x).toBe(55);
    expect(r.hitX).toBe(0);
  });

  it('arrête la montée sous un plafond', () => {
    const r = moveAndCollide(50, 35, 10, 20, 0, -10, [ceiling]);
    expect(r.y).toBe(30);
    expect(r.hitY).toBe(-1);
  });
});

describe('fits et touchesGround', () => {
  it('refuse une boîte qui chevauche un solide', () => {
    expect(fits(50, 30, 10, 25, [ceiling])).toBe(false);
    expect(fits(50, 40, 10, 25, [ceiling])).toBe(true);
  });

  it('détecte le sol juste sous les pieds', () => {
    expect(touchesGround(50, 100, 10, [floor])).toBe(true);
    expect(touchesGround(50, 98, 10, [floor])).toBe(false);
  });
});
