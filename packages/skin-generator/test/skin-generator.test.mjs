import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { before, describe, it } from "node:test";
import pngjs from "pngjs";
import skinGenerator from "../dist/index.js";

const { PNG } = pngjs;
const { generateSkin, randomizeSkin, renderSkin, SkinGeneratorError } = skinGenerator;

const SIZE = 16;
// Adult sheets are 56x20 frames and kid sheets 24x4 frames; each frame is SIZE wide and SIZE * 2 tall.
const ADULT_SHEET = { width: 56 * SIZE, height: 20 * SIZE * 2 };
const KID_SHEET = { width: 24 * SIZE, height: 4 * SIZE * 2 };

let assetsDir;

/** Writes a sheet where `paint(x, y)` returns [r, g, b, a] or null for a transparent pixel. */
function writeSheet(file, sheet, paint) {
  // pngjs writes its own options into the object it receives, so pass a copy.
  const png = new PNG({ width: sheet.width, height: sheet.height });
  for (let y = 0; y < sheet.height; y++) {
    for (let x = 0; x < sheet.width; x++) {
      const color = paint(x, y);
      if (!color) continue;
      png.data.set(color, (y * sheet.width + x) * 4);
    }
  }
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, PNG.sync.write(png));
}

function addPieces(folder, sheet, ids, paint) {
  for (const id of ids) writeSheet(path.join(assetsDir, `${SIZE}x${SIZE}`, folder, `${id}.png`), sheet, (x, y) => paint(id, x, y));
}

const RED = [255, 0, 0, 255];
const BLUE = [0, 0, 255, 255];
const inFirstFrame = (x, y) => x < SIZE && y < SIZE * 2;
const GREEN = [0, 255, 0, 255];
const YELLOW = [255, 255, 0, 255];
const MAGENTA = [255, 0, 255, 255];
// Fake body rows (frame height is SIZE * 2): row 1 = idle (green), row 2 = walk (blue), row 3 = something else (magenta).
// Frames past column 24 in rows 1 and 2 are the pack's label tags (yellow) and must never reach the compact sheet.
function bodyPaint(x, y) {
  const row = Math.floor(y / (SIZE * 2));
  const inAnimation = x < 24 * SIZE;
  if (row === 0 && inFirstFrame(x, y)) return RED;
  if (row === 1) return inAnimation ? GREEN : YELLOW;
  if (row === 2) return inAnimation ? BLUE : YELLOW;
  if (row === 3) return MAGENTA;
  return null;
}

before(() => {
  assetsDir = mkdtempSync(path.join(os.tmpdir(), "skin-generator-"));
  // Body fills the whole first frame in red; hairstyle paints a blue block on its top-left corner;
  // accessory is a half-transparent white pixel on the bottom-right corner of the frame.
  addPieces("Bodies", ADULT_SHEET, ["Body_1", "Body_2", "Body_3"], (_id, x, y) => bodyPaint(x, y));
  addPieces("Eyes", ADULT_SHEET, ["Eyes_1", "Eyes_2"], () => null);
  addPieces("Outfits", ADULT_SHEET, ["Outfit_1", "Outfit_2", "Outfit_3", "Outfit_4", "Outfit_5"], () => null);
  addPieces("Hairstyles", ADULT_SHEET, ["Hair_1", "Hair_2", "Hair_3", "Hair_4"], (_id, x, y) => (x < 4 && y < 4 ? BLUE : null));
  addPieces("Accessories", ADULT_SHEET, ["Acc_1", "Acc_2", "Acc_3"], (_id, x, y) => (x === SIZE - 1 && y === SIZE * 2 - 1 ? [255, 255, 255, 128] : null));
  addPieces("Bodies_kids", KID_SHEET, ["Kid_Body_1", "Kid_Body_2"], (_id, x, y) => bodyPaint(x, y));
  addPieces("Eyes_kids", KID_SHEET, ["Kid_Eyes_1", "Kid_Eyes_2"], () => null);
  addPieces("Outfits_kids", KID_SHEET, ["Kid_Outfit_1", "Kid_Outfit_pajama_frog"], () => null);
  addPieces("Hairstyles_kids", KID_SHEET, ["Kid_Hair_1", "Kid_Hair_2"], () => null);
});

const source = () => ({ size: SIZE, assetsDir });
const pixel = (png, x, y) => Array.from(png.data.subarray((y * png.width + x) * 4, (y * png.width + x) * 4 + 4));

