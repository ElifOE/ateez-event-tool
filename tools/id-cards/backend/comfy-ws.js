// Haelt eine einzige dauerhafte WebSocket-Verbindung zu ComfyUI offen (ab
// Serverstart, nicht pro Job) und cached daraus den Fortschritt pro Job.
//
// Grund fuer WebSocket statt nur Polling: ComfyUI's GET /history/:id liefert
// erst etwas, wenn ein Job KOMPLETT fertig oder fehlerhaft ist (per Test
// bestaetigt) - waehrend der Verarbeitung bleibt es leer. Echte
// Zwischenstaende (welcher Node laeuft gerade, KSampler-Schritt X von Y)
// gibt es nur ueber ComfyUI's WebSocket-API (Events vom Typ "progress_state").
//
// Das bleibt komplett intern im Backend: GET /status/:jobId (server.js)
// bleibt fuers Frontend ein simples Polling-REST-Endpoint, das diese Daten
// nur mit ausliefert - keine WebSocket-Komplexitaet im Frontend noetig.
//
// Kalibrierungs-Erkenntnis (siehe PROJECT_CONTEXT/Plan): ComfyUI cached
// bereits gelaufene Nodes (z.B. Checkpoint-Laden) zwischen Anfragen, daher
// taucht nicht bei jedem Run dieselbe feste Anzahl Nodes in progress_state
// auf. Eine fest hinterlegte Schritt-Liste waere deshalb bruechig. Stattdessen
// wird die bisher groesste beobachtete Node-Anzahl als bester Schaetzwert
// fuer "Y" (Gesamtschritte) verwendet und automatisch nachgezogen ("lernt" mit).

import { randomUUID } from "node:crypto";
import WebSocket from "ws";

const COMFYUI_BASE_URL = process.env.COMFYUI_BASE_URL || "http://127.0.0.1:8000";

// promptId -> { finishedCount, currentNodeId, currentValue, currentMax }
const jobProgress = new Map();

// Bester bisher beobachteter Gesamt-Node-Count ueber alle Jobs in dieser
// Server-Laufzeit hinweg - dient als Schaetzwert fuer "totalSteps".
let bestKnownTotalSteps = 1;

let ws = null;

export function connectComfyWebSocket() {
  const wsUrl = `${COMFYUI_BASE_URL.replace(/^http/, "ws")}/ws?clientId=${randomUUID()}`;
  ws = new WebSocket(wsUrl);

  ws.on("open", () => console.log("ComfyUI-WebSocket verbunden (Fortschrittsanzeige aktiv)."));

  ws.on("message", (data, isBinary) => {
    if (isBinary) return; // Preview-Bilder als Binaerframes - hier nicht gebraucht

    let message;
    try {
      message = JSON.parse(data.toString());
    } catch {
      return; // unerwartetes Frame-Format ignorieren, nicht kritisch fuer den Hauptablauf
    }

    if (message.type === "progress_state") {
      handleProgressState(message.data);
    }
  });

  // Einfache Wiederverbindung nach kurzer Pause - reicht fuer eine lokale
  // Demo-Session, keine Backoff-Strategie noetig (siehe Plan).
  ws.on("close", () => {
    console.warn("ComfyUI-WebSocket getrennt, versuche in 3s erneut zu verbinden ...");
    setTimeout(connectComfyWebSocket, 3000);
  });
  ws.on("error", (err) => console.error("ComfyUI-WebSocket-Fehler:", err.message));
}

function handleProgressState(data) {
  const { prompt_id: promptId, nodes } = data;
  const nodeEntries = Object.values(nodes);

  const finishedCount = nodeEntries.filter((n) => n.state === "finished").length;
  const runningEntry = nodeEntries.find((n) => n.state === "running");

  bestKnownTotalSteps = Math.max(bestKnownTotalSteps, nodeEntries.length);

  jobProgress.set(promptId, {
    finishedCount,
    currentNodeId: runningEntry?.node_id ?? null,
    currentValue: runningEntry?.value ?? null,
    currentMax: runningEntry?.max ?? null,
  });
}

// Liefert die aktuellen Fortschrittsdaten fuer einen Job, lesbar gemacht
// anhand der Node-Titel-Zuordnung aus workflow.js's buildNodeTitleMap().
// Gibt null zurueck, wenn (noch) keine Fortschrittsdaten vorliegen (z.B.
// Job steht noch in der Warteschlange, ComfyUI hat noch nichts gemeldet).
export function getProgressForJob(promptId, nodeTitleMap) {
  const progress = jobProgress.get(promptId);
  if (!progress) return null;

  const currentStep = progress.currentNodeId
    ? nodeTitleMap[progress.currentNodeId] ?? "Verarbeitung"
    : "Wird vorbereitet ...";

  return {
    currentStep,
    stepIndex: progress.finishedCount + (progress.currentNodeId ? 1 : 0),
    totalSteps: bestKnownTotalSteps,
    subProgress:
      progress.currentMax && progress.currentMax > 1
        ? { value: progress.currentValue, max: progress.currentMax }
        : null,
  };
}

// Aufgeraeumt werden muss, sobald ein Job fertig/fehlerhaft ist (von
// server.js aufgerufen) - sonst waechst die Map ueber eine lange
// Demo-Session unbegrenzt weiter.
export function clearProgressForJob(promptId) {
  jobProgress.delete(promptId);
}
