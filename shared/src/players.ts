/** Règles autour des joueurs d'un groupe : noms, apparences, codes de salon. */

export const MAX_PLAYERS = 4;
export const NAME_MAX_LENGTH = 16;
export const DEFAULT_NAME = 'Chevalier';

/** Nombre d'apparences distinctes : deux armures du pack, puis deux teintes provisoires. */
export const SKIN_COUNT = 4;

/** Lettres des codes de salon, sans I ni O pour éviter la confusion avec 1 et 0. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export const ROOM_CODE_LENGTH = 4;

/**
 * Nom affiché au-dessus de la tête : lettres (accents compris), chiffres, espaces, tirets,
 * apostrophes et soulignés, espaces regroupés, au plus 16 caractères. Vide : « Chevalier ».
 */
export function sanitizeName(raw: unknown): string {
  if (typeof raw !== 'string') return DEFAULT_NAME;
  const cleaned = raw
    .normalize('NFC')
    .replace(/[^\p{L}\p{N} '_-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  const name = Array.from(cleaned).slice(0, NAME_MAX_LENGTH).join('').trim();
  return name.length > 0 ? name : DEFAULT_NAME;
}

/** Plus petite apparence libre, pour qu'un nouveau venu ne ressemble à personne. */
export function pickSkin(taken: Iterable<number>): number {
  const used = new Set(taken);
  for (let skin = 0; skin < SKIN_COUNT; skin++) {
    if (!used.has(skin)) return skin;
  }
  return 0;
}

/** Code saisi par un joueur, ramené à sa forme canonique : majuscules, lettres valides seulement. */
export function normalizeRoomCode(raw: string): string {
  return raw
    .toUpperCase()
    .split('')
    .filter((c) => ROOM_CODE_ALPHABET.includes(c))
    .join('')
    .slice(0, ROOM_CODE_LENGTH);
}

/** Code de salon aléatoire. Le tirage est injecté pour garder la fonction testable. */
export function generateRoomCode(random: () => number): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET.charAt(Math.floor(random() * ROOM_CODE_ALPHABET.length));
  }
  return code;
}
