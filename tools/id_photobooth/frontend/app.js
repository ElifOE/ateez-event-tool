// Schritt 3: Stile vom Backend laden, Thumbnails dynamisch rendern,
// Auswahl-Klick-Logik. Bewusst getrennt von sketch.js (das nur die
// Kamera/Canvas-Seite betrifft) - hier geht es um DOM/Backend, nicht p5.

// Backend laeuft separat lokal auf Port 3000 (siehe photobooth/backend).
// Ueberschreibbar via window.PHOTOBOOTH_CONFIG.backendUrl, damit ein
// kuenftiges uebergeordnetes Tool dieses Modul per eigenem Inline-Script auf
// einen anderen Host/Port zeigen lassen kann, ohne diese Datei anzufassen
// (siehe README "Integration"). Ohne das: Fallback wie bisher.
const BACKEND_URL = window.PHOTOBOOTH_CONFIG?.backendUrl || "http://localhost:3000";

// Gemeinsamer State, den auch spaetere Schritte (POST /generate) brauchen.
// Einfaches globales Objekt statt Module/Imports, da alle Scripts hier
// als klassische <script>-Tags ohne Bundler eingebunden sind.
// "||= {}" statt "=", da sketch.js denselben Container nutzt (captureSnapshot)
// und je nach Ladezeitpunkt zuerst oder zuletzt schreibt.
window.photobooth = window.photobooth || {};
window.photobooth.selectedStyleId = null;
window.photobooth.capturedPhotoBlob = null;

// Einmalig geladene Stile werden hier gecacht, damit ein Wechsel in den
// Settings-Modus (und zurueck) die Panels neu anordnen kann, ohne erneut
// beim Backend nachzufragen (siehe renderStylePanels).
window.photobooth.allStyles = [];

async function loadStyles() {
  const leftPanel = document.getElementById("style-panel-left");

  try {
    const response = await fetch(`${BACKEND_URL}/styles`);
    if (!response.ok) {
      throw new Error(`Backend antwortete mit ${response.status}`);
    }
    window.photobooth.allStyles = await response.json();
    renderStylePanels();
  } catch (err) {
    console.error("Stile konnten nicht geladen werden:", err);
    leftPanel.textContent = "Stile konnten nicht geladen werden";
  }
}

// Verteilt die gecachten Stile auf die Panels - im Settings-Modus alle
// (2-spaltig wie gewohnt, siehe .style-panel in style.css) in die linke
// Spalte plus eine "+"-Kachel zum Anlegen, sonst wie bisher haelftig auf
// links/rechts gesplittet.
function renderStylePanels() {
  const leftPanel = document.getElementById("style-panel-left");
  const rightPanel = document.getElementById("style-panel-right");
  const previouslySelectedId = window.photobooth.selectedStyleId;

  leftPanel.innerHTML = "";
  rightPanel.innerHTML = "";

  const styles = window.photobooth.allStyles;
  const inSettingsMode = document.getElementById("app").classList.contains("settings-mode");

  if (inSettingsMode) {
    styles.forEach((style) => leftPanel.appendChild(createStyleThumb(style)));
    leftPanel.appendChild(createAddStyleTile());
  } else {
    // Erste Haelfte links, zweite Haelfte rechts - funktioniert fuer
    // beliebige Stilanzahl, nicht nur fest "4 und 4".
    const splitIndex = Math.ceil(styles.length / 2);
    styles.slice(0, splitIndex).forEach((style) => leftPanel.appendChild(createStyleThumb(style)));
    styles.slice(splitIndex).forEach((style) => rightPanel.appendChild(createStyleThumb(style)));
  }

  // Auswahl-Highlight ueber den Re-Render hinweg erhalten, da
  // createStyleThumb bei jedem Aufruf neue Elemente erzeugt.
  if (previouslySelectedId != null) {
    document
      .querySelectorAll(`.style-thumb[data-style-id="${previouslySelectedId}"]`)
      .forEach((el) => el.classList.add("selected"));
  }
}

window.photobooth.loadStyles = loadStyles;
window.photobooth.renderStylePanels = renderStylePanels;

function createStyleThumb(style) {
  const thumb = document.createElement("div");
  thumb.className = "style-thumb";
  thumb.dataset.styleId = style.id;

  if (style.thumbnail) {
    // style.thumbnail ist das Referenzbild, liegt in ComfyUI's Input-Ordner -
    // ueber die bestehende GET /image Proxy-Route geladen (dieselbe Route,
    // die auch fertige Ergebnisbilder ausliefert, nur mit type=input).
    const img = document.createElement("img");
    const params = new URLSearchParams({ filename: style.thumbnail, subfolder: "", type: "input" });
    img.src = `${BACKEND_URL}/image?${params.toString()}`;
    img.alt = style.name;
    thumb.appendChild(img);
  } else {
    // Noch kein Referenzbild fuer diesen Stil hochgeladen - Name als
    // Platzhalter, damit Auswahl/Klick trotzdem moeglich ist.
    const label = document.createElement("span");
    label.textContent = style.name;
    thumb.appendChild(label);
  }

  thumb.addEventListener("click", () => selectStyle(thumb, style));

  return thumb;
}