describe("randomizeSkin", () => {
  it("só troca as peças pedidas e mantém as demais da skin atual", async () => {
    const current = { type: "adult", body: "Body_2", eyes: "Eyes_2", outfit: "Outfit_1", hairstyle: "Hair_1", accessory: "Acc_1" };
    const outfits = new Set();
    for (let seed = 0; seed < 30; seed++) {
      const { selection } = await randomizeSkin({ ...source(), parts: ["outfit"], current, seed });
      assert.equal(selection.body, "Body_2");
      assert.equal(selection.eyes, "Eyes_2");
      assert.equal(selection.hairstyle, "Hair_1");
      assert.equal(selection.accessory, "Acc_1");
      outfits.add(selection.outfit);
    }
    assert.ok(outfits.size > 1, "o outfit deveria variar entre seeds diferentes");
  });

  it("com a mesma seed gera sempre a mesma skin, e devolve a seed usada quando não é informada", async () => {
    const options = { ...source(), parts: ["body", "eyes", "outfit", "hairstyle", "accessory"] };
    const first = await randomizeSkin({ ...options, seed: "abc" });
    const second = await randomizeSkin({ ...options, seed: "abc" });
    assert.deepEqual(first.selection, second.selection);

    const generated = await randomizeSkin(options);
    const replay = await randomizeSkin({ ...options, seed: generated.seed });
    assert.deepEqual(generated.selection, replay.selection);
  });

  it("skin de criança nunca tem acessório, mesmo se o acessório for pedido", async () => {
    const { selection } = await randomizeSkin({ ...source(), type: "kid", parts: ["accessory", "outfit"], seed: 1 });
    assert.equal(selection.type, "kid");
    assert.equal(selection.accessory, null);
    assert.match(selection.body, /^Kid_Body/);
  });

  it("trocar o tipo ignora a skin atual e sorteia tudo no novo tipo", async () => {
    const current = { type: "adult", body: "Body_1", eyes: "Eyes_1", outfit: "Outfit_1", hairstyle: "Hair_1", accessory: "Acc_1" };
    const { selection } = await randomizeSkin({ ...source(), type: "kid", parts: [], current, seed: 7 });
    assert.match(selection.body, /^Kid_Body/);
    assert.match(selection.eyes, /^Kid_Eyes/);
    assert.match(selection.outfit, /^Kid_Outfit/);
  });

  it("pijama não usa cabelo", async () => {
    for (let seed = 0; seed < 40; seed++) {
      const { selection } = await randomizeSkin({ ...source(), type: "kid", parts: ["outfit", "hairstyle"], seed });
      if (selection.outfit.includes("pajama")) assert.equal(selection.hairstyle, null);
      else assert.notEqual(selection.hairstyle, null);
    }
  });

  it("recusa nome de parte inexistente", async () => {
    await assert.rejects(randomizeSkin({ ...source(), parts: ["hat"] }), SkinGeneratorError);
  });

  it("avisa como sincronizar as peças quando a pasta de assets não existe", async () => {
    await assert.rejects(
      randomizeSkin({ size: SIZE, assetsDir: path.join(assetsDir, "nao-existe"), parts: ["body"] }),
      (error) => error.code === "ASSETS_NOT_FOUND" && /sync-assets/.test(error.message),
    );
  });
});

