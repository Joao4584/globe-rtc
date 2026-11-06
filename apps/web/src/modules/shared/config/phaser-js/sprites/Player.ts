import * as Phaser from "phaser";
import { FALLBACK_SKIN, createSkinAnimations, isCustomSkin, loadSkin, skinAnimKey, skinTextureKey, usableSkin } from "@/modules/room/lib/skin-assets";

type Direction = "up" | "down" | "left" | "right";

export class Player extends Phaser.Physics.Arcade.Sprite {
  private baseSpeed = 150;
  private sprintSpeed = 300;
  /** The skin the player wants (from the room state). */
  private skin = FALLBACK_SKIN;
  /** The skin drawn right now: the ghost until a custom sheet is loaded. */
  private activeSkin = FALLBACK_SKIN;

  private cursors: Record<string, Phaser.Input.Keyboard.Key>;
  private sprintKey: Phaser.Input.Keyboard.Key;
  private shadow: Phaser.GameObjects.Ellipse;
  private syncShadow?: () => void;

  private lastDirection: Direction = "down";
  private moving = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    skin: string,
    frame?: string | number,
  ) {
    const active = usableSkin(scene, skin);
    super(scene, x, y, skinTextureKey(active, "walk"), frame);
    this.skin = skin;
    this.activeSkin = active;

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCollideWorldBounds(true);

    this.shadow = scene.add.ellipse(x, y, 18, 8, 0x000000, 0.25).setScrollFactor(1);
    // Keep the shadow synced after physics updates so it never trails the sprite
    this.syncShadow = () => {
      this.shadow.setPosition(this.x, this.y + this.height / 1.97);
      this.shadow.setDepth(this.y - 1);
    };
    this.syncShadow();
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.syncShadow);

    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      if (this.syncShadow) {
        scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.syncShadow);
      }
      this.shadow.destroy();
    });

    const body = this.body as Phaser.Physics.Arcade.Body;
    const hitboxSize = { width: 16, height: 16 };
    body.setSize(hitboxSize.width, hitboxSize.height);
    body.setOffset((this.width - hitboxSize.width) / 2, this.height - hitboxSize.height);

    this.createAnimations();

    this.cursors = this.scene.input.keyboard!.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      upArrow: Phaser.Input.Keyboard.KeyCodes.UP,
      downArrow: Phaser.Input.Keyboard.KeyCodes.DOWN,
      leftArrow: Phaser.Input.Keyboard.KeyCodes.LEFT,
      rightArrow: Phaser.Input.Keyboard.KeyCodes.RIGHT,
    }) as Record<string, Phaser.Input.Keyboard.Key>;

    this.sprintKey = this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
  }

  private createAnimations() {
    if (isCustomSkin(this.activeSkin)) {
      createSkinAnimations(this.scene, this.activeSkin);
      return;
    }
    const animationManager = this.scene.anims;
    const dirs: Direction[] = ["down", "left", "right", "up"];
    const frames: Record<Direction, [number, number]> = {
      right: [0, 5],
      up: [6, 11],
      left: [12, 17],
      down: [18, 23],
    };
    dirs.forEach((dir) => {
      (["walk", "idle"] as const).forEach((motion) => {
        const key = this.animKey(motion, dir);
        if (animationManager.exists(key)) return;
        animationManager.create({
          key,
          frames: animationManager.generateFrameNumbers(`${this.activeSkin}-${motion}`, { start: frames[dir][0], end: frames[dir][1] }),
          frameRate: motion === "walk" ? 10 : 5,
          repeat: -1,
        });
      });
    });
  }

  update() {
    const currentSpeed = this.sprintKey.isDown ? this.sprintSpeed : this.baseSpeed;
    const { left, right, up, down, leftArrow, rightArrow, upArrow, downArrow } = this.cursors;

    this.setVelocity(0);
    this.moving = false;

    if (left.isDown || leftArrow.isDown) {
      this.lastDirection = "left";
      this.setVelocityX(-currentSpeed);
      this.anims.play(this.animKey("walk", "left"), true);
      this.moving = true;
    } else if (right.isDown || rightArrow.isDown) {
      this.lastDirection = "right";
      this.setVelocityX(currentSpeed);
      this.anims.play(this.animKey("walk", "right"), true);
      this.moving = true;
    } else if (up.isDown || upArrow.isDown) {
      this.lastDirection = "up";
      this.setVelocityY(-currentSpeed);
      this.anims.play(this.animKey("walk", "up"), true);
      this.moving = true;
    } else if (down.isDown || downArrow.isDown) {
      this.lastDirection = "down";
      this.setVelocityY(currentSpeed);
      this.anims.play(this.animKey("walk", "down"), true);
      this.moving = true;
    } else {
      switch (this.lastDirection) {
        case "up":
          this.anims.play(this.animKey("idle", "up"), true);
          break;
        case "down":
          this.anims.play(this.animKey("idle", "down"), true);
          break;
        case "left":
          this.anims.play(this.animKey("idle", "left"), true);
          break;
        case "right":
          this.anims.play(this.animKey("idle", "right"), true);
          break;
      }
    }
  }

  getDirection(): Direction {
    return this.lastDirection;
  }

  isMoving() {
    return this.moving;
  }

  isSprinting() {
    return this.sprintKey.isDown;
  }

  setSkin(nextSkin: string) {
    const normalized = nextSkin?.trim() || FALLBACK_SKIN;
    if (normalized === this.skin) return;
    this.skin = normalized;

    // Draw it now when its sheet is loaded, otherwise the ghost until the sheet arrives.
    this.applySkin(usableSkin(this.scene, normalized));
    loadSkin(this.scene, normalized, () => {
      if (this.skin === normalized && this.scene) this.applySkin(normalized);
    });
  }

  private applySkin(skin: string) {
    if (skin === this.activeSkin) return;
    this.activeSkin = skin;
    this.createAnimations();
    this.setTexture(skinTextureKey(skin, "idle"));
  }

  private animKey(type: "walk" | "idle", dir: Direction) {
    return skinAnimKey(this.activeSkin, type, dir);
  }
}
