// Settings-Panel: Stile verwalten (Anyteez-Referenzbild + Prompt-Text pro
// Stil) plus Umschalten in/aus dem Settings-Modus. Ehemals admin.html/
// admin.js/admin.css als eigene Seite - jetzt Teil von index.html, damit
// man Einstellungen direkt an Kamera/Stilauswahl auf derselben Seite testen
// kann (siehe Plan). BACKEND_URL wird bereits von app.js deklariert (beide
// Skripte teilen sich denselben globalen Scope) und hier weiterverwendet.

const SETTINGS_MODE_STORAGE_KEY = "photoboothSettingsMode";

const styleEditor = document.getElementById("style-editor");

const appRoot = document.getElementById("app");
const settingsToggleInput = document.getElementById("settings-toggle");

// --- Settings-Modus ein-/ausschalten ----------------------------------------
// Ein einziger Toggle-Schalter statt zweier getrennter Links schaltet den
// Settings-Modus in beide Richtungen um.

settingsToggleInput.addEventListener("change", () => {
  if (settingsToggleInput.checked) {
    enterSettingsMode();
  } else {
    exitSettingsMode();
  }
});

function enterSettingsMode() {
  appRoot.classList.add("settings-mode");
  sessionStorage.setItem(SETTINGS_MODE_STORAGE_KEY, "1");
  window.photobooth.renderStylePanels();
  triggerCanvasResize();
  loadAdminStyles();
}

function exitSettingsMode() {
  appRoot.classList.remove("settings-mode");
  sessionStorage.removeItem(SETTINGS_MODE_STORAGE_KEY);
  window.photobooth.renderStylePanels();
  triggerCanvasResize();
}

// Falls die Seite waehrend des Settings-Modus neu geladen wird (z.B. durch
// Live-Reload-Tools, die auf Backend-Dateien reagieren - siehe
// .vscode/settings.json), bleibt der Modus sonst nur im Toggle-Schalter
// "haengen" (Browser stellt Checkbox-Zustaende nach einem Reload oft wieder
// her), waehrend die Seite selbst in den Normalmodus zurueckfaellt. Hier
// wird der Settings-Modus daher beim Laden wiederhergestellt, falls er vor
// dem Reload aktiv war.
if (sessionStorage.getItem(SETTINGS_MODE_STORAGE_KEY)) {
  settingsToggleInput.checked = true;
  enterSettingsMode();
}

// Die Kamera-Spalte aendert beim Moduswechsel ihre Groesse, aber sketch.js
// reagiert nur auf echte window-Resize-Events (kein ResizeObserver) - ein
// synthetisches Resize-Event loest p5's windowResized() trotzdem aus, ohne
// sketch.js selbst anfassen zu muessen.
function triggerCanvasResize() {
  window.dispatchEvent(new Event("resize"));
}

// Kein Login-Schritt mehr davor - einfache fetch-Hilfsfunktion, die nur
// noch die BACKEND_URL/Pfad-Zusammensetzung fuer /admin/* uebernimmt.
async function adminFetch(path, options = {}) {
  return fetch(`${BACKEND_URL}/admin${path}`, options);
}

// --- Stile -----------------------------------------------------------------
// Kein eigenes Stile-Grid mehr - welcher Stil bearbeitet wird, waehlt man
// direkt ueber die Stil-Thumbnails links neben der Kamera (app.js), die im
// Settings-Modus alle Stile + eine "+"-Kachel anzeigen. Die oeffentliche
// GET /styles-Route (fuer diese Thumbnails) liefert bewusst nur id/name/
// thumbnail (siehe server.js) - fuer das Editor-Formular (seed/promptText/
// anyteezReferenceImage) wird hier weiterhin GET /admin/styles genutzt und
// als Lookup-Cache gehalten statt in einem eigenen Grid gerendert.

let adminStylesById = new Map();
let selectedAdminStyle = null;
let creatingNewStyle = false;

async function loadAdminStyles() {
  const response = await adminFetch("/styles");
  const styles = await response.json();
  adminStylesById = new Map(styles.map((style) => [style.id, style]));

  if (!creatingNewStyle) {
    selectedAdminStyle = adminStylesById.get(window.photobooth.selectedStyleId) || null;
  }
  renderStyleEditor();

  // Haelt die Stilauswahl-Spalte (Besucher-Seite) synchron, damit
  // Aenderungen sofort testbar sind, ohne die Seite neu zu laden.
  window.photobooth.loadStyles();
}

