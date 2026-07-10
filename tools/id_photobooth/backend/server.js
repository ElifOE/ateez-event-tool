import express from "express";
import cors from "cors";
import multer from "multer";
import { readFile } from "node:fs/promises";
import "dotenv/config";
import { loadWorkflowTemplate, buildWorkflow, findNodeIdByTitle, buildNodeTitleMap } from "./workflow.js";
import { uploadImageToComfyUI, submitWorkflow, getHistory, fetchImage } from "./comfyui.js";
import { connectComfyWebSocket, getProgressForJob, clearProgressForJob } from "./comfy-ws.js";
import { createAdminRouter } from "./admin-routes.js";
import { preprocessPhoto } from "./image-processing.js";
// compositing.js (Original+ComfyUI-Ergebnis blenden) ist fuer den
// Anyteez-Workflow deaktiviert: das ComfyUI-Ergebnis IST jetzt schon das
// finale Bild (Person unveraendert, Charakter hinzugefuegt) - ein
// nachtraegliches Zurueckmischen wuerde den frisch hinzugefuegten Charakter
// nur wieder verwaschen. Datei bleibt erhalten, falls spaeter doch wieder
// gebraucht (siehe PROJECT_CONTEXT.md / Plan "Nachtrag 2").

const app = express();
const PORT = process.env.PORT || 3000;

// CORS offen, weil das p5-Frontend laut Architektur-Entscheidung als
// eigenstaendiger Prototyp auf einem anderen Port/Origin laeuft.
app.use(cors());

// Fuer die Admin-JSON-Routen (PUT/POST mit Content-Type: application/json) -
// /generate brauchte das bisher nicht, da multer die einzige Multipart-Anfrage
// selbst parst (inkl. der Text-Felder wie styleId).
app.use(express.json());

// Datei landet im Speicher (Buffer), nicht auf der Platte - wir reichen sie
// direkt an ComfyUI weiter und muessen sie nicht selbst dauerhaft ablegen.
const upload = multer({ storage: multer.memoryStorage() });

// Admin-Bereich (Styles verwalten) - siehe admin-routes.js.
// Eigene multer-Instanz wird wiederverwendet, kein zweites Setup noetig.
app.use("/admin", createAdminRouter(upload));

// GET /styles: liefert die Liste der waehlbaren Stile.
// Wichtig: nur id/name/thumbnail nach aussen geben, nicht die
// ComfyUI-internen Parameter (promptText, ...) - die braucht nur /generate
// spaeter serverseitig.
app.get("/styles", async (req, res) => {
  try {
    const raw = await readFile("./styles.json", "utf-8");
    const styles = JSON.parse(raw);
    // thumbnail = anyteezReferenceImage: kein separates Thumbnail-Feld mehr
    // in styles.json (Schema-Vereinfachung), das Referenzbild IST das Vorschaubild.
    const publicStyles = styles.map(({ id, name, anyteezReferenceImage }) => ({
      id,
      name,
      thumbnail: anyteezReferenceImage,
    }));
    res.json(publicStyles);
  } catch (err) {
    console.error("Fehler beim Lesen von styles.json:", err);
    res.status(500).json({ error: "Stile konnten nicht geladen werden" });
  }
});

// Workflow-Template einmal beim Start laden, nicht bei jedem Request -
// die Datei aendert sich waehrend der Laufzeit nicht.
// anyteez-template.json ersetzt das alte SDXL/IPAdapter-Template (siehe
// PROJECT_CONTEXT.md, "WICHTIGES UPDATE: Workflow-Wechsel").
const workflowTemplate = await loadWorkflowTemplate("./anyteez-template.json");
// Die Node-ID des OUTPUT-Nodes steht im /history-Response nur als Zahl,
// nicht als Titel - deshalb einmal beim Start aufloesen und merken.
const outputNodeId = findNodeIdByTitle(workflowTemplate, "OUTPUT");
// Fuer die Fortschrittsanzeige: Node-ID -> Titel, damit comfy-ws.js die von
// ComfyUI gemeldeten Node-IDs in lesbare Schritt-Namen uebersetzen kann.
const nodeTitleMap = buildNodeTitleMap(workflowTemplate);

// Einmalige, dauerhafte WebSocket-Verbindung zu ComfyUI fuer echte
// Fortschrittsdaten waehrend der Verarbeitung (siehe comfy-ws.js).
connectComfyWebSocket();

