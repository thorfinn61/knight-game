import * as Phaser from 'phaser';
import { ARENA, ATTACKS, clamp, type WorldEvent } from '@cendres/shared';
import { GAME_WIDTH } from '../config.ts';
import { DebugPanel } from '../debug/DebugPanel.ts';
import { AmbiancePipeline } from '../fx/AmbiancePipeline.ts';
import { HitEffects } from '../fx/HitEffects.ts';
import { LightRig } from '../fx/lights.ts';
import { KeyboardMouseInput } from '../input/KeyboardMouseInput.ts';
import type { DisplayedKnight, Session } from '../session/Session.ts';
import { DuelHud } from '../ui/DuelHud.ts';
import { HitText, type HitTextTone } from '../ui/HitText.ts';
import { Hud } from '../ui/Hud.ts';
import { Nameplates } from '../ui/Nameplates.ts';
import { DummyView } from '../view/DummyView.ts';
import { FlameView } from '../view/FlameView.ts';
import { KnightView } from '../view/KnightView.ts';
import { drawRoom } from '../view/RoomView.ts';
import type { DebugOverlayData } from './DebugOverlayScene.ts';

const CAMERA_FOLLOW_RATE = 6;
const HINT_DURATION_MS = 6000;
const BRAZIER_FLAME_SCALE = 1.8;
/** Hauteur du centre du corps au-dessus des pieds, pour placer les effets de l'Embrasement. */
const BODY_CENTER_HEIGHT = 18;
/** « Embrasement ! » part au-dessus du nom du chevalier, pas dessus. */
const BLAZE_TEXT_HEIGHT = 50;

export interface ArenaData {
  session: Session;
  /** Adresse à donner à un adversaire sur un autre PC, affichée pendant l'attente. */
  invite: string;
  /** Appelé pour revenir au menu, avec un message éventuel (connexion perdue…). */
  exit: (message?: string) => void;
}

/** L'arène : deux chevaliers (ou un chevalier et le mannequin), torches, braseros, obscurité. */
export class ArenaScene extends Phaser.Scene {
  private session!: Session;
  private invite = '';
  private exitToMenu!: (message?: string) => void;
  private controls!: KeyboardMouseInput;
  private knightViews = new Map<string, KnightView>();
  /** Tick d'Embrasement affiché de chaque chevalier (-1 hors Embrasement), pour ses effets. */
  private blazeTicks = new Map<string, number>();
  private dummyViews = new Map<string, DummyView>();
  private flames: FlameView[] = [];
  private effects!: HitEffects;
  private lightRig!: LightRig;
  private ambiance: AmbiancePipeline | null = null;
  private debugPanel!: DebugPanel;
  private nameplates!: Nameplates;
  private hud!: Hud;
  private duelHud!: DuelHud;
  private hitText!: HitText;
  private cameraX = 0;
  private exiting = false;

  constructor() {
    super('Arena');
  }

  init(data: ArenaData): void {
    this.session = data.session;
    this.invite = data.invite;
    this.exitToMenu = data.exit;
  }

  create(): void {
    // Phaser réutilise l'instance de la scène d'une partie à l'autre : tout repart de zéro.
    this.knightViews = new Map();
    this.blazeTicks = new Map();
    this.dummyViews = new Map();
    this.exiting = false;

    drawRoom(this, ARENA);
    this.flames = [
      ...ARENA.torches.map((p, i) => new FlameView(this, p, i, { scale: 1, bracket: true })),
      ...ARENA.braziers.map(
        (p, i) => new FlameView(this, p, i + 7, { scale: BRAZIER_FLAME_SCALE, bracket: false }),
      ),
    ];
    this.lightRig = new LightRig(ARENA);
    this.effects = new HitEffects(this);
    this.controls = new KeyboardMouseInput(this.game.canvas);
    this.debugPanel = new DebugPanel();
    this.debugPanel.setVisible(false);
    this.nameplates = new Nameplates();
    this.hud = new Hud();
    this.hud.show();
    this.duelHud = new DuelHud();
    this.hitText = new HitText();
    this.duelHud.show();
    this.cameraX = ARENA.width / 2;
    this.setupAmbiance();
    this.showHint();

    this.session.onEnded((message) => this.exit(message));
    window.addEventListener('keydown', this.onKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());

    if (import.meta.env.DEV) {
      // Accès pour les tests automatiques et la console du navigateur, en développement seulement.
      (window as unknown as Record<string, unknown>)['__cendres'] = {
        session: this.session,
        scene: this,
        ready: true,
      };
    }
  }

