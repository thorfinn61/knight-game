import { describe, expect, it } from 'vitest';
import { ATTACKS } from '../src/combat/attacks.ts';
import { activeHitbox } from '../src/combat/hits.ts';
import { COUNTER_DAMAGE_MULTIPLIER, PARRY_GRACE_TICKS } from '../src/duel.ts';
import { FEINT_TICKS, PARRY_ACTIVE_TICKS } from '../src/knight/frameData.ts';
import { createKnight } from '../src/knight/state.ts';
import { isCounterable } from '../src/knight/update.ts';
import { ARENA } from '../src/rooms/arena.ts';
import { staticLevel, stepKnight } from '../src/world.ts';
import { arena, input, makeWorld, run } from './helpers.ts';

const FLOOR = ARENA.spawns[0]!.y;
const level = { ...staticLevel(ARENA), targets: [] };

describe('feinte d’attaque', () => {
  it('annule l’attaque 1 pendant son armé et entre en feinte pour 6 ticks', () => {
    const k = createKnight('a', { x: 200, y: FLOOR });
    stepKnight(k, input({ attackPressed: true }), level);
    expect(k.action).toBe('attack1');

    // On avance de quelques ticks pendant l'armé
    stepKnight(k, input(), level);
    stepKnight(k, input(), level);
    expect(k.action).toBe('attack1');

    // Appui sur parade pendant l'armé : déclenche la feinte
    stepKnight(k, input({ parryPressed: true }), level);
    expect(k.action).toBe('feint');

    // La feinte dure FEINT_TICKS (6 ticks)
    for (let t = 1; t < FEINT_TICKS; t++) {
      stepKnight(k, input(), level);
      expect(k.action).toBe('feint');
    }

    // Après FEINT_TICKS, le chevalier revient au repos
    stepKnight(k, input(), level);
    expect(k.action).toBe('idle');
  });

  it('ne peut pas être feintée une fois que les frames actives ont commencé', () => {
    const k = createKnight('a', { x: 200, y: FLOOR });
    stepKnight(k, input({ attackPressed: true }), level);
    while (!activeHitbox(k)) stepKnight(k, input(), level);

    // En frame active, appuyer sur parade ne feinte pas
    stepKnight(k, input({ parryPressed: true }), level);
    expect(k.action).toBe('attack1');
  });

  it('le chevalier est considéré en contre pendant sa feinte', () => {
    const k = createKnight('a', { x: 200, y: FLOOR });
    stepKnight(k, input({ attackPressed: true }), level);
    stepKnight(k, input({ parryPressed: true }), level);
    expect(k.action).toBe('feint');
    expect(isCounterable(k)).toBe(true);
  });

  it('feinter pour baiter une parade adverse permet de punir sa récupération', () => {
    const { a, b, events, step } = arena();

    // Le joueur A attaque
    step({ attackPressed: true });
    // Le joueur B tente de parer au réflexe
    step({}, { parryPressed: true });
    expect(b.action).toBe('parry');

    // Le joueur A feinte son attaque dès le tick suivant
    step({ parryPressed: true });
    expect(a.action).toBe('feint');

    // On laisse s'écouler la feinte de A (6 ticks)
    for (let t = 0; t < FEINT_TICKS; t++) step();
    expect(a.action).toBe('idle');

    // B est maintenant en pleine récupération de garde (vulnérable au contre)
    while (b.actionTick < PARRY_ACTIVE_TICKS + 2) step();
    expect(b.action).toBe('parry');
    expect(isCounterable(b)).toBe(true);

    // A lance une attaque 1 qui punit B en plein contre !
    step({ attackPressed: true });
    while (!activeHitbox(a)) step({ strike: true });
    step({ strike: true });

    const hit = events.find((e) => e.type === 'hit');
    expect(hit).toBeDefined();
    if (hit && hit.type === 'hit') {
      expect(hit.counter).toBe(true);
      expect(hit.damage).toBe(ATTACKS.attack1.damage * COUNTER_DAMAGE_MULTIPLIER);
    }
  });
});