// POST /generate: nimmt ein Foto (multipart, Feldname "photo") + styleId,
// laedt das Foto zu ComfyUI hoch, baut den Workflow mit den Style-Parametern
// zusammen und schickt ihn an ComfyUI. Gibt die promptId zurueck, mit der
// im naechsten Schritt (Polling) der Fortschritt abgefragt wird.
app.post("/generate", upload.single("photo"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Kein Foto im Feld 'photo' erhalten" });
    }

    const { styleId } = req.body;
    const stylesRaw = await readFile("./styles.json", "utf-8");
    const styles = JSON.parse(stylesRaw);
    const style = styles.find((s) => s.id === styleId);

    if (!style) {
      return res.status(400).json({ error: `Unbekannte styleId: ${styleId}` });
    }

    // Normalisierung (Aufloesung/Crop, Kontrast, Schaerfe) vor dem Upload -
    // gleicht Webcam-Snapshot und Datei-Upload auf eine einheitliche
    // Grundlage an, siehe image-processing.js.
    const processedBuffer = await preprocessPhoto(req.file.buffer);
    const uploadedFilename = await uploadImageToComfyUI(
      processedBuffer,
      "input-photo.png"
    );

    const workflow = buildWorkflow(workflowTemplate, {
      inputPhotoFilename: uploadedFilename,
      style,
    });

    const promptId = await submitWorkflow(workflow);

    res.json({ jobId: promptId });
  } catch (err) {
    console.error("Fehler bei /generate:", err);
    res.status(500).json({ error: "Generierung konnte nicht gestartet werden" });
  }
});

// GET /status/:jobId: fragt ComfyUI nach dem Verarbeitungsstand des Jobs.
// jobId ist hier identisch mit der ComfyUI promptId aus /generate - eine
// zusaetzliche eigene ID-Verwaltung wuerde fuer dieses Projekt nur
// unnoetige Komplexitaet bringen.
app.get("/status/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;
    const historyEntry = await getHistory(jobId);

    if (!historyEntry) {
      // Noch in der Warteschlange/laeuft - die genaueren Fortschrittsdaten
      // kommen aus dem WebSocket-Cache (comfy-ws.js), nicht aus /history,
      // das bis zum Abschluss leer bleibt.
      const progress = getProgressForJob(jobId, nodeTitleMap);
      return res.json({ status: "pending", ...progress });
    }

    if (historyEntry.status?.status_str === "error") {
      clearProgressForJob(jobId);
      return res.json({ status: "error" });
    }

    const outputImage = historyEntry.outputs?.[outputNodeId]?.images?.[0];
    if (!outputImage) {
      // Eintrag existiert, aber der OUTPUT-Node hat (noch) kein Bild -
      // z.B. waehrend ein vorgelagerter Node im Workflow noch laeuft.
      const progress = getProgressForJob(jobId, nodeTitleMap);
      return res.json({ status: "pending", ...progress });
    }

    clearProgressForJob(jobId);

    // Eigene Proxy-Route statt direkter ComfyUI-/view-URL: ComfyUI lehnt
    // Bildanfragen mit fremdem Origin/Referer (also vom Browser aus unserem
    // Frontend) mit 403 ab. Das Backend reicht die Bilddaten daher selbst
    // durch (siehe GET /image unten und fetchImage in comfyui.js). Kein
    // Compositing mehr noetig - das ComfyUI-Ergebnis ist beim Anyteez-
    // Workflow direkt das finale Bild (siehe Plan "Nachtrag 2").
    const imageUrl = `${req.protocol}://${req.get("host")}/image?${new URLSearchParams(outputImage)}`;

    res.json({ status: "done", imageUrl });
  } catch (err) {
    console.error("Fehler bei /status:", err);
    res.status(500).json({ error: "Status konnte nicht abgefragt werden" });
  }
});

// GET /image: Proxy fuer das fertige Bild. Nimmt dieselben Parameter wie
// ComfyUI's /view (filename, subfolder, type), holt die Bytes aber
// server-seitig und reicht sie durch - so bekommt der Browser sie von
// unserem eigenen Origin, nicht direkt von ComfyUI.
app.get("/image", async (req, res) => {
  try {
    const { filename, subfolder, type } = req.query;
    const { buffer, contentType } = await fetchImage({ filename, subfolder, type });
    res.set("Content-Type", contentType);
    res.send(buffer);
  } catch (err) {
    console.error("Fehler bei /image:", err);
    res.status(500).json({ error: "Bild konnte nicht geladen werden" });
  }
});

app.listen(PORT, () => {
  console.log(`Photobooth-Backend laeuft auf http://localhost:${PORT}`);
});