  override update(time: number, delta: number): void {
    if (this.exiting) return;
    this.session.update(time, delta, () => this.controls.sample());
    const camera = this.cameras.main;
    for (const event of this.session.drainEvents()) this.playEvent(event);

    const knights = this.session.knights();
    this.syncKnightViews(knights, delta);
    for (const d of this.session.dummies()) {
      let view = this.dummyViews.get(d.id);
      if (!view) {
        view = new DummyView(this, d);
        this.dummyViews.set(d.id, view);
      }
      view.update(d, delta);
    }
    for (const flame of this.flames) flame.update(time);

    this.updateCamera(knights, delta);
    this.ambiance?.setLights(
      this.lightRig.sources(knights, time, delta),
      camera.scrollX,
      camera.scrollY,
    );
    this.nameplates.update(knights, camera.scrollX, camera.scrollY, this.game.canvas);
    const status = this.session.status();
    this.hud.update(status);
    if (status.duel) this.duelHud.update(status.duel, time, delta, this.waitingText(status.code));
    else if (status.self) this.duelHud.updateTraining(status.self, delta);
    this.debugPanel.update(time, this.session, this.game.loop.actualFps);
  }

  /** Effets d'un coup, d'une parade ou d'un choc des lames. */
  private playEvent(event: WorldEvent): void {
    this.effects.play(event);
    switch (event.type) {
      case 'hit':
        this.dummyViews.get(event.targetId)?.onHit(event);
        this.knightViews.get(event.targetId)?.flash(event.heavy || event.counter);
        if (event.counter) this.say('Contre !', 'ember', event);
        return;
      case 'parry':
        this.knightViews.get(event.attackerId)?.flash(true);
        this.say('Parade !', 'steel', event);
        return;
      case 'clash':
        this.say('Choc !', 'ash', event);
        return;
    }
  }

  private say(text: string, tone: HitTextTone, at: { x: number; y: number }): void {
    const camera = this.cameras.main;
    this.hitText.spawn(
      text,
      tone,
      at.x,
      at.y - 22,
      camera.scrollX,
      camera.scrollY,
      this.game.canvas,
    );
  }

  private waitingText(code: string | null): string {
    const parts = [
      code ? `Code du duel : ${code}` : '',
      this.invite ? `Depuis un autre PC : ${this.invite}` : '',
    ];
    return parts.filter(Boolean).join('   ·   ');
  }

  /** Une vue par chevalier présent : création à l'arrivée, destruction au départ. */
  private syncKnightViews(knights: readonly DisplayedKnight[], deltaMs: number): void {
    const present = new Set<string>();
    for (const knight of knights) {
      present.add(knight.id);
      let view = this.knightViews.get(knight.id);
      if (!view) {
        view = new KnightView(this, knight.skin);
        this.knightViews.set(knight.id, view);
      }
      view.render(knight.state, deltaMs);
      this.watchBlaze(knight);
    }
    for (const [id, view] of this.knightViews) {
      if (present.has(id)) continue;
      view.destroy();
      this.knightViews.delete(id);
      this.blazeTicks.delete(id);
    }
  }

