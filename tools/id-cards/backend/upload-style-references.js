// Helferskript: laedt alle Bilder aus ./style-references zu ComfyUI hoch
// (POST /upload/image), damit sie dort als styleReferenceImage in
// styles.json per Dateiname referenziert werden koennen.
//
// Grund fuer ein eigenes Skript statt manuellem Hochladen ueber die
// ComfyUI-GUI: bei 8 Stilen (und potenziell mehr) ist das wiederholte
// Klicken in der GUI fehleranfaellig und nicht wiederholbar - z.B. wenn
// ComfyUI neu installiert wird oder auf einem anderen Rechner laeuft.
// Einfach: Bilder in den Ordner legen, Skript einmal ausfuehren.

import { readFile, readdir } from "node:fs/promises";
import "dotenv/config";
import { uploadImageToComfyUI } from "./comfyui.js";

const REFERENCES_DIR = "./style-references";
const IMAGE_EXTENSION_PATTERN = /\.(png|jpe?g|webp)$/i;

async function main() {
  const allFiles = await readdir(REFERENCES_DIR);
  const imageFiles = allFiles.filter((name) => IMAGE_EXTENSION_PATTERN.test(name));

  if (imageFiles.length === 0) {
    console.log(
      `Keine Bilddateien in ${REFERENCES_DIR} gefunden. Bilder dort ablegen und Skript erneut ausfuehren.`
    );
    return;
  }

  console.log(`Lade ${imageFiles.length} Bild(er) zu ComfyUI hoch ...`);

  for (const filename of imageFiles) {
    try {
      const buffer = await readFile(`${REFERENCES_DIR}/${filename}`);
      const confirmedName = await uploadImageToComfyUI(buffer, filename);
      console.log(`  OK: ${filename} -> in ComfyUI gespeichert als "${confirmedName}"`);
    } catch (err) {
      console.error(`  FEHLER bei ${filename}:`, err.message);
    }
  }

  console.log(
    "\nFertig. Die hochgeladenen Dateinamen jetzt 1:1 als 'styleReferenceImage' in styles.json eintragen."
  );
}

main().catch((err) => {
  console.error("Upload-Skript fehlgeschlagen:", err);
  process.exit(1);
});
