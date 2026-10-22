import type { Axis, InputFrame } from '@cendres/shared';

type Action = 'left' | 'right' | 'jump' | 'crouch' | 'attack' | 'dodge' | 'parry' | 'blaze';

/**
 * Touches lues par position physique (`KeyboardEvent.code`) : KeyA est la touche Q d'un
 * clavier AZERTY et KeyW sa touche Z. Un joueur en QWERTY obtient donc WASD sans réglage.
 */
const BINDINGS: Readonly<Record<string, Action>> = {
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  KeyW: 'jump',
  Space: 'jump',
  ArrowUp: 'jump',
  KeyS: 'crouch',
  ArrowDown: 'crouch',
  KeyJ: 'attack',
  ShiftLeft: 'dodge',
  KeyK: 'dodge',
  KeyL: 'parry',
  // Embrasement : E sous la main gauche (déplacements), I au-dessus de J, K, L.
  KeyE: 'blaze',
  KeyI: 'blaze',
};

const MOUSE_ACTIONS: Readonly<Record<number, Action>> = { 0: 'attack', 2: 'parry' };

/** Convertit clavier et souris en `InputFrame`, une par tick de simulation. */
export class KeyboardMouseInput {
  private readonly held = new Set<Action>();
  /** Appuis pas encore consommés par un tick de simulation. */
  private readonly pressed = new Set<Action>();
  /** Dernière direction appuyée : elle l'emporte si gauche et droite sont maintenues. */
  private lastHorizontal: Axis = 0;

  private readonly canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('contextmenu', this.onContextMenu);
  }

  /** Lit l'état courant et consomme les appuis en attente. */
  sample(): InputFrame {
    const left = this.held.has('left');
    const right = this.held.has('right');
    let moveX: Axis = 0;
    if (left && right) moveX = this.lastHorizontal;
    else if (left) moveX = -1;
    else if (right) moveX = 1;

    const frame: InputFrame = {
      moveX,
      crouch: this.held.has('crouch'),
      jumpHeld: this.held.has('jump'),
      jumpPressed: this.pressed.has('jump'),
      attackHeld: this.held.has('attack'),
      attackPressed: this.pressed.has('attack'),
      dodgePressed: this.pressed.has('dodge'),
      parryPressed: this.pressed.has('parry'),
      blazePressed: this.pressed.has('blaze'),
      // L'annonce d'un coup ne vient pas du clavier : la session la calcule d'après l'écran.
      strike: false,
    };
    this.pressed.clear();
    return frame;
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
  }

  private press(action: Action): void {
    if (!this.held.has(action)) this.pressed.add(action);
    this.held.add(action);
    if (action === 'left') this.lastHorizontal = -1;
    if (action === 'right') this.lastHorizontal = 1;
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const action = BINDINGS[event.code];
    if (!action || isTyping(event)) return;
    event.preventDefault();
    if (!event.repeat) this.press(action);
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    const action = BINDINGS[event.code];
    if (!action) return;
    event.preventDefault();
    this.held.delete(action);
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    const action = MOUSE_ACTIONS[event.button];
    if (action) this.press(action);
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    const action = MOUSE_ACTIONS[event.button];
    if (action) this.held.delete(action);
  };

  private readonly onContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
  };

  /** Fenêtre quittée : on relâche tout, sinon une touche resterait bloquée. */
  private readonly onBlur = (): void => {
    this.held.clear();
    this.pressed.clear();
  };
}

/** Vrai si la touche part d'un champ de saisie : elle ne doit pas jouer. */
function isTyping(event: KeyboardEvent): boolean {
  const target = event.target;
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}