describe("renderSkin", () => {
  const selection = { type: "adult", body: "Body_1", eyes: "Eyes_1", outfit: "Outfit_1", hairstyle: "Hair_1", accessory: "Acc_1" };

  it("empilha as camadas na ordem do gerador (cabelo por cima do corpo, acessório por cima de tudo)", async () => {
    const { preview } = await renderSkin(selection, source());
    const png = PNG.sync.read(preview);
    assert.deepEqual(pixel(png, 0, 0), BLUE, "o cabelo azul fica sobre o corpo vermelho");
    assert.deepEqual(pixel(png, 8, 8), RED, "fora do cabelo aparece o corpo");
    // White at ~50% over opaque red becomes pink and stays opaque.
    const blended = pixel(png, SIZE - 1, SIZE * 2 - 1);
    assert.equal(blended[3], 255);
    assert.ok(blended[1] > 100 && blended[1] < 160, `esperava mistura de branco com vermelho, veio ${blended}`);
  });

  it("o preview tem as 4 poses lado a lado e o spritesheet só vem quando pedido", async () => {
    const withoutSheet = await renderSkin(selection, source());
    assert.equal(withoutSheet.spritesheet, undefined);
    const preview = PNG.sync.read(withoutSheet.preview);
    assert.equal(preview.width, 4 * SIZE);
    assert.equal(preview.height, SIZE * 2);

    const withSheet = await renderSkin(selection, { ...source(), includeSpritesheet: true });
    const sheet = PNG.sync.read(withSheet.spritesheet);
    assert.deepEqual({ width: sheet.width, height: sheet.height }, ADULT_SHEET);
  });

  it("amplia só o preview pelo fator pedido, sem tocar no spritesheet", async () => {
    const { preview, spritesheet } = await renderSkin(selection, { ...source(), scale: 3, includeSpritesheet: true });
    const png = PNG.sync.read(preview);
    assert.deepEqual({ width: png.width, height: png.height }, { width: 4 * SIZE * 3, height: SIZE * 2 * 3 });
    assert.deepEqual(pixel(png, 2, 2), BLUE, "o bloco do cabelo (4x4) vira 12x12 com a mesma cor");
    assert.deepEqual(pixel(png, 11, 11), BLUE);
    assert.deepEqual(pixel(png, 12, 12), RED);
    assert.equal(PNG.sync.read(spritesheet).width, ADULT_SHEET.width);
    await assert.rejects(renderSkin(selection, { ...source(), scale: 0 }), SkinGeneratorError);
    await assert.rejects(renderSkin(selection, { ...source(), scale: 2.5 }), SkinGeneratorError);
  });

  it("com animations devolve só idle e walk empilhados, sem as etiquetas nem as outras linhas da folha", async () => {
    const { spritesheet, animationLayout } = await renderSkin(selection, { ...source(), animations: ["idle", "walk"] });
    const png = PNG.sync.read(spritesheet);
    assert.deepEqual({ width: png.width, height: png.height }, { width: 24 * SIZE, height: 2 * SIZE * 2 });
    assert.deepEqual(pixel(png, 0, 0), GREEN, "a primeira linha é o idle");
    assert.deepEqual(pixel(png, 24 * SIZE - 1, 0), GREEN, "o idle vai até o 24o quadro");
    assert.deepEqual(pixel(png, 0, SIZE * 2), BLUE, "a segunda linha é o walk");

    const colors = new Set();
    for (let i = 0; i < png.data.length; i += 4) colors.add(png.data.subarray(i, i + 4).join(","));
    assert.ok(!colors.has(YELLOW.join(",")), "as etiquetas da folha original ficam de fora");
    assert.ok(!colors.has(MAGENTA.join(",")), "linhas que não foram pedidas ficam de fora");

    assert.deepEqual(animationLayout.directions, ["right", "up", "left", "down"]);
    assert.equal(animationLayout.framesPerDirection, 6);
    assert.deepEqual(
      animationLayout.animations.map((a) => [a.name, a.row, a.frames]),
      [["idle", 0, 24], ["walk", 1, 24]],
    );
  });

  it("sit, throw, punch e hurt têm quadros e direções próprios, e a folha fica larga como a maior animação", async () => {
    const { spritesheet, animationLayout } = await renderSkin(selection, { ...source(), animations: ["sit", "throw", "punch", "hurt"] });
    const png = PNG.sync.read(spritesheet);
    assert.deepEqual({ width: png.width, height: png.height }, { width: 56 * SIZE, height: 4 * SIZE * 2 }, "throw tem 56 quadros (4 x 14)");
    assert.deepEqual(
      animationLayout.animations.map((a) => [a.name, a.row, a.frames, a.framesPerDirection, a.directions.join("/")]),
      [
        ["sit", 0, 12, 6, "right/left"],
        ["throw", 1, 56, 14, "right/up/left/down"],
        ["punch", 2, 24, 6, "right/up/left/down"],
        ["hurt", 3, 12, 3, "right/up/left/down"],
      ],
    );
  });

  it("a ordem de animations define a ordem das linhas e funciona também para criança", async () => {
    const kid = { type: "kid", body: "Kid_Body_1", eyes: "Kid_Eyes_1", outfit: "Kid_Outfit_1", hairstyle: "Kid_Hair_1", accessory: null };
    const { spritesheet } = await renderSkin(kid, { ...source(), animations: ["walk", "idle"] });
    const png = PNG.sync.read(spritesheet);
    assert.deepEqual(pixel(png, 0, 0), BLUE, "walk primeiro");
    assert.deepEqual(pixel(png, 0, SIZE * 2), GREEN, "idle depois");
  });

  it("recusa animação que não existe", async () => {
    await assert.rejects(renderSkin(selection, { ...source(), animations: ["dance"] }), SkinGeneratorError);
  });

  it("recusa peça que não existe no catálogo", async () => {
    await assert.rejects(renderSkin({ ...selection, outfit: "Outfit_999" }, source()), SkinGeneratorError);
    await assert.rejects(renderSkin({ ...selection, outfit: "../../etc/passwd" }, source()), SkinGeneratorError);
  });
});

describe("generateSkin", () => {
  it("sorteia e renderiza em uma chamada, devolvendo a seleção e a seed", async () => {
    const result = await generateSkin({ ...source(), parts: ["body", "outfit", "hairstyle"], seed: 42 });
    assert.equal(typeof result.seed, "number");
    assert.equal(result.selection.type, "adult");
    assert.ok(result.preview.length > 0);
    assert.equal(PNG.sync.read(result.preview).width, 4 * SIZE);
  });
});
