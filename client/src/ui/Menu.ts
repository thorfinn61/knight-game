import {
  NAME_MAX_LENGTH,
  ROOM_CODE_LENGTH,
  normalizeRoomCode,
  sanitizeName,
} from '@cendres/shared';
import { fetchServerInfo, shareUrl } from '../net/connection.ts';
import { readStored, requireElement, writeStored } from './dom.ts';

const NAME_KEY = 'cendres:name';

export interface MenuActions {
  quickMatch(name: string): Promise<void>;
  createPrivate(name: string): Promise<void>;
  join(code: string, name: string): Promise<void>;
  training(name: string): Promise<void>;
}

/**
 * Écran d'accueil : choix du nom, puis combat rapide, duel privé, rejoindre par code ou
 * entraînement. Il indique aussi l'adresse à donner à un joueur sur un autre PC.
 */
export class Menu {
  private readonly root = requireElement('menu');
  private readonly nameInput = requireElement<HTMLInputElement>('menu-name');
  private readonly codeInput = requireElement<HTMLInputElement>('menu-code');
  private readonly statusLine = requireElement('menu-status');
  private readonly shareLine = requireElement('menu-share');
  private readonly buttons: HTMLButtonElement[];
  private readonly actions: MenuActions;
  /** Adresse que d'autres PC peuvent ouvrir pour jouer, connue après réponse du serveur. */
  private invite = '';

  constructor(actions: MenuActions) {
    this.actions = actions;
    this.nameInput.maxLength = NAME_MAX_LENGTH;
    this.codeInput.maxLength = ROOM_CODE_LENGTH;
    this.nameInput.value = readStored(NAME_KEY) ?? '';
    // Un lien d'invitation peut porter le code : ?code=ABCD
    this.codeInput.value = normalizeRoomCode(
      new URLSearchParams(location.search).get('code') ?? '',
    );

    const quick = requireElement<HTMLButtonElement>('menu-quick');
    const create = requireElement<HTMLButtonElement>('menu-create');
    const join = requireElement<HTMLButtonElement>('menu-join');
    const training = requireElement<HTMLButtonElement>('menu-training');
    this.buttons = [quick, create, join, training];

    quick.addEventListener('click', () => void this.run((name) => this.actions.quickMatch(name)));
    create.addEventListener(
      'click',
      () => void this.run((name) => this.actions.createPrivate(name)),
    );
    training.addEventListener('click', () => void this.run((name) => this.actions.training(name)));
    join.addEventListener('click', () => this.joinWithCode());
    this.codeInput.addEventListener('input', () => {
      this.codeInput.value = normalizeRoomCode(this.codeInput.value);
    });
    this.codeInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') this.joinWithCode();
    });
    void this.checkServer();
  }

  /** Adresse à partager, pour l'afficher aussi en jeu pendant l'attente. */
  get shareAddress(): string {
    return this.invite;
  }

  show(message = ''): void {
    this.root.hidden = false;
    this.setBusy(false);
    this.statusLine.textContent = message;
    this.statusLine.classList.toggle('error', message.length > 0);
  }

  hide(): void {
    this.root.hidden = true;
  }

  /** Vérifie que le serveur répond et récupère son adresse sur le réseau local. */
  private async checkServer(): Promise<void> {
    const info = await fetchServerInfo();
    if (!info) {
      this.shareLine.textContent =
        'Serveur de jeu injoignable : seul l’entraînement est disponible.';
      this.shareLine.classList.add('error');
      return;
    }
    const host = info.hosts[0];
    this.invite = host ? shareUrl(host) : '';
    this.shareLine.classList.remove('error');
    this.shareLine.textContent = this.invite ? `Depuis un autre PC : ${this.invite}` : '';
  }

  private joinWithCode(): void {
    const code = normalizeRoomCode(this.codeInput.value);
    if (code.length !== ROOM_CODE_LENGTH) {
      this.error(`Le code fait ${ROOM_CODE_LENGTH} lettres.`);
      this.codeInput.focus();
      return;
    }
    void this.run((name) => this.actions.join(code, name));
  }

  /** Lance une action avec le nom nettoyé ; affiche l'erreur éventuelle sans quitter le menu. */
  private async run(action: (name: string) => Promise<void>): Promise<void> {
    const name = sanitizeName(this.nameInput.value);
    this.nameInput.value = name;
    writeStored(NAME_KEY, name);
    this.setBusy(true);
    this.statusLine.classList.remove('error');
    this.statusLine.textContent = 'Connexion…';
    try {
      await action(name);
    } catch (error) {
      this.error(error instanceof Error ? error.message : String(error));
    } finally {
      this.setBusy(false);
    }
  }

  private error(message: string): void {
    this.statusLine.textContent = message;
    this.statusLine.classList.add('error');
  }

  private setBusy(busy: boolean): void {
    for (const button of this.buttons) button.disabled = busy;
  }
}
