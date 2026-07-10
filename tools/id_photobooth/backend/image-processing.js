// Normalisiert ein Eingabefoto (Webcam-Snapshot ODER Datei-Upload) vor dem
// Hochladen zu ComfyUI - gleicht damit Unterschiede zwischen den beiden
// Quellen aus, bevor der Canny-Preprocessor/IPAdapter draufschauen:
//   1. Auflösung/Seitenverhältnis fest auf das Photocard-Format (2:3, siehe
//      Kamera-Format im Frontend) skalieren, per Crop ("cover") statt
//      Verzerrung - egal ob die Quelle quadratisch, breit oder schon 2:3 ist.
//   2. Kontrast/Belichtung normalisieren (sharp's normalise() = Auto-Levels/
//      Histogram-Streckung) - gleicht ungleichmaessige Webcam-Beleuchtung an.
//   3. Leicht schaerfen (Unsharp-Mask via sharp's sharpen()) - gleicht die
//      Weichheit typischer Webcam-Bilder etwas aus.
import sharp from "sharp";

// 1024x1536 = exaktes 2:3-Hochformat, beide Seiten durch 64 teilbar (von
// SDXL/ComfyUI bevorzugt) - passt zum im Frontend gewaehlten Photocard-Format.
const TARGET_WIDTH = 1024;
const TARGET_HEIGHT = 1536;

export async function preprocessPhoto(buffer) {
  return sharp(buffer)
    .resize(TARGET_WIDTH, TARGET_HEIGHT, { fit: "cover" })
    .normalise()
    .sharpen()
    .png()
    .toBuffer();
}
