import * as Phaser from "phaser";
import type { Room } from "colyseus.js";
import type { PlaygroundState } from "../../@types/player";
import { createNameLabel, positionLabel, type NameLabel } from "@/modules/shared/config/phaser-js/scenes/helpers/labels";
import {
  ChatBubble,
  createChatBubble,
  destroyChatBubble,
  positionChatBubble,
  updateChatBubble,
} from "@/modules/shared/config/phaser-js/scenes/helpers/chat-bubble";
import { CHAT_HIDE_DELAY_MS, sanitizeChatMessage } from "@/modules/shared/config/phaser-js/chat-config";
import { useRoomUiStore } from "../../stores/room-ui-store";
import { FALLBACK_SKIN, loadSkin, skinAnimKey, skinTextureKey, usableSkin } from "../../lib/skin-assets";

type CoerceFn = (x: number | undefined, y: number | undefined) => Phaser.Math.Vector2;
type RemoteIdentity = { id?: string | number | null };

function formatPlayerLabel(name?: string, isAdmin?: boolean) {
  const safeName = (name ?? "Player").toString();
  return `${safeName}${isAdmin ? " ★" : ""}`;
}

export class RemoteManager {
  private static readonly HOVER_OUTLINE_OFFSETS = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
    [-2, 0],
    [2, 0],
    [0, -2],
    [0, 2],
  ] as const;
  private sprites = new Map<string, Phaser.GameObjects.Sprite>();
  private labels = new Map<string, NameLabel>();
  private listeners = new Map<string, { cleanup?: () => void }>();
  /** The skin each remote player asked for, and the one drawn now (the ghost until a custom sheet is loaded). */
  private skins = new Map<string, string>();
  private activeSkins = new Map<string, string>();
  private bubbles = new Map<string, ChatBubble>();
  private messages = new Map<string, string>();
  private messageSeenAt = new Map<string, number>();
  private hoverOutlineSprites = new Map<string, Phaser.GameObjects.Sprite[]>();
  private pointerHandlers = new Map<
    string,
    {
      onOver: () => void;
      onOut: () => void;
      onDown: () => void;
    }
  >();

  constructor(
    private scene: Phaser.Scene,
    private coerce: CoerceFn,
    private fallbackSpawn: Phaser.Math.Vector2,
  ) {}

  addOrUpdate(player: any, sessionId: string, selfId: string) {
    if (sessionId === selfId) return;

    if (this.sprites.has(sessionId)) {
      this.updateRemoteSprite(sessionId, player);
      return;
    }

    const wanted = (player.skin ?? FALLBACK_SKIN).toString();
    const skin = usableSkin(this.scene, wanted);
    const spawn = this.coerce(player.x, player.y) ?? this.fallbackSpawn;
    const sprite = this.scene.physics.add.sprite(spawn.x, spawn.y, skinTextureKey(skin, "walk"));
    sprite.setDepth(spawn.y);
    sprite.setData("isPlayerSprite", true);
    sprite.setInteractive({ useHandCursor: true });
    this.setRemoteAnimation(sprite, player.dir, false, !!player.running, skin);
    this.sprites.set(sessionId, sprite);
    this.skins.set(sessionId, wanted);
    this.activeSkins.set(sessionId, skin);
    if (skin !== wanted) this.loadRemoteSkin(sessionId, wanted);
    this.createRemoteHoverOutlineSprites(sessionId, sprite);
    this.bindRemotePointerEvents(sessionId, player, sprite);

    const label = createNameLabel(this.scene, formatPlayerLabel(player.name, player.isAdmin), spawn.x, spawn.y);
    this.labels.set(sessionId, label);

    const initialMessage = sanitizeChatMessage(player.message ?? "");
    const bubble = createChatBubble(this.scene, initialMessage, spawn.x, spawn.y);
    positionChatBubble(bubble, spawn.x, spawn.y, 0);
    this.bubbles.set(sessionId, bubble);
    this.messages.set(sessionId, initialMessage);
    if (initialMessage) {
      this.messageSeenAt.set(sessionId, this.scene.time.now);
    }

    if (typeof player.onChange === "function") {
      const handler = () => this.updateRemoteSprite(sessionId, player);
      player.onChange(handler);
      this.listeners.set(sessionId, { cleanup: () => player.off?.(handler) });
    }
  }

  materializeAll(room: Room<PlaygroundState>, selfId: string) {
    room.state.players.forEach((player, sessionId) => this.addOrUpdate(player, sessionId, selfId));
  }

  prune(room: Room<PlaygroundState>, selfId: string) {
    const currentIds = new Set(room.state.players.keys());
    Array.from(this.sprites.keys()).forEach((sessionId) => {
      if (!currentIds.has(sessionId) && sessionId !== selfId) {
        this.remove(sessionId);
      }
    });
  }

  updateRemoteSprite(sessionId: string, player: any) {
    const target = this.sprites.get(sessionId);
    if (!target) return;

    const desired = this.coerce(player.x, player.y) ?? this.fallbackSpawn;
    const dist = Phaser.Math.Distance.Between(target.x, target.y, desired.x, desired.y);
    const moving = dist > 0.2;
    const wanted = (player.skin ?? FALLBACK_SKIN).toString() || FALLBACK_SKIN;
    if (this.skins.get(sessionId) !== wanted) {
      this.skins.set(sessionId, wanted);
      this.setActiveSkin(sessionId, target, usableSkin(this.scene, wanted));
      this.loadRemoteSkin(sessionId, wanted);
    }
    const skin = this.activeSkins.get(sessionId) ?? FALLBACK_SKIN;

    if (!moving) {
      this.scene.tweens.killTweensOf(target);
      target.setPosition(desired.x, desired.y);
      this.setRemoteAnimation(target, player.dir, false, !!player.running, skin);
      target.setDepth(desired.y);
      this.updateRemoteHoverOutlineSprites(sessionId);
      this.updateLabel(sessionId, target.x, target.y, player.name, player.isAdmin);
      this.updateBubble(sessionId, target.x, target.y, player.message, true);
      return;
    }

    // Limit step size to avoid visible teleporting when updates arrive late
    const maxStep = 100;
    const lerpFactor = dist > maxStep ? maxStep / dist : 1;
    const next = new Phaser.Math.Vector2(target.x + (desired.x - target.x) * lerpFactor, target.y + (desired.y - target.y) * lerpFactor);

    const speed = player.running ? 320 : 180;
    const duration = Phaser.Math.Clamp((Phaser.Math.Distance.Between(target.x, target.y, next.x, next.y) / speed) * 1000, 40, 240);
    this.scene.tweens.killTweensOf(target);
    this.setRemoteAnimation(target, player.dir, true, !!player.running, skin);
    this.updateBubble(sessionId, next.x, next.y, player.message, true);

    this.scene.tweens.add({
      targets: target,
      x: next.x,
      y: next.y,
      duration,
      ease: "Linear",
      onUpdate: () => {
        target.setDepth(target.y);
        this.updateRemoteHoverOutlineSprites(sessionId);
        this.updateLabel(sessionId, target.x, target.y, player.name, player.isAdmin);
        this.updateBubble(sessionId, target.x, target.y, player.message, false);
      },
      onComplete: () => {
        this.setRemoteAnimation(target, player.dir, false, !!player.running, skin);
        target.setDepth(next.y);
        this.updateRemoteHoverOutlineSprites(sessionId);
        this.updateLabel(sessionId, target.x, target.y, player.name, player.isAdmin);
        this.updateBubble(sessionId, next.x, next.y, player.message, true);
      },
    });
  }

  remove(sessionId: string) {
    const label = this.labels.get(sessionId);
    label?.destroy();
    this.labels.delete(sessionId);

    const listener = this.listeners.get(sessionId);
    listener?.cleanup?.();
    this.listeners.delete(sessionId);

    const bubble = this.bubbles.get(sessionId);
    if (bubble) {
      destroyChatBubble(bubble);
      this.bubbles.delete(sessionId);
    }

    const sprite = this.sprites.get(sessionId);
    if (sprite) {
      const pointerHandlers = this.pointerHandlers.get(sessionId);
      if (pointerHandlers) {
        sprite.off(Phaser.Input.Events.POINTER_OVER, pointerHandlers.onOver);
        sprite.off(Phaser.Input.Events.POINTER_OUT, pointerHandlers.onOut);
        sprite.off(Phaser.Input.Events.POINTER_DOWN, pointerHandlers.onDown);
        this.pointerHandlers.delete(sessionId);
      }
      sprite.destroy();
      this.sprites.delete(sessionId);
    }

    const outlines = this.hoverOutlineSprites.get(sessionId);
    outlines?.forEach((outline) => outline.destroy());
    this.hoverOutlineSprites.delete(sessionId);

    this.skins.delete(sessionId);
    this.activeSkins.delete(sessionId);
    this.messages.delete(sessionId);
    this.messageSeenAt.delete(sessionId);
  }

  destroy() {
    Array.from(this.sprites.keys()).forEach((sessionId) => this.remove(sessionId));
  }

  getRemoteSummaries() {
    return Array.from(this.sprites.entries()).map(([sessionId, sprite]) => {
      const label = this.labels.get(sessionId);
      return {
        id: sessionId,
        name: label?.text ?? "Player",
        x: sprite.x,
        y: sprite.y,
      };
    });
  }

  private setRemoteAnimation(sprite: Phaser.GameObjects.Sprite, dir: "up" | "down" | "left" | "right", moving: boolean, running: boolean, skin: string) {
    if (!sprite.anims) return;
    const safeDir = dir ?? "down";
    const key = skinAnimKey(skin, moving ? "walk" : "idle", safeDir);
    if (this.scene.anims.exists(key)) {
      sprite.anims.timeScale = running ? 1.5 : 1;
      sprite.anims.play(key, true);
    }
  }

  private setActiveSkin(sessionId: string, sprite: Phaser.GameObjects.Sprite, skin: string) {
    if (this.activeSkins.get(sessionId) === skin) return;
    this.activeSkins.set(sessionId, skin);
    sprite.setTexture(skinTextureKey(skin, "idle"));
    this.updateRemoteHoverOutlineSprites(sessionId);
  }

  // A custom sheet that is not in memory yet: load it, then swap the ghost for it (if it is still the wanted one).
  private loadRemoteSkin(sessionId: string, wanted: string) {
    loadSkin(this.scene, wanted, () => {
      const sprite = this.sprites.get(sessionId);
      if (sprite && this.skins.get(sessionId) === wanted) this.setActiveSkin(sessionId, sprite, wanted);
    });
  }

  private updateLabel(sessionId: string, x: number, y: number, name?: string, isAdmin?: boolean) {
    const label = this.labels.get(sessionId);
    if (!label) return;
    positionLabel(label, x, y, 0);
    label.setText(formatPlayerLabel(name, isAdmin));
  }

  private updateBubble(sessionId: string, x: number, y: number, message?: string, allowTextUpdate = false) {
    const bubble = this.bubbles.get(sessionId);
    const sprite = this.sprites.get(sessionId);
    if (!bubble || !sprite) return;
    // Bubble follows the rendered sprite position with light smoothing
    positionChatBubble(bubble, sprite.x, sprite.y, 0.15);
    const now = this.scene.time.now;
    if (allowTextUpdate && typeof message === "string") {
      const safeMessage = sanitizeChatMessage(message);
      const prev = this.messages.get(sessionId) ?? "";
      if (safeMessage !== prev) {
        this.messages.set(sessionId, safeMessage);
        if (safeMessage) {
          this.messageSeenAt.set(sessionId, now);
        } else {
          this.messageSeenAt.delete(sessionId);
        }
        updateChatBubble(bubble, safeMessage);
      }
    }

    const lastSeen = this.messageSeenAt.get(sessionId);
    if (lastSeen !== undefined && now - lastSeen > CHAT_HIDE_DELAY_MS) {
      this.messageSeenAt.delete(sessionId);
      updateChatBubble(bubble, "");
    }
  }

  private bindRemotePointerEvents(sessionId: string, player: RemoteIdentity, sprite: Phaser.GameObjects.Sprite) {
    const onOver = () => {
      const name = (this.labels.get(sessionId)?.text ?? "").trim();
      if (name) {
        console.log("[player-hover-name]", name);
      }
      this.setRemoteHoverOutlineVisible(sessionId, true);
    };
    const onOut = () => {
      this.setRemoteHoverOutlineVisible(sessionId, false);
    };
    const onDown = () => {
      const publicId = player?.id?.toString().trim() || sessionId;
      if (!publicId) return;
      useRoomUiStore.getState().openPlayerInfoCard(publicId);
    };

    sprite.on(Phaser.Input.Events.POINTER_OVER, onOver);
    sprite.on(Phaser.Input.Events.POINTER_OUT, onOut);
    sprite.on(Phaser.Input.Events.POINTER_DOWN, onDown);
    this.pointerHandlers.set(sessionId, { onOver, onOut, onDown });
  }

  private createRemoteHoverOutlineSprites(sessionId: string, sprite: Phaser.GameObjects.Sprite) {
    const textureKey = sprite.frame.texture.key;
    const frameName = sprite.frame.name;
    const outlines = RemoteManager.HOVER_OUTLINE_OFFSETS.map(([offsetX, offsetY]) =>
      this.scene.add
        .sprite(sprite.x + offsetX, sprite.y + offsetY, textureKey, frameName)
        .setTint(0xffffff)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(1)
        .setVisible(false),
    );
    this.hoverOutlineSprites.set(sessionId, outlines);
    this.updateRemoteHoverOutlineSprites(sessionId);
  }

  private updateRemoteHoverOutlineSprites(sessionId: string) {
    const sprite = this.sprites.get(sessionId);
    const outlines = this.hoverOutlineSprites.get(sessionId);
    if (!sprite || !outlines?.length) return;

    const textureKey = sprite.frame.texture.key;
    const frameName = sprite.frame.name;
    outlines.forEach((outline, index) => {
      const [offsetX, offsetY] = RemoteManager.HOVER_OUTLINE_OFFSETS[index];
      outline.setTexture(textureKey, frameName);
      outline.setPosition(sprite.x + offsetX, sprite.y + offsetY);
      outline.setFlip(sprite.flipX, sprite.flipY);
      outline.setDepth(sprite.y - 0.01);
    });
  }

  private setRemoteHoverOutlineVisible(sessionId: string, visible: boolean) {
    const outlines = this.hoverOutlineSprites.get(sessionId);
    if (!outlines) return;
    outlines.forEach((outline) => outline.setVisible(visible));
  }
}
