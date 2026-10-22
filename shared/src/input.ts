export type Axis = -1 | 0 | 1;

/**
 * Intentions d'un joueur pour un tick, indépendantes du périphérique.
 * À l'étape 2, ce sont ces données que le client enverra au serveur.
 */
export interface InputFrame {
  /** Direction horizontale voulue. */
  moveX: Axis;
  /** Touche « s'accroupir » maintenue. */
  crouch: boolean;
  /** Touche de saut maintenue : relâcher tôt donne un saut plus court. */
  jumpHeld: boolean;
  /** Appui sur saut depuis le tick précédent. */
  jumpPressed: boolean;
  /** Appui sur attaque depuis le tick précédent. */
  attackPressed: boolean;
  /** Appui sur esquive depuis le tick précédent. */
  dodgePressed: boolean;
  /** Appui sur parade depuis le tick précédent. */
  parryPressed: boolean;
  /** Appui sur Embrasement depuis le tick précédent. */
  blazePressed: boolean;
  /**
   * Le joueur annonce que son coup touche l'adversaire ce tick, d'après ce qu'il voit à
   * l'écran. Le verdict voyage avec l'entrée : sa prédiction et le serveur restent d'accord,
   * et le serveur vérifie que le coup est plausible avant d'appliquer les dégâts.
   */
  strike: boolean;
}

export const NEUTRAL_INPUT: Readonly<InputFrame> = Object.freeze({
  moveX: 0,
  crouch: false,
  jumpHeld: false,
  jumpPressed: false,
  attackPressed: false,
  dodgePressed: false,
  parryPressed: false,
  blazePressed: false,
  strike: false,
});
