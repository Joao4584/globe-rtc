import * as Phaser from "phaser";

const LABEL_OFFSET_Y = 32;
const LABEL_BASE_DEPTH = 20000;
const LABEL_MIN_WIDTH = 48;
const LABEL_HEIGHT = 20;
const LABEL_PADDING_X = 8;
const LABEL_CORNER_RADIUS = 10;
const LABEL_BG_COLOR = 0x64748b; // slate-500
const LABEL_BG_ALPHA = 0.6;
const LABEL_BORDER_COLOR = 0x475569; // slate-600

export class NameLabel extends Phaser.GameObjects.Container {
  private background: Phaser.GameObjects.Graphics;
  private nameText: Phaser.GameObjects.Text;
  private rawText = "Player";

  constructor(scene: Phaser.Scene, x: number, y: number, text: string) {
    super(scene, x, y);
    scene.add.existing(this);

    const fontFamily = resolveGeistFontFamily();
    this.background = scene.add.graphics();
    this.nameText = scene.add.text(0, 0, "Player", {
      fontFamily,
      fontSize: "11px",
      color: "#f8fafc",
      fontStyle: "600",
      resolution: 2,
    });

    this.nameText.setOrigin(0.5, 0.5);

    this.add([this.background, this.nameText]);
    this.setSize(LABEL_MIN_WIDTH, LABEL_HEIGHT);
    this.setScrollFactor(1, 1);
    this.setText(text || "Player");
  }

  get text() {
    return this.rawText;
  }

  setText(value: string) {
    this.rawText = (value || "Player").trim() || "Player";
    this.nameText.setText(this.rawText);
    this.layout();
    return this;
  }

  private layout() {
    const contentWidth = this.nameText.width + LABEL_PADDING_X * 2;
    const computedWidth = Math.max(LABEL_MIN_WIDTH, Math.ceil(contentWidth));
    const width = computedWidth % 2 === 0 ? computedWidth : computedWidth + 1;
    const height = LABEL_HEIGHT;
    const halfW = width / 2;
    const halfH = height / 2;

    this.background.clear();
    this.background.fillStyle(LABEL_BG_COLOR, LABEL_BG_ALPHA);
    this.background.lineStyle(1, LABEL_BORDER_COLOR, 0.9);
    this.background.fillRoundedRect(-halfW, -halfH, width, height, LABEL_CORNER_RADIUS);
    this.background.strokeRoundedRect(-halfW, -halfH, width, height, LABEL_CORNER_RADIUS);

    this.nameText.setPosition(0, 0);

    this.setSize(width, height);
  }
}

export function createNameLabel(scene: Phaser.Scene, name: string, x: number, y: number) {
  const label = new NameLabel(scene, x, y - LABEL_OFFSET_Y, name || "Player");
  positionLabel(label, x, y, 0);
  return label;
}

function resolveGeistFontFamily() {
  if (typeof document === "undefined") {
    return 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  }
  const geist = getComputedStyle(document.body).getPropertyValue("--font-geist-sans").trim();
  if (geist) {
    return `${geist}, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  }
  return 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
}

export function positionLabel(label: Phaser.GameObjects.Container, x: number, y: number, smoothing = 0) {
  const targetX = x;
  const targetY = y - LABEL_OFFSET_Y;
  const smooth = Phaser.Math.Clamp(smoothing, 0, 1);

  const px = smooth > 0 && smooth < 1 ? Phaser.Math.Linear(label.x, targetX, smooth) : targetX;
  const py = smooth > 0 && smooth < 1 ? Phaser.Math.Linear(label.y, targetY, smooth) : targetY;

  const snapX = Math.abs(px - targetX) < 0.25 ? targetX : px;
  const snapY = Math.abs(py - targetY) < 0.25 ? targetY : py;

  label.setPosition(Math.round(snapX), Math.round(snapY));

  const depth = LABEL_BASE_DEPTH + Math.round(y);
  if (label.depth !== depth) {
    label.setDepth(depth);
  }
}
