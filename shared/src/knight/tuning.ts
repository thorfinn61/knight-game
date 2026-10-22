/**
 * Réglages du chevalier. Distances en pixels, vitesses en px/s, accélérations en px/s²,
 * durées en ticks (1/60 s).
 */

// Boîte de collision, qui sert aussi de zone vulnérable.
export const KNIGHT_WIDTH = 14;
export const KNIGHT_STAND_HEIGHT = 36;
export const KNIGHT_CROUCH_HEIGHT = 24;
export const KNIGHT_SLIDE_HEIGHT = 16;
export const KNIGHT_MAX_HP = 100;

// Déplacement au sol.
export const RUN_SPEED = 125;
export const GROUND_ACCEL = 1500;
export const GROUND_DECEL = 1900;
export const CROUCH_WALK_SPEED = 45;
/** Sous cette vitesse, le chevalier se retourne instantanément au lieu de déraper. */
export const TURN_MIN_SPEED = 80;

// Saut et chute.
export const GRAVITY = 1300;
export const FALL_GRAVITY_MULTIPLIER = 1.3;
export const MAX_FALL_SPEED = 430;
export const JUMP_SPEED = 400;
/** Relâcher le saut pendant la montée multiplie la vitesse verticale par ce facteur. */
export const JUMP_CUT_MULTIPLIER = 0.45;
/** Vitesse verticale à partir de laquelle on considère le sommet du saut atteint. */
export const APEX_SPEED = -40;
export const AIR_ACCEL = 1000;
export const AIR_DECEL = 450;
/** Contrôle horizontal réduit pendant une attaque aérienne. */
export const AIR_ATTACK_CONTROL = 0.5;
/** Au-delà de cette hauteur de chute, l'atterrissage marque un court temps d'arrêt. */
export const HARD_LANDING_HEIGHT = 100;

// Tolérances d'entrée.
/** Le saut reste possible quelques ticks après avoir quitté un bord. */
export const COYOTE_TICKS = 6;
export const JUMP_BUFFER_TICKS = 6;
export const ATTACK_BUFFER_TICKS = 8;
export const DODGE_BUFFER_TICKS = 8;
export const PARRY_BUFFER_TICKS = 6;
export const BLAZE_BUFFER_TICKS = 6;

// Attaques.
export const ATTACK_DECEL = 1400;

// Roulade.
export const ROLL_SPEED = 175;
/** Ticks à pleine vitesse avant le ralentissement de fin de roulade. */
export const ROLL_FAST_TICKS = 26;
export const ROLL_IFRAMES_FROM = 2;
/** Fin de l'invulnérabilité : la sortie de roulade est punissable, rouler sans cesse ne protège pas. */
export const ROLL_IFRAMES_TO = 20;
/** À partir de ce tick, la fin de roulade peut être annulée par une autre action. */
export const ROLL_CANCEL_TICK = 34;

// Embrasement.
/** Invulnérable pendant l'armé et l'onde : on ne l'interrompt pas, on l'esquive ou on recule. */
export const BLAZE_IFRAMES_TO = 20;

// Dash aérien, un seul par passage en l'air.
export const DASH_SPEED = 260;

// Glissade.
export const SLIDE_SPEED_START = 230;
export const SLIDE_SPEED_END = 60;
export const SLIDE_JUMP_FROM_TICK = 6;

// Réactions aux coups reçus. Le coup lourd qui clôt un combo repousse hors de portée :
// la riposte réflexe de la victime tombe dans le vide, réussir son combo ne se paie pas.
export const KNOCKBACK_LIGHT = 110;
export const KNOCKBACK_HEAVY = 330;
/** Vitesse à laquelle le chevalier est repoussé hors d'un mannequin. */
export const PUSH_OUT_SPEED = 180;
