import * as Phaser from "phaser";

interface WheelZoomOptions {
  initialZoom?: number;
  minZoom?: number;
  maxZoom?: number;
  wheelStep?: number;
  precision?: number;
  zoomSnapStep?: number;
  tweenDurationMs?: number;
  tweenEase?: string;
}

export class MapManager {
  public static setupWheelZoom(scene: Phaser.Scene, camera: Phaser.Cameras.Scene2D.Camera, options?: WheelZoomOptions) {
    const minZoom = options?.minZoom ?? 0.5;
    const maxZoom = options?.maxZoom ?? 2.5;
    const wheelStep = options?.wheelStep ?? 0.1;
    const precision = options?.precision ?? 100;
    const zoomSnapStep = options?.zoomSnapStep ?? 0.25;
    const tweenDurationMs = options?.tweenDurationMs ?? 120;
    const tweenEase = options?.tweenEase ?? "Sine.Out";
    const initialZoom = Phaser.Math.Clamp(options?.initialZoom ?? 1, minZoom, maxZoom);

    camera.setZoom(initialZoom);

    const clampAndRoundZoom = (value: number) => {
      const clamped = Phaser.Math.Clamp(value, minZoom, maxZoom);
      const snapped = Math.round(clamped / zoomSnapStep) * zoomSnapStep;
      return Math.round(snapped * precision) / precision;
    };

    let targetZoom = initialZoom;

    const onWheel = (
      _pointer: Phaser.Input.Pointer,
      _gameObjects: Phaser.GameObjects.GameObject[],
      _deltaX: number,
      deltaY: number,
    ) => {
      const direction = Math.sign(deltaY);
      if (direction === 0) return;

      const nextZoom = direction < 0 ? targetZoom + wheelStep : targetZoom - wheelStep;
      targetZoom = clampAndRoundZoom(nextZoom);

      scene.tweens.killTweensOf(camera);
      scene.tweens.add({
        targets: camera,
        zoom: targetZoom,
        duration: tweenDurationMs,
        ease: tweenEase,
      });
    };

    scene.input.on("wheel", onWheel);

    const onResize = () => {
      targetZoom = clampAndRoundZoom(targetZoom);
      scene.tweens.killTweensOf(camera);
      camera.setZoom(targetZoom);
    };

    scene.scale.on(Phaser.Scale.Events.RESIZE, onResize);

    return () => {
      scene.input.off("wheel", onWheel);
      scene.scale.off(Phaser.Scale.Events.RESIZE, onResize);
    };
  }
}