// "+"-Kachel zum Anlegen eines neuen Stils - nur im Settings-Modus sichtbar
// (siehe renderStylePanels). Nutzt dieselbe .style-thumb-Optik wie die
// normalen Thumbnails, damit sie sich ins 2-spaltige Panel einreiht.
function createAddStyleTile() {
  const tile = document.createElement("div");
  tile.className = "style-thumb add-tile";
  tile.title = "Neuen Stil anlegen";
  tile.textContent = "+";

  tile.addEventListener("click", () => {
    document
      .querySelectorAll(".style-thumb.selected")
      .forEach((el) => el.classList.remove("selected"));
    tile.classList.add("selected");
    window.photobooth.selectedStyleId = null;

    if (window.photobooth.onAddStyleTileClicked) {
      window.photobooth.onAddStyleTileClicked();
    }
  });

  return tile;
}

function selectStyle(thumbElement, style) {
  document
    .querySelectorAll(".style-thumb.selected")
    .forEach((el) => el.classList.remove("selected"));

  thumbElement.classList.add("selected");
  window.photobooth.selectedStyleId = style.id;

  // Hook fuer settings.js: zeigt im Settings-Modus den Bearbeiten-Editor
  // fuer den angeklickten Stil. Im Normalmodus ist der Hook zwar
  // registriert, aber wirkungslos, da #settings-panel dort unsichtbar ist.
  if (window.photobooth.onStyleSelected) {
    window.photobooth.onStyleSelected(style.id);
  }
}

loadStyles();

// --- Schritt 4: Foto-Snapshot + Upload-Alternative ---------------------

const captureButton = document.getElementById("capture-button");
const uploadButton = document.getElementById("upload-button");
const uploadInput = document.getElementById("upload-input");
const photoPreviewOverlay = document.getElementById("photo-preview-overlay");
const photoPreviewImage = document.getElementById("photo-preview-image");
const retakePhotoButton = document.getElementById("retake-photo-button");
const confirmPhotoButton = document.getElementById("confirm-photo-button");

// Aktuelle Object-URL merken, um sie beim naechsten Foto wieder freizugeben
// (sonst sammeln sich bei mehreren Durchlaeufen unnoetig Blob-URLs an).
let previewObjectUrl = null;

captureButton.addEventListener("click", async () => {
  const blob = await window.photobooth.captureSnapshot();
  showPhotoPreview(blob);
});

uploadButton.addEventListener("click", () => {
  uploadInput.click();
});

uploadInput.addEventListener("change", () => {
  const file = uploadInput.files[0];
  if (!file) return;
  showPhotoPreview(file); // ein File ist ein Blob - gleiche Weiterverarbeitung
  uploadInput.value = ""; // erlaubt erneute Auswahl derselben Datei spaeter
});

function showPhotoPreview(blob) {
  window.photobooth.capturedPhotoBlob = blob;

  if (previewObjectUrl) {
    URL.revokeObjectURL(previewObjectUrl);
  }
  previewObjectUrl = URL.createObjectURL(blob);
  photoPreviewImage.src = previewObjectUrl;

  photoPreviewOverlay.classList.remove("hidden");
}

retakePhotoButton.addEventListener("click", () => {
  window.photobooth.capturedPhotoBlob = null;
  photoPreviewOverlay.classList.add("hidden");
});

confirmPhotoButton.addEventListener("click", () => {
  if (!window.photobooth.selectedStyleId) {
    alert("Bitte zuerst einen Stil auswaehlen.");
    return;
  }

  photoPreviewOverlay.classList.add("hidden");
  startGeneration(window.photobooth.capturedPhotoBlob, window.photobooth.selectedStyleId);
});

// --- Schritt 5: POST /generate + Status-Polling -------------------------

const loadingOverlay = document.getElementById("loading-overlay");
const errorOverlay = document.getElementById("error-overlay");
const errorBackButton = document.getElementById("error-back-button");
const resultOverlay = document.getElementById("result-overlay");
const resultImage = document.getElementById("result-image");
const closeOverlayButton = document.getElementById("close-overlay-button");
const downloadResultButton = document.getElementById("download-result-button");
const loadingStepText = document.getElementById("loading-step-text");
const DEFAULT_LOADING_TEXT = loadingStepText.innerHTML; // fuer den Reset vor jedem neuen Lauf