describe('coup chargé', () => {
  it('maintient l’armé tant que l’attaque est enfoncée, jusqu’à maxChargeTicks', () => {
    const w = makeWorld();
    const k = w.knights[0]!;
    run(w, { attackPressed: true, attackHeld: true });
    expect(k.action).toBe('attack1');

    // Avance jusqu'au dernier tick d'armé normal (tick 8)
    for (let t = 1; t < 8; t++) {
      run(w, { attackHeld: true });
      expect(k.action).toBe('attack1');
      expect(k.charge).toBe(0);
    }

    // Tick 8 : la charge commence à s'accumuler
    run(w, { attackHeld: true });
    expect(k.charge).toBe(1);

    // Maintient la charge pendant 10 ticks supplémentaires
    for (let i = 0; i < 10; i++) {
      run(w, { attackHeld: true });
      expect(k.action).toBe('attack1');
      expect(activeHitbox(k)).toBeNull(); // Pas encore de hitbox active !
    }
    expect(k.charge).toBe(11);

    // Relâche l'attaque : le coup avance et sort la frame active
    run(w, { attackHeld: false });
    run(w, {});
    expect(activeHitbox(k)).not.toBeNull();
  });

  it('relâcher avant pleine charge décale le coup avec des dégâts normaux', () => {
    const { a, b, events, step } = arena(40);

    // Lance l'attaque et charge pendant 5 ticks (inférieur à fullChargeTicks = 12)
    step({ attackPressed: true, attackHeld: true });
    for (let t = 1; t < 8; t++) step({ attackHeld: true });
    for (let c = 0; c < 5; c++) step({ attackHeld: true });
    expect(a.charge).toBe(5);

    // Relâche : le coup frappe
    while (!activeHitbox(a)) step({ attackHeld: false, strike: true });
    for (let t = 0; t < PARRY_GRACE_TICKS + 2; t++) step({ strike: true });

    const hit = events.find((e) => e.type === 'hit');
    expect(hit).toBeDefined();
    if (hit && hit.type === 'hit') {
      expect(hit.damage).toBe(ATTACKS.attack1.damage); // 10 dégâts normaux
      expect(hit.heavy).toBe(false);
    }
  });

  it('une pleine charge inflige des dégâts bonus et possède la propriété coup lourd', () => {
    const { a, b, events, step } = arena(40);

    // Charge complète (>= 12 ticks de charge)
    step({ attackPressed: true, attackHeld: true });
    for (let t = 1; t < 8; t++) step({ attackHeld: true });
    for (let c = 0; c < 12; c++) step({ attackHeld: true });
    expect(a.charge).toBe(12);

    // Relâche l'attaque pour frapper
    while (!activeHitbox(a)) step({ attackHeld: false, strike: true });
    for (let t = 0; t < PARRY_GRACE_TICKS + 2; t++) step({ strike: true });

    const hit = events.find((e) => e.type === 'hit');
    expect(hit).toBeDefined();
    if (hit && hit.type === 'hit') {
      const expectedDamage =
        ATTACKS.attack1.damage + (ATTACKS.attack1.chargeable?.bonusDamage ?? 4);
      expect(hit.damage).toBe(expectedDamage); // 14 dégâts
      expect(hit.heavy).toBe(true);
      expect(b.hp).toBe(b.maxHp - expectedDamage);
      expect(b.hitstop).toBeGreaterThan(0);
    }
  });

  it('un coup pleinement chargé en contre inflige 21 dégâts', () => {
    const { a, b, events, step } = arena(40);

    // B attaque dans le vide et se retrouve en récupération
    step({}, { attackPressed: true });

    // A charge son coup pendant l'attaque de B
    step({ attackPressed: true, attackHeld: true });
    for (let t = 1; t < 8; t++) step({ attackHeld: true });
    for (let c = 0; c < 12; c++) step({ attackHeld: true });
    expect(a.charge).toBe(12);

    // Frappe pendant que B est encore dans sa récupération
    step({ attackHeld: false, strike: true });
    while (!activeHitbox(a)) step({ strike: true });
    step({ strike: true });

    const hit = events.find((e) => e.type === 'hit');
    expect(hit).toBeDefined();
    if (hit && hit.type === 'hit') {
      expect(hit.counter).toBe(true);
      expect(hit.damage).toBe(21); // (10 + 4) * 1.5 = 21
    }
  });

  it('peut être feinté en cours de charge avec la touche parade', () => {
    const w = makeWorld();
    const k = w.knights[0]!;

    // Début d'attaque et charge
    run(w, { attackPressed: true, attackHeld: true });
    for (let t = 1; t < 8; t++) run(w, { attackHeld: true });
    for (let c = 0; c < 6; c++) run(w, { attackHeld: true });
    expect(k.charge).toBe(6);

    // Appui sur parade pendant la charge : annulation en feinte !
    run(w, { parryPressed: true });
    expect(k.action).toBe('feint');
    expect(k.charge).toBe(0);
  });
});
