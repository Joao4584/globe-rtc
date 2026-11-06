// Copies the character pieces from the Modern Interiors pack into packages/skin-generator/private-assets, keeping only
// the sizes asked for. Usage:
//   pnpm sync-assets -- --source "<pack>/moderninteriors-win/2_Characters/Character_Generator" [--sizes 32,16,48] [--target <folder>]
// The source can also come from SKIN_GENERATOR_PACK_DIR.
import { copyFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FOLDERS = ["Bodies", "Bodies_kids", "Eyes", "Eyes_kids", "Outfits", "Outfits_kids", "Hairstyles", "Hairstyles_kids", "Accessories"];

function readArg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

const source = readArg("source") ?? process.env.SKIN_GENERATOR_PACK_DIR;
const sizes = (readArg("sizes") ?? "32").split(",").map((size) => size.trim());
// Default: packages/skin-generator/private-assets (git-ignored). Override with --target.
const here = path.dirname(fileURLToPath(import.meta.url));
const target = path.resolve(readArg("target") ?? path.join(here, "..", "private-assets"));

if (!source) {
  console.error('Missing --source "<pack>/2_Characters/Character_Generator" (or SKIN_GENERATOR_PACK_DIR).');
  process.exit(1);
}

let copied = 0;
for (const size of sizes) {
  for (const folder of FOLDERS) {
    const from = path.join(source, folder, `${size}x${size}`);
    const to = path.join(target, `${size}x${size}`, folder);
    await mkdir(to, { recursive: true });
    for (const file of await readdir(from)) {
      if (!file.toLowerCase().endsWith(".png")) continue;
      await copyFile(path.join(from, file), path.join(to, file));
      copied++;
    }
  }
}
console.log(`Copied ${copied} pieces into ${target}`);
