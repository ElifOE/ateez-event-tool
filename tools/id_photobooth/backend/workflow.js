import { readFile } from "node:fs/promises";

// Laedt die Workflow-Template-JSON von der Platte.
// Eigene Funktion statt direkt in buildWorkflow eingebaut, damit das Template
// auch unabhaengig (z.B. in einem Testskript) geladen werden kann.
export async function loadWorkflowTemplate(path = "./photobooth-template.json") {
  const raw = await readFile(path, "utf-8");
  return JSON.parse(raw);
}

// Sucht einen Node anhand von _meta.title statt der numerischen Node-ID.
// Begruendung (siehe PROJECT_CONTEXT.md): Node-IDs koennen sich bei einem
// Re-Export des Workflows aendern, die Titel sind die stabile Referenz.
function findNodeByTitle(workflow, title) {
  const entry = Object.values(workflow).find(
    (node) => node._meta?.title === title
  );
  if (!entry) {
    throw new Error(`Node mit Titel "${title}" nicht im Workflow gefunden`);
  }
  return entry;
}

// Wie findNodeByTitle, gibt aber die Node-ID selbst zurueck statt des Nodes.
// Gebraucht, um im /history-Response von ComfyUI (der nach Node-ID statt
// Titel strukturiert ist) das Ergebnis des OUTPUT-Nodes wiederzufinden.
export function findNodeIdByTitle(workflow, title) {
  const entry = Object.entries(workflow).find(
    ([, node]) => node._meta?.title === title
  );
  if (!entry) {
    throw new Error(`Node mit Titel "${title}" nicht im Workflow gefunden`);
  }
  return entry[0];
}

// Liefert eine Node-ID -> Titel-Zuordnung fuer den ganzen Workflow.
// Gebraucht fuer die Fortschrittsanzeige (comfy-ws.js): ComfyUI's
// progress_state-Events liefern nur Node-IDs, keine Titel - hier wird die
// Umkehrung von findNodeIdByTitle gebraucht, fuer alle Nodes auf einmal.
export function buildNodeTitleMap(workflow) {
  return Object.fromEntries(
    Object.entries(workflow).map(([id, node]) => [id, node._meta?.title ?? node.class_type])
  );
}

// Baut aus dem Template + Foto-Dateiname + Style-Objekt einen konkreten,
// versandfertigen Workflow. Arbeitet auf einer Kopie (structuredClone),
// damit das geladene Template wiederverwendbar bleibt und nicht durch
// vorherige Aufrufe veraendert ist.
//
// Fuer den Anyteez/Flux.2-Workflow (siehe PROJECT_CONTEXT.md, "WICHTIGES
// UPDATE: Workflow-Wechsel") gibt es nur noch 4 Stellen zum Befuellen -
// die alten SDXL-spezifischen Zuweisungen (IPAdapter-Gewicht, ControlNet-
// Staerke, KSampler denoise/steps/cfg/sampler/scheduler) sind ersatzlos
// entfallen, da der neue Graph keine entsprechenden Nodes mehr hat.
export function buildWorkflow(template, { inputPhotoFilename, style }) {
  const workflow = structuredClone(template);

  findNodeByTitle(workflow, "INPUT_PHOTO").inputs.image = inputPhotoFilename;
  findNodeByTitle(workflow, "ANYTEEZ_REFERENCE").inputs.image =
    style.anyteezReferenceImage;
  findNodeByTitle(workflow, "PROMPT").inputs.text = style.promptText;

  // Einziger Seed-Eingang im neuen Graph (ersetzt das alte KSampler.seed).
  findNodeByTitle(workflow, "RandomNoise").inputs.noise_seed = style.seed;

  return workflow;
}
