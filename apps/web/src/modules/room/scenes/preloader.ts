import * as Phaser from "phaser";
import type { Room } from "colyseus.js";
import type { PlaygroundState } from "../@types/player";
import spriteAssets from "@/sprites-config.json";
import { createSkinAnimations, isCustomSkin, queueSkinLoad } from "../lib/skin-assets";

export default class Preloader extends Phaser.Scene {
  constructor() {
    super("preloader");
  }

  // Custom skins of the players already in the room (the local one included) are loaded before the game starts.
  private customSkins(): string[] {
    const room = this.game.registry.get("room") as Room<PlaygroundState> | undefined;
    const skins = new Set<string>();
    room?.state?.players?.forEach((player) => {
      const skin = player.skin?.toString() ?? "";
      if (isCustomSkin(skin)) skins.add(skin);
    });
    return [...skins];
  }

  preload() {
    this.customSkins().forEach((skin) => queueSkinLoad(this, skin));
    Object.entries(spriteAssets).forEach(([skin, paths]) => {
      this.load.spritesheet(`${skin}-walk`, paths.walk, {
        frameWidth: 32,
        frameHeight: 64,
      });
      this.load.spritesheet(`${skin}-idle`, paths.idle, {
        frameWidth: 32,
        frameHeight: 64,
      });
    });
  }

  create() {
    const room = this.game.registry.get("room") as Room<PlaygroundState> | undefined;

    // Create animations for all skins
    Object.keys(spriteAssets).forEach((skin) => {
      const anims = this.anims;
      const dirs = ["down", "left", "right", "up"] as const;
      const frames: Record<(typeof dirs)[number], [number, number]> = {
        right: [0, 5],
        up: [6, 11],
        left: [12, 17],
        down: [18, 23],
      };
      dirs.forEach((dir) => {
        const walkKey = `${skin}-walk-${dir}`;
        if (!anims.exists(walkKey)) {
          anims.create({
            key: walkKey,
            frames: anims.generateFrameNumbers(`${skin}-walk`, {
              start: frames[dir][0],
              end: frames[dir][1],
            }),
            frameRate: 10,
            repeat: -1,
          });
        }
        const idleKey = `${skin}-idle-${dir}`;
        if (!anims.exists(idleKey)) {
          anims.create({
            key: idleKey,
            frames: anims.generateFrameNumbers(`${skin}-idle`, {
              start: frames[dir][0],
              end: frames[dir][1],
            }),
            frameRate: 5,
            repeat: -1,
          });
        }
      });
    });

    this.customSkins().forEach((skin) => createSkinAnimations(this, skin));

    this.scene.start("game", { room });
  }
}