// Backend-Format ist multipart/form-data mit Feld "photo" (siehe
// server.js: upload.single("photo")) + "styleId" als Text-Feld - exakt
// das, was multer dort erwartet.
async function requestGeneration(photoBlob, styleId) {
  const formData = new FormData();
  formData.append("photo", photoBlob, "photo.png");
  formData.append("styleId", styleId);

  const response = await fetch(`${BACKEND_URL}/generate`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`/generate antwortete mit ${response.status}`);
  }

  const { jobId } = await response.json();
  return jobId;
}

// Pollt GET /status/:jobId in festem Intervall, wie in FRONTEND_CONTEXT.md
// vorgeschlagen (alle 1-2s). maxAttempts begrenzt das Ganze auf ca. 2 Minuten,
// damit bei einem haengenden ComfyUI-Job nicht endlos weitergepollt wird.
async function pollJobStatus(jobId, { intervalMs = 1500, maxAttempts = 80 } = {}) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fetch(`${BACKEND_URL}/status/${jobId}`);
    if (!response.ok) {
      throw new Error(`/status antwortete mit ${response.status}`);
    }
    const result = await response.json();

    if (result.status === "done" || result.status === "error") {
      return result;
    }

    updateLoadingStepText(result);
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error("Zeitlimit beim Warten auf das Ergebnis ueberschritten");
}

// Zeigt den vom Backend gemeldeten Verarbeitungsschritt an (z.B. "Schritt 5
// von 7: KSampler (14/20)"). Faellt auf den urspruenglichen Text mit
// Punkt-Animation zurueck, solange noch keine Fortschrittsdaten da sind
// (z.B. Job steht noch in ComfyUI's Warteschlange).
function updateLoadingStepText(status) {
  if (!status.currentStep) {
    loadingStepText.innerHTML = DEFAULT_LOADING_TEXT;
    return;
  }

  let text = `Schritt ${status.stepIndex} von ${status.totalSteps}: ${status.currentStep}`;
  if (status.subProgress) {
    text += ` (${status.subProgress.value}/${status.subProgress.max})`;
  }
  loadingStepText.textContent = text;
}

async function startGeneration(photoBlob, styleId) {
  loadingStepText.innerHTML = DEFAULT_LOADING_TEXT;
  loadingOverlay.classList.remove("hidden");

  try {
    const jobId = await requestGeneration(photoBlob, styleId);
    const result = await pollJobStatus(jobId);

    loadingOverlay.classList.add("hidden");

    if (result.status === "done") {
      showResult(result.imageUrl);
    } else {
      showError();
    }
  } catch (err) {
    console.error("Fehler bei der Generierung:", err);
    loadingOverlay.classList.add("hidden");
    showError();
  }
}

function showResult(imageUrl) {
  resultImage.src = imageUrl;
  resultOverlay.classList.remove("hidden");
}

function showError() {
  errorOverlay.classList.remove("hidden");
}

function resetForNewRun() {
  window.photobooth.capturedPhotoBlob = null;
  window.photobooth.selectedStyleId = null;
  document
    .querySelectorAll(".style-thumb.selected")
    .forEach((el) => el.classList.remove("selected"));
}

// Download statt einfachem <a href download>: die Bild-URL zeigt auf das
// Backend (Port 3000), die Seite selbst laeuft aber ueber Live Server auf
// einem anderen Port - das macht es aus Browsersicht cross-origin, und das
// download-Attribut wird von Browsern fuer Cross-Origin-Links oft ignoriert
// (es oeffnet das Bild stattdessen nur in einem neuen Tab). Per fetch+Blob
// laedt man die Bytes selbst herunter und erzeugt daraus eine lokale
// blob:-URL (same-origin), bei der das download-Attribut zuverlaessig greift.
downloadResultButton.addEventListener("click", async () => {
  try {
    const response = await fetch(resultImage.src);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `photobooth-${window.photobooth.selectedStyleId || "ergebnis"}.png`;
    link.click();

    URL.revokeObjectURL(blobUrl);
  } catch (err) {
    console.error("Download fehlgeschlagen:", err);
    alert("Download leider fehlgeschlagen.");
  }
});

closeOverlayButton.addEventListener("click", () => {
  resultOverlay.classList.add("hidden");
  resultImage.src = "";
  resetForNewRun();
});

errorBackButton.addEventListener("click", () => {
  errorOverlay.classList.add("hidden");
  resetForNewRun();
});
