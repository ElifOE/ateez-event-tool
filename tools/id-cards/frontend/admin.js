// Admin-Panel: Stile verwalten (Anyteez-Referenzbild + Prompt-Text pro Stil).
// Eigene Seite/Skript (siehe Plan Schritt 2), damit index.html/app.js fuer
// Event-Besucher unveraendert simpel bleiben.

// Konfigurierbar wie in app.js, fuer Integrationsfaehigkeit (siehe Schritt 3).
const BACKEND_URL = window.PHOTOBOOTH_CONFIG?.backendUrl || "http://localhost:3000";

const SECRET_STORAGE_KEY = "photoboothAdminSecret";

const loginSection = document.getElementById("login-section");
const loginForm = document.getElementById("login-form");
const loginSecretInput = document.getElementById("login-secret");
const loginError = document.getElementById("login-error");
const adminSection = document.getElementById("admin-section");
const stylesGrid = document.getElementById("styles-grid");
const styleEditor = document.getElementById("style-editor");

// Zentrale fetch-Hilfsfunktion: haengt das Secret als Header an, und wirft
// bei 401 das gespeicherte Secret weg, damit erneut eingeloggt werden muss.
async function adminFetch(path, options = {}) {
  const response = await fetch(`${BACKEND_URL}/admin${path}`, {
    ...options,
    headers: {
      ...options.headers,
      "X-Admin-Secret": sessionStorage.getItem(SECRET_STORAGE_KEY) || "",
    },
  });

  if (response.status === 401) {
    sessionStorage.removeItem(SECRET_STORAGE_KEY);
    showLogin();
    throw new Error("Nicht autorisiert");
  }

  return response;
}

function showLogin() {
  loginSection.classList.remove("hidden");
  adminSection.classList.add("hidden");
}

function showAdmin() {
  loginSection.classList.add("hidden");
  adminSection.classList.remove("hidden");
  loadStyles();
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  sessionStorage.setItem(SECRET_STORAGE_KEY, loginSecretInput.value);

  try {
    const response = await adminFetch("/styles");
    if (!response.ok) throw new Error();
    loginError.classList.add("hidden");
    showAdmin();
  } catch {
    sessionStorage.removeItem(SECRET_STORAGE_KEY);
    loginError.classList.remove("hidden");
  }
});

// --- Stile -----------------------------------------------------------------
// Grid aus Vorschaubildern (ein Tile pro Stil + ein "+"-Tile) statt einer
// Liste. Klick auf ein Tile zeigt dessen Einstellungen in #style-editor;
// das "+"-Tile zeigt dort statt eines Stils das "Neuen Stil anlegen"-Formular.

let currentStyles = [];
let selectedStyleId = null;
let creatingNewStyle = false;

async function loadStyles() {
  const response = await adminFetch("/styles");
  currentStyles = await response.json();
  renderStylesGrid();
  renderStyleEditor();
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

function renderStylesGrid() {
  stylesGrid.innerHTML = "";

  currentStyles.forEach((style) => {
    const tile = document.createElement("div");
    tile.className = "style-tile" + (style.id === selectedStyleId ? " selected" : "");
    tile.title = style.name;
    tile.innerHTML = style.anyteezReferenceImage
      ? `<img src="${referenceImageUrl(style.anyteezReferenceImage)}" alt="${style.name}" />`
      : style.name;

    tile.addEventListener("click", () => {
      selectedStyleId = style.id;
      creatingNewStyle = false;
      renderStylesGrid();
      renderStyleEditor();
    });

    stylesGrid.appendChild(tile);
  });

  const addTile = document.createElement("div");
  addTile.className = "style-tile add-tile" + (creatingNewStyle ? " selected" : "");
  addTile.title = "Neuen Stil anlegen";
  addTile.textContent = "+";
  addTile.addEventListener("click", () => {
    creatingNewStyle = true;
    selectedStyleId = null;
    renderStylesGrid();
    renderStyleEditor();
  });
  stylesGrid.appendChild(addTile);
}

function renderStyleEditor() {
  styleEditor.innerHTML = "";

  if (creatingNewStyle) {
    styleEditor.appendChild(buildAddStyleForm());
    return;
  }

  const style = currentStyles.find((s) => s.id === selectedStyleId);
  if (!style) {
    styleEditor.innerHTML = '<p class="hint">Stil oben auswählen oder mit "+" einen neuen anlegen.</p>';
    return;
  }

  styleEditor.appendChild(buildEditStyleForm(style));
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
    loadStyles();
  });

  wrapper.querySelector(".delete-style-button").addEventListener("click", async () => {
    if (!confirm(`Stil "${style.name}" wirklich löschen?`)) return;
    await adminFetch(`/styles/${style.id}`, { method: "DELETE" });
    selectedStyleId = null;
    loadStyles();
  });

  wrapper.querySelector(".reference-image-input").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("image", file);
    await adminFetch(`/styles/${style.id}/reference-image`, { method: "POST", body: formData });
    loadStyles();
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
    selectedStyleId = newStyle.id;
    loadStyles();
  });

  return wrapper;
}

// Beim Laden pruefen, ob noch ein gueltiges Secret aus einer frueheren
// Sitzung gespeichert ist (sessionStorage - geht beim Schliessen des Tabs
// verloren, bewusst kein dauerhaftes Login fuer den Kiosk-Einsatz).
if (sessionStorage.getItem(SECRET_STORAGE_KEY)) {
  adminFetch("/styles")
    .then((response) => (response.ok ? showAdmin() : showLogin()))
    .catch(() => showLogin());
} else {
  showLogin();
}