// Baut die URL zum Anzeigen eines in ComfyUI liegenden Bildes (Referenzbild
// = gleichzeitig das Vorschaubild, siehe Plan "Schema-Vereinfachung").
// type=input, weil Referenzbilder in ComfyUI's Input-Ordner liegen (nicht
// im Output-Ordner wie generierte Ergebnisse) - die bestehende GET /image
// Proxy-Route funktioniert fuer beide gleich, nur der type-Parameter unterscheidet sich.
function referenceImageUrl(filename) {
  const params = new URLSearchParams({ filename, subfolder: "", type: "input" });
  return `${BACKEND_URL}/image?${params.toString()}`;
}

// Hooks, die app.js beim Klick auf ein Stil-Thumbnail bzw. die "+"-Kachel
// aufruft (siehe createStyleThumb/createAddStyleTile in app.js).
window.photobooth.onStyleSelected = (styleId) => {
  creatingNewStyle = false;
  selectedAdminStyle = adminStylesById.get(styleId) || null;
  renderStyleEditor();
};

window.photobooth.onAddStyleTileClicked = () => {
  creatingNewStyle = true;
  selectedAdminStyle = null;
  renderStyleEditor();
};

function renderStyleEditor() {
  styleEditor.innerHTML = "";

  if (creatingNewStyle) {
    styleEditor.appendChild(buildAddStyleForm());
    return;
  }

  if (!selectedAdminStyle) {
    styleEditor.innerHTML = '<p class="hint">Stil links auswählen oder mit "+" einen neuen anlegen.</p>';
    return;
  }

  styleEditor.appendChild(buildEditStyleForm(selectedAdminStyle));
}

function buildEditStyleForm(style) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
    <form class="edit-style-form">
      <label>Name <input type="text" name="name" value="${style.name}" required /></label>
      <label>Seed <input type="number" name="seed" value="${style.seed}" /></label>
      <label class="wide">Prompt-Text (steuert Position/Beschreibung des Anyteez-Charakters)
        <textarea name="promptText" rows="3">${style.promptText || ""}</textarea>
      </label>
      <button type="submit">Speichern</button>
      <button type="button" class="danger delete-style-button">Löschen</button>
    </form>
    <label>Anyteez-Referenzbild ersetzen <input type="file" accept="image/*" class="reference-image-input" /></label>
    <p class="reference-status">
      ${
        style.anyteezReferenceImage
          ? `<img class="reference-thumb" src="${referenceImageUrl(style.anyteezReferenceImage)}" alt="${style.name}" /> Aktuell: ${style.anyteezReferenceImage}`
          : "Noch kein Referenzbild hochgeladen"
      }
    </p>
  `;

  wrapper.querySelector(".edit-style-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    await adminFetch(`/styles/${style.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(formData)),
    });
    loadAdminStyles();
  });

  wrapper.querySelector(".delete-style-button").addEventListener("click", async () => {
    if (!confirm(`Stil "${style.name}" wirklich löschen?`)) return;
    await adminFetch(`/styles/${style.id}`, { method: "DELETE" });
    window.photobooth.selectedStyleId = null;
    selectedAdminStyle = null;
    loadAdminStyles();
  });

  wrapper.querySelector(".reference-image-input").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("image", file);
    await adminFetch(`/styles/${style.id}/reference-image`, { method: "POST", body: formData });
    loadAdminStyles();
  });

  return wrapper;
}

function buildAddStyleForm() {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
    <form id="add-style-form">
      <label>Name <input type="text" name="name" required /></label>
      <label>Anyteez-Referenzbild <input type="file" name="image" accept="image/*" /></label>
      <label>Seed <input type="number" name="seed" value="12345" /></label>
      <label class="wide">Prompt-Text (steuert Position/Beschreibung des Anyteez-Charakters)
        <textarea name="promptText" rows="3"></textarea>
      </label>
      <button type="submit">Stil anlegen</button>
    </form>
  `;

  wrapper.querySelector("#add-style-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);

    // Datei separat behandeln: POST /admin/styles erwartet JSON (kein
    // Multipart), das Bild geht danach ueber die bereits vorhandene
    // POST /admin/styles/:id/reference-image - kein neuer Endpunkt noetig.
    const imageFile = formData.get("image");
    formData.delete("image");

    const response = await adminFetch("/styles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(formData)),
    });
    const newStyle = await response.json();

    if (imageFile && imageFile.size > 0) {
      const imageFormData = new FormData();
      imageFormData.append("image", imageFile);
      await adminFetch(`/styles/${newStyle.id}/reference-image`, {
        method: "POST",
        body: imageFormData,
      });
    }

    creatingNewStyle = false;
    window.photobooth.selectedStyleId = newStyle.id;
    loadAdminStyles();
  });

  return wrapper;
}
