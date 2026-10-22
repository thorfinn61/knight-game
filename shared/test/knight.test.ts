import { describe, expect, it } from 'vitest';
import { ATTACKS } from '../src/combat/attacks.ts';
import { DEATH_TOTAL_TICKS, DASH_TICKS, TURN_TICKS } from '../src/knight/frameData.ts';
import { isInvulnerable, killKnight } from '../src/knight/update.ts';
import { JUMP_SPEED, RUN_SPEED, ROLL_IFRAMES_FROM, ROLL_IFRAMES_TO } from '../src/knight/tuning.ts';
import { FLOOR_Y, knightOf, makeWorld, run, runUntil } from './helpers.ts';

describe('déplacement', () => {
  it('accélère jusqu’à la vitesse de course', () => {
    const w = makeWorld();
    run(w, { moveX: 1 }, 30);
    const k = knightOf(w);
    expect(k.action).toBe('run');
    expect(k.vx).toBe(RUN_SPEED);
    expect(k.x).toBeGreaterThan(130);
  });

  it('dérape avant de repartir dans l’autre sens en pleine course', () => {
    const w = makeWorld();
    run(w, { moveX: 1 }, 30);
    run(w, { moveX: -1 });
    const k = knightOf(w);
    expect(k.action).toBe('turn');
    expect(k.facing).toBe(1);
    run(w, { moveX: -1 }, TURN_TICKS);
    expect(k.facing).toBe(-1);
    expect(k.action).toBe('run');
  });
});

describe('saut', () => {
  function apexHeight(holdTicks: number): number {
    const w = makeWorld();
    run(w, { jumpPressed: true, jumpHeld: true });
    let minY = knightOf(w).y;
    for (let i = 0; i < 120 && !knightOf(w).grounded; i++) {
      run(w, { jumpHeld: i < holdTicks });
      minY = Math.min(minY, knightOf(w).y);
    }
    expect(knightOf(w).grounded).toBe(true);
    expect(knightOf(w).y).toBe(FLOOR_Y);
    return FLOOR_Y - minY;
  }

  it('monte puis retombe au sol', () => {
    expect(apexHeight(60)).toBeGreaterThan(55);
  });

  it('donne un saut plus court si la touche est relâchée tôt', () => {
    expect(apexHeight(2)).toBeLessThan(apexHeight(60) * 0.6);
  });

  it('autorise le saut juste après avoir quitté un bord', () => {
    const w = makeWorld();
    knightOf(w).x = 590;
    runUntil(w, (k) => !k.grounded, { moveX: 1 });
    run(w, { moveX: 1 }, 2);
    run(w, { jumpPressed: true, jumpHeld: true });
    expect(knightOf(w).action).toBe('jump');
    expect(knightOf(w).vy).toBeLessThan(-JUMP_SPEED * 0.9);
  });

  it('refuse le saut une fois le délai de grâce écoulé', () => {
    const w = makeWorld();
    knightOf(w).x = 590;
    runUntil(w, (k) => !k.grounded, { moveX: 1 });
    run(w, { moveX: 1 }, 10);
    run(w, { jumpPressed: true, jumpHeld: true });
    expect(knightOf(w).action).toBe('fall');
  });

  it('un saut ordinaire ne marque pas d’arrêt à l’atterrissage', () => {
    const w = makeWorld();
    run(w, { jumpPressed: true, jumpHeld: true, moveX: 1 });
    runUntil(w, (k) => k.grounded, { jumpHeld: true, moveX: 1 });
    expect(knightOf(w).action).toBe('run');
  });

  it('une grande chute marque un court arrêt à l’atterrissage', () => {
    const w = makeWorld();
    const k = knightOf(w);
    Object.assign(k, {
      y: FLOOR_Y - 140,
      airPeakY: FLOOR_Y - 140,
      grounded: false,
      action: 'fall',
    });
    runUntil(w, (knight) => knight.grounded, { moveX: 1 });
    expect(k.action).toBe('land');
    runUntil(w, (knight) => knight.action === 'run', { moveX: 1 }, 10);
  });

  it('mémorise un appui juste avant l’atterrissage', () => {
    const w = makeWorld();
    run(w, { jumpPressed: true, jumpHeld: true });
    runUntil(w, (k) => k.vy > 0 && k.y > FLOOR_Y - 12, { jumpHeld: false });
    run(w, { jumpPressed: true, jumpHeld: true });
    runUntil(w, (k) => k.action === 'jump', { jumpHeld: true }, 10);
  });
});