  /**
   * Effets de l'Embrasement, déclenchés d'après l'état affiché : chez l'adversaire, ils
   * tombent ainsi pile avec son animation, retard d'affichage compris.
   */
  private watchBlaze(knight: DisplayedKnight): void {
    const { action, actionTick, x, y } = knight.state;
    const previous = this.blazeTicks.get(knight.id) ?? -1;
    const tick = action === 'blaze' ? actionTick : -1;
    this.blazeTicks.set(knight.id, tick);
    if (tick < 0) return;
    const center = y - BODY_CENTER_HEIGHT;
    if (previous < 0 || tick < previous) {
      this.effects.blazeStart(x, center);
      this.say('Embrasement !', 'ember', { x, y: y - BLAZE_TEXT_HEIGHT });
    }
    const [startup = 0] = ATTACKS.blaze.frameTicks;
    if (previous < startup && tick >= startup) this.effects.blazeWave(x, center);
  }

  private setupAmbiance(): void {
    const renderer = this.renderer;
    if (!(renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer)) {
      console.warn('WebGL indisponible : l’arène est affichée sans éclairage.');
      return;
    }
    renderer.pipelines.addPostPipeline(AmbiancePipeline.KEY, AmbiancePipeline);
    const camera = this.cameras.main;
    camera.setPostPipeline(AmbiancePipeline);
    const pipeline = camera.getPostPipeline(AmbiancePipeline);
    this.ambiance = pipeline instanceof AmbiancePipeline ? pipeline : null;
  }

  /** La caméra cadre les combattants ; l'arène tenant sur un écran, elle reste fixe. */
  private updateCamera(knights: readonly DisplayedKnight[], deltaMs: number): void {
    if (knights.length === 0) return;
    const center = knights.reduce((sum, k) => sum + k.state.x, 0) / knights.length;
    const blend = 1 - Math.exp(-(deltaMs / 1000) * CAMERA_FOLLOW_RATE);
    this.cameraX += (center - this.cameraX) * blend;
    const maxScroll = Math.max(0, ARENA.width - GAME_WIDTH);
    this.cameras.main.setScroll(clamp(Math.round(this.cameraX - GAME_WIDTH / 2), 0, maxScroll), 0);
  }

  private toggleDebug(): void {
    const visible = this.debugPanel.toggle();
    if (visible) {
      const data: DebugOverlayData = { session: this.session, camera: this.cameras.main };
      this.scene.launch('DebugOverlay', data);
    } else {
      this.scene.stop('DebugOverlay');
    }
    this.hideHint();
  }

  private showHint(): void {
    const hint = document.getElementById('hint');
    if (!hint) return;
    hint.hidden = false;
    hint.style.opacity = '1';
    this.time.delayedCall(HINT_DURATION_MS, () => this.hideHint());
  }

  private hideHint(): void {
    const hint = document.getElementById('hint');
    if (hint) hint.style.opacity = '0';
  }

  /** Retour au menu, à la demande du joueur ou parce que la session s'est terminée. */
  private exit(message?: string): void {
    if (this.exiting) return;
    this.exiting = true;
    this.exitToMenu(message);
  }

  private cleanup(): void {
    window.removeEventListener('keydown', this.onKey);
    this.controls.destroy();
    this.session.destroy();
    this.nameplates.clear();
    this.hitText.clear();
    this.hud.hide();
    this.duelHud.hide();
    this.debugPanel.setVisible(false);
    this.scene.stop('DebugOverlay');
    const hint = document.getElementById('hint');
    if (hint) hint.hidden = true;
    if (import.meta.env.DEV) delete (window as unknown as Record<string, unknown>)['__cendres'];
  }

  /** F1 (ou ²) : mode debug ; H, M et C y testent coup reçu, mort et jauge pleine ; Échap : menu. */
  private readonly onKey = (event: KeyboardEvent): void => {
    if (event.code === 'Escape') {
      event.preventDefault();
      this.exit();
      return;
    }
    if (event.code === 'F1' || event.code === 'Backquote') {
      event.preventDefault();
      if (!event.repeat) this.toggleDebug();
      return;
    }
    const actions = this.session.debugActions;
    if (!this.debugPanel.isVisible || event.repeat || !actions) return;
    const key = event.key.toLowerCase();
    if (key === 'h') actions.hurt();
    if (key === 'm') actions.kill();
    if (key === 'c') actions.fillAsh();
  };
}
