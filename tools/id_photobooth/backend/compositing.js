// Kombiniert das normalisierte Originalfoto (Basis) mit dem ComfyUI-Ergebnis
// (Stil-Overlay) zu einem "Filter-Effekt" statt einem kompletten Bildersatz -
// das Original bleibt als Identitaets-Grundlage erkennbar, der Stil legt
// sich nur transparent darueber (aehnlich einem Instagram-Filter).
//
// sharp hat keine direkte "opacity"-Option fuer composite() (in der
// TypeScript-Definition von sharp/lib/index.d.ts gibt es keinen solchen
// Parameter) - Transparenz wird stattdessen erreicht, indem der Alpha-Kanal
// des Overlay-Bildes vorab manuell auf den gewuenschten Opacity-Wert
// skaliert wird, bevor composite() mit dem gewuenschten Blend-Mode laeuft.
import sharp from "sharp";

// Gueltige Blend-Mode-Strings laut sharp/lib/index.d.ts (Blend-Type) -
// zur Validierung, damit ein Tippfehler im Query-Parameter nicht zu einem
// kryptischen sharp-Fehler tief in composite() fuehrt.
export const VALID_BLEND_MODES = [
  "clear", "source", "over", "in", "out", "atop", "dest", "dest-over",
  "dest-in", "dest-out", "dest-atop", "xor", "add", "saturate", "multiply",
  "screen", "overlay", "darken", "lighten", "color-dodge", "colour-dodge",
  "color-burn", "colour-burn", "hard-light", "soft-light", "difference",
  "exclusion",
];

// Skaliert den Alpha-Kanal eines Bildes gleichmaessig auf "opacity" (0-1).
// Arbeitet auf den rohen Pixeldaten (raw), da das der einzige Weg ist, den
// Alpha-Kanal direkt zu manipulieren - sharp bietet dafuer keine fertige
// High-Level-Funktion.
async function applyOpacity(buffer, opacity) {
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // info.channels ist nach ensureAlpha() immer 4 (RGBA) - Alpha ist jedes
  // 4. Byte (Index 3, 7, 11, ...).
  for (let i = 3; i < data.length; i += info.channels) {
    data[i] = Math.round(data[i] * opacity);
  }

  return sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
    .png()
    .toBuffer();
}

// originalBuffer: das vorverarbeitete Foto (Basis, bleibt als Identitaet
//   erkennbar)
// overlayBuffer: das ComfyUI-Ergebnisbild (Stil-Layer)
// blendMode: einer von VALID_BLEND_MODES (Default "soft-light")
// opacity: 0-1, wie stark der Stil-Layer durchschlaegt (Default 0.7)
export async function combineImages(originalBuffer, overlayBuffer, { blendMode = "soft-light", opacity = 0.7 } = {}) {
  if (!VALID_BLEND_MODES.includes(blendMode)) {
    throw new Error(`Ungueltiger blendMode "${blendMode}". Erlaubt: ${VALID_BLEND_MODES.join(", ")}`);
  }

  const { width, height } = await sharp(originalBuffer).metadata();

  // Overlay defensiv auf exakt die Original-Groesse bringen - composite()
  // wirft sonst einen Fehler bei abweichenden Dimensionen (z.B. falls
  // ComfyUI intern leicht andere Masse liefert).
  const resizedOverlay = await sharp(overlayBuffer)
    .resize(width, height, { fit: "cover" })
    .toBuffer();

  const fadedOverlay = await applyOpacity(resizedOverlay, opacity);

  return sharp(originalBuffer)
    .composite([{ input: fadedOverlay, blend: blendMode }])
    .png()
    .toBuffer();
}
