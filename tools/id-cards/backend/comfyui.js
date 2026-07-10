const COMFYUI_BASE_URL = process.env.COMFYUI_BASE_URL || "http://127.0.0.1:8000";

// Laedt einen Bild-Buffer zu ComfyUI hoch (POST /upload/image) und gibt den
// von ComfyUI zurueckgegebenen Dateinamen zurueck. Dieser Name wird danach
// in die Workflow-JSON (INPUT_PHOTO / STYLE_REFERENCE) eingesetzt.
//
// Nimmt einen Buffer statt eines Dateipfads entgegen: multer (Frontend-Upload
// im /generate-Endpunkt) liefert die Datei direkt im Speicher, eine
// Zwischendatei auf der Platte waere unnoetiger Aufwand fuer dieses Projekt.
//
// Verwendet die nativen fetch/FormData/Blob-APIs von Node (kein zusaetzliches
// Multipart-Package noetig, da es hier nur darum geht, eine Datei an ComfyUI
// weiterzureichen).
export async function uploadImageToComfyUI(buffer, filename) {
  const formData = new FormData();
  formData.append("image", new Blob([buffer]), filename);
  // overwrite: true verhindert, dass ComfyUI bei gleichem Dateinamen
  // automatisch "_00001" anhaengt - praktisch beim wiederholten Testen.
  formData.append("overwrite", "true");

  const response = await fetch(`${COMFYUI_BASE_URL}/upload/image`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(
      `ComfyUI-Upload fehlgeschlagen: ${response.status} ${response.statusText}`
    );
  }

  const result = await response.json();
  return result.name; // von ComfyUI vergebener/bestaetigter Dateiname
}

// Sendet einen fertig zusammengebauten Workflow an ComfyUI (POST /prompt)
// und gibt die prompt_id zurueck, mit der spaeter der Status abgefragt wird
// (GET /history/:promptId, im naechsten Schritt).
export async function submitWorkflow(workflow) {
  const response = await fetch(`${COMFYUI_BASE_URL}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: workflow }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `ComfyUI-Prompt fehlgeschlagen: ${response.status} ${response.statusText} - ${errorBody}`
    );
  }

  const result = await response.json();
  return result.prompt_id;
}

// Fragt den Verarbeitungsstatus eines Jobs bei ComfyUI ab (GET /history/:id).
// ComfyUI antwortet mit {} (leeres Objekt), solange der Job noch in der Queue
// ist oder laeuft - daher hier null zurueckgeben, wenn der Eintrag fehlt,
// statt eines Fehlers. Erst wenn der Job fertig ist, taucht promptId als Key auf.
export async function getHistory(promptId) {
  const response = await fetch(`${COMFYUI_BASE_URL}/history/${promptId}`);

  if (!response.ok) {
    throw new Error(
      `ComfyUI-History-Abfrage fehlgeschlagen: ${response.status} ${response.statusText}`
    );
  }

  const result = await response.json();
  return result[promptId] ?? null;
}

// Baut die URL, unter der ComfyUI ein erzeugtes Bild ausliefert (GET /view).
export function buildViewUrl({ filename, subfolder = "", type = "output" }) {
  const params = new URLSearchParams({ filename, subfolder, type });
  return `${COMFYUI_BASE_URL}/view?${params.toString()}`;
}

// Holt die Bilddaten direkt bei ComfyUI ab (Server-zu-Server, kein Browser
// beteiligt). Grund: ComfyUI lehnt /view-Requests mit fremdem Origin/Referer
// mit 403 ab (CSRF-Schutz) - ein Browser-<img src> direkt auf ComfyUI zeigen
// funktioniert deshalb nicht mehr. Das Backend muss das Bild stattdessen
// selbst holen und ans Frontend durchreichen (siehe Route GET /image in
// server.js). Genau der Fallback, der in PROJECT_CONTEXT.md vorgesehen war.
export async function fetchImage(params) {
  const response = await fetch(buildViewUrl(params));

  if (!response.ok) {
    throw new Error(
      `ComfyUI-Bildabruf fehlgeschlagen: ${response.status} ${response.statusText}`
    );
  }

  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") || "image/png",
  };
}
