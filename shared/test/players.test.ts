import { describe, expect, it } from 'vitest';
import {
  DEFAULT_NAME,
  NAME_MAX_LENGTH,
  ROOM_CODE_LENGTH,
  generateRoomCode,
  normalizeRoomCode,
  pickSkin,
  sanitizeName,
} from '../src/players.ts';

describe('noms des joueurs', () => {
  it('garde les lettres accentuées, les chiffres et la ponctuation simple', () => {
    expect(sanitizeName('  Aldéric  le_Gris2  ')).toBe('Aldéric le_Gris2');
    expect(sanitizeName("Brune d'Ys")).toBe("Brune d'Ys");
  });

  it('retire les caractères spéciaux et les balises', () => {
    expect(sanitizeName('<b>Ser</b> 💀 Kay!')).toBe('bSerb Kay');
  });

  it('coupe au-delà de la longueur maximale', () => {
    expect(sanitizeName('A'.repeat(40))).toHaveLength(NAME_MAX_LENGTH);
  });

  it('remplace un nom vide ou invalide par le nom par défaut', () => {
    expect(sanitizeName('   ')).toBe(DEFAULT_NAME);
    expect(sanitizeName('🔥🔥')).toBe(DEFAULT_NAME);
    expect(sanitizeName(undefined)).toBe(DEFAULT_NAME);
    expect(sanitizeName(42)).toBe(DEFAULT_NAME);
  });
});

describe('apparences', () => {
  it('donne la plus petite apparence libre', () => {
    expect(pickSkin([])).toBe(0);
    expect(pickSkin([0, 2])).toBe(1);
    expect(pickSkin([1, 0, 2])).toBe(3);
  });
});

describe('codes de salon', () => {
  it('normalise la saisie', () => {
    expect(normalizeRoomCode(' kx-7 qp ')).toBe('KXQP');
    expect(normalizeRoomCode('oiab')).toBe('AB');
  });

  it('génère des codes de la bonne longueur, sans lettres ambiguës', () => {
    let seed = 7;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < 200; i++) {
      const code = generateRoomCode(random);
      expect(code).toHaveLength(ROOM_CODE_LENGTH);
      expect(code).not.toMatch(/[IO0-9]/);
      expect(normalizeRoomCode(code)).toBe(code);
    }
  });
});