describe('combat', () => {
  it('dans le vide, l’attaque 1 ne s’enchaîne pas : il faut toucher pour le combo', () => {
    const w = makeWorld();
    run(w, { attackPressed: true });
    expect(knightOf(w).action).toBe('attack1');
    run(w, {}, 4);
    run(w, { attackPressed: true });
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      run(w);
      seen.add(knightOf(w).action);
    }
    expect(seen.has('attack2')).toBe(false);
  });

  it('un coup dans le vide engage jusqu’au bout : ni esquive ni saut pour l’annuler', () => {
    const w = makeWorld();
    run(w, { attackPressed: true });
    const total = ATTACKS.attack1.frameTicks.reduce((sum, ticks) => sum + ticks, 0);
    for (let t = 1; t < total; t++) {
      run(w, { dodgePressed: true, jumpPressed: true });
      expect(knightOf(w).action).toBe('attack1');
    }
    run(w, { dodgePressed: true });
    expect(knightOf(w).action).not.toBe('attack1');
  });

  it('revient au repos sans second appui', () => {
    const w = makeWorld();
    run(w, { attackPressed: true });
    runUntil(w, (k) => k.action === 'idle', {}, 40);
  });

  it('attaque accroupie quand la touche accroupi est maintenue', () => {
    const w = makeWorld();
    run(w, { crouch: true, attackPressed: true });
    expect(knightOf(w).action).toBe('crouchAttack');
  });

  it('attaque en l’air pendant un saut', () => {
    const w = makeWorld();
    run(w, { jumpPressed: true, jumpHeld: true });
    run(w, { jumpHeld: true }, 5);
    run(w, { jumpHeld: true, attackPressed: true });
    expect(knightOf(w).action).toBe('airAttack');
  });
});

describe('esquives', () => {
  it('la roulade rend invulnérable au milieu, pas à la fin', () => {
    const w = makeWorld();
    run(w, { dodgePressed: true });
    const k = knightOf(w);
    expect(k.action).toBe('roll');
    run(w, {}, ROLL_IFRAMES_FROM + 2);
    expect(isInvulnerable(k)).toBe(true);
    run(w, {}, ROLL_IFRAMES_TO);
    expect(k.action).toBe('roll');
    expect(isInvulnerable(k)).toBe(false);
  });

  it('la roulade couvre une bonne distance', () => {
    const w = makeWorld();
    run(w, { dodgePressed: true });
    runUntil(w, (k) => k.action !== 'roll');
    expect(knightOf(w).x).toBeGreaterThan(180);
  });

  it('un seul dash par passage en l’air', () => {
    const w = makeWorld();
    run(w, { jumpPressed: true, jumpHeld: true });
    run(w, { jumpHeld: true, dodgePressed: true });
    expect(knightOf(w).action).toBe('dash');
    run(w, { jumpHeld: true }, DASH_TICKS);
    expect(knightOf(w).action).toBe('fall');
    run(w, { dodgePressed: true });
    expect(knightOf(w).action).toBe('fall');
  });
});

describe('plafond bas', () => {
  it('reste accroupi sous le bloc puis se relève à la sortie', () => {
    const w = makeWorld();
    knightOf(w).x = 280;
    run(w, { crouch: true, moveX: 1 }, 10);
    runUntil(w, (k) => k.x > 330, { crouch: true, moveX: 1 });
    run(w, { moveX: 0 }, 10);
    expect(knightOf(w).action).toBe('crouch');
    runUntil(w, (k) => k.action === 'standUp', { moveX: 1 });
    expect(knightOf(w).x).toBeGreaterThan(366);
  });

  it('une glissade qui finit sous le bloc se termine accroupie', () => {
    const w = makeWorld();
    knightOf(w).x = 250;
    run(w, { crouch: true, dodgePressed: true });
    expect(knightOf(w).action).toBe('slide');
    runUntil(w, (k) => k.action !== 'slide');
    const k = knightOf(w);
    expect(k.action).toBe('crouch');
    expect(k.x).toBeGreaterThan(293);
    expect(k.x).toBeLessThan(367);
  });

  it('refuse le saut sous le bloc', () => {
    const w = makeWorld();
    knightOf(w).x = 280;
    runUntil(w, (k) => k.x > 320, { crouch: true, moveX: 1 });
    run(w, { jumpPressed: true, jumpHeld: true });
    expect(knightOf(w).grounded).toBe(true);
  });
});

describe('malédiction', () => {
  it('le chevalier se relève après sa mort, vie restaurée', () => {
    const w = makeWorld();
    const k = knightOf(w);
    killKnight(k);
    expect(k.hp).toBe(0);
    run(w, { moveX: 1, attackPressed: true }, DEATH_TOTAL_TICKS - 1);
    expect(k.action).toBe('dead');
    run(w, {}, 2);
    expect(k.action).toBe('idle');
    expect(k.hp).toBe(k.maxHp);
  });
});
