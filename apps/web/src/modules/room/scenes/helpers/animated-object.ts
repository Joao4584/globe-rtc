import * as Phaser from "phaser";
import type { AnimationRule } from "@/modules/editor/assets/object-rules";

// Plays the frames of one animated object following its rule (see modules/editor/assets/object-rules.ts).
// Runs on the local player's screen only: each player sees the objects react to what they do.
export class AnimatedObject {
  private frame = 0;
  // -1 / 1: stepping towards `target`; 0: resting (or looping).
  private dir: -1 | 0 | 1 = 0;
  private target = 0;
  private looping = false;
  private until = 0;
  // once-return: when to snap back to the resting frame after the last frame was shown.
  private resetAt = 0;
  private near = false;

  constructor(
    private readonly sprite: Phaser.GameObjects.Sprite,
    private readonly frames: number,
    private readonly delays: number[],
    private readonly rule: AnimationRule,
  ) {
    if (rule.trigger === "always") {
      this.looping = true;
    } else {
      this.show(this.home);
      this.bind();
    }
  }

  private get home() {
    return this.rule.start === "last" ? this.frames - 1 : 0;
  }

  private get away() {
    return this.rule.start === "last" ? 0 : this.frames - 1;
  }

  private show(frame: number) {
    this.frame = frame;
    this.sprite.setFrame(frame);
  }

  private delay(frame: number) {
    return this.delays[frame] ?? 100;
  }

  private moveTo(target: number) {
    this.resetAt = 0;
    if (this.frame === target) {
      this.dir = 0;
      return;
    }
    this.target = target;
    this.dir = target > this.frame ? 1 : -1;
    this.until = 0;
  }

  private startLoop() {
    this.looping = true;
    this.dir = 0;
    this.until = 0;
  }

  private stopLoop() {
    this.looping = false;
    this.show(this.home);
  }

  private get busy() {
    return this.dir !== 0 || this.resetAt > 0;
  }

  private playOnce() {
    if (this.busy) return;
    this.show(this.home);
    this.moveTo(this.away);
  }

  /** A click, or the pointer / a player arriving (`entering`). */
  private activate(entering: boolean) {
    switch (this.rule.mode) {
      case "once":
      case "once-return":
        this.playOnce();
        break;
      case "toggle":
        if (entering) this.moveTo(this.away);
        else this.moveTo(this.dir !== 0 ? (this.target === this.away ? this.home : this.away) : this.frame === this.away ? this.home : this.away);
        break;
      case "loop":
        if (entering) this.startLoop();
        else if (this.looping) this.stopLoop();
        else this.startLoop();
        break;
    }
  }

  /** The pointer / player left (hover and near rules). */
  private leave() {
    if (this.rule.mode === "toggle") this.moveTo(this.home);
    else if (this.rule.mode === "loop") this.stopLoop();
  }

  private bind() {
    const { trigger } = this.rule;
    if (trigger === "click") {
      this.sprite.setInteractive({ useHandCursor: true });
      this.sprite.on("pointerdown", () => this.activate(false));
    } else if (trigger === "hover") {
      this.sprite.setInteractive({ useHandCursor: true });
      this.sprite.on("pointerover", () => this.activate(true));
      this.sprite.on("pointerout", () => this.leave());
    }
  }

  /** `feetX/feetY`: where the local player stands, in world pixels. Call every frame. */
  update(time: number, feetX: number, feetY: number, tile: number) {
    if (this.rule.trigger === "near") {
      const { x, y, width, height } = this.sprite;
      const isNear = feetX >= x - tile && feetX <= x + width + tile && feetY >= y - tile && feetY <= y + height + tile;
      if (isNear !== this.near) {
        this.near = isNear;
        if (isNear) this.activate(true);
        else this.leave();
      }
    }

    if (this.resetAt > 0 && time >= this.resetAt) {
      this.resetAt = 0;
      this.show(this.home);
      return;
    }
    if (time < this.until) return;

    if (this.looping) {
      this.show((this.frame + 1) % this.frames);
      this.until = time + this.delay(this.frame);
    } else if (this.dir !== 0) {
      this.show(this.frame + this.dir);
      this.until = time + this.delay(this.frame);
      if (this.frame === this.target) {
        this.dir = 0;
        if (this.rule.mode === "once-return" && this.frame === this.away) this.resetAt = this.until;
      }
    }
  }
}
