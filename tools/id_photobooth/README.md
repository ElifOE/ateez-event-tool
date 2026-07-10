# Photobooth

Stilisierte "Personal"-Fotos für ein Fan-Event-Lanyard: Foto aufnehmen/hochladen, einen von mehreren Stilen wählen, per ComfyUI generieren lassen.

Dieses README ist die Kurzfassung zum Starten/Benutzen.    
Achtung es kann sein, dass man kein Bild generieren lassen kann, dann entweder die Seite reloaden oder das backend neu starten (strg+c danach npm run dev) (dafür gibt es soweit keinen erkennbaren Auslöser, falls doch gefunden, gerne Rückmeldung)

## Voraussetzungen (frisch geklont, neues Gerät)

- **Node.js** (LTS, z.B. v18 oder neuer — das Backend nutzt ESM-Module und `node --watch`).
- **ComfyUI** lokal installiert und startbar, mit folgenden Modellen (Download-Links siehe Markdown-Note im Original-ComfyUI-Workflow bzw. offizielle Comfy-Org/Black-Forest-Labs-Repos auf HuggingFace, siehe auch `PROJECT_CONTEXT.md`):
  - `flux-2-klein-4b-fp8.safetensors` → `models/diffusion_models/`
  - `qwen_3_4b.safetensors` → `models/text_encoders/`
  - `flux2-vae.safetensors` → `models/vae/`

  ComfyUI muss während Backend-Nutzung durchgehend laufen (Server gestartet, nicht nur die Desktop-App im Hintergrund). Standardport ist 8000, kann aber abweichen — im ComfyUI-Terminal-Log die Zeile `To see the GUI go to: ...` prüfen.    
  Flux2-Klein_00198_.png hat den Workflow gespeichert und kann als Kontrolle des Workflows verwendet werden. Das png ist nicht repräsentativ für die Outputs des Tools.
- **Browser mit Webcam-Zugriff.** `index.html` muss über `http://` (localhost oder ein anderer Host) geöffnet werden, nicht per Doppelklick als `file://` — sonst blockieren die meisten Browser `getUserMedia` (Kamera-Zugriff) und CORS-Requests ans Backend. Ein lokaler statischer Server reicht, z.B. VS Code "Live Server".

## Setup (nach dem Klonen)

1. ComfyUI starten und offen lassen.
2. Backend-Abhängigkeiten installieren:
   ```
   cd backend
   npm install
   ```
3. `.env` aus `.env.example` erstellen und ausfüllen (`PORT`, `COMFYUI_BASE_URL` — Standardwerte passen meist, `COMFYUI_BASE_URL` ggf. an den tatsächlichen ComfyUI-Port anpassen).
4. **Anyteez-Referenzbilder in ComfyUI hochladen.** `styles.json` ist bereits mit 8 fertigen Stilen (Namen + Prompts) im Repo vorhanden, verweist dabei aber nur per Dateiname (z.B. `Bbyongming.png`) auf Charakterbilder — die Bilddateien selbst liegen in ComfyUI's eigenem Input-Ordner (maschinenspezifisch, nicht Teil dieses Repos) und müssen auf einem neuen Gerät einmalig dorthin hochgeladen werden. Zwei Wege:
   - Über die Einstellungen im laufenden Frontend (siehe unten) pro Stil ein Referenzbild hochladen — landet automatisch am richtigen Ort.
   - Oder alle Bilder in `backend/style-references/` ablegen und `npm run upload-styles` ausführen (lädt sie in einem Rutsch zu ComfyUI hoch, Dateinamen danach ggf. manuell in `styles.json` abgleichen).
5. **Falls VS Code "Live Server" zum Ausliefern des Frontends genutzt wird:** Live Server beobachtet standardmäßig auch das `backend/`-Verzeichnis und löst bei jedem Backend-Dateischreibvorgang (z.B. Stil speichern, generiertes Foto ablegen) einen ungewollten Browser-Reload aus. Empfehlung: in `.vscode/settings.json` (lokal, wird nicht mitgeklont, da `.vscode/` global gitignored ist) ergänzen:
   ```json
   {
     "liveServer.settings.ignoreFiles": ["photobooth/backend/**"]
   }
   ```

## Starten

```
cd backend
npm run dev          # Backend auf http://localhost:3000
```

Frontend: `frontend/index.html` über einen lokalen statischen Server öffnen (z.B. VS Code "Live Server" — **direkt die Datei**, nicht den Workspace-Root öffnen, sonst landet man in einer Verzeichnisliste statt der Seite).

## Stile verwalten (Einstellungen)

In `frontend/index.html` oben rechts auf "Einstellungen" klicken (kein separater Seitenaufruf, kein Login mehr nötig).

Dort lassen sich:
- Stile anlegen/bearbeiten/löschen (Name, Seed, Prompt-Text für die Anyteez-Charakterposition)
- Referenzbilder direkt aus dem Browser hochladen (landen automatisch in ComfyUI's Input-Ordner — kein manuelles Hochladen über die ComfyUI-GUI mehr nötig)

**Hinweis:** `/admin/*` ist nicht mehr passwortgeschützt (Login-Schritt wurde bewusst entfernt) — für den lokalen Uni-Projekt-Einsatz unkritisch, aber nicht ungeschützt ins Internet stellen.

Alternative für Massen-Upload von Referenzbildern (z.B. alle auf einmal vorbereiten, bevor die Stile im Admin-Panel angelegt werden): Bilder in `backend/style-references/` legen, dann `npm run upload-styles` ausführen.

## Architektur-Kurzüberblick

```
Frontend (p5.js, plain HTML/JS)
   |  Kamera/Upload -> Stil waehlen -> POST /generate
   v
Backend (Node/Express)
   |  laedt Foto zu ComfyUI hoch, baut Workflow-JSON aus Template + Style-Parametern,
   |  schickt an ComfyUI, pollt/WebSocket fuer Fortschritt+Ergebnis
   v
ComfyUI (lokal, Port 8000)
```

Backend-Endpunkte:
- `GET /styles` — öffentliche Stilliste fürs Frontend
- `POST /generate` — Foto + styleId, startet ComfyUI-Job
- `GET /status/:jobId` — Status inkl. Fortschritts-Info (`currentStep`, `stepIndex`/`totalSteps`, ggf. Sub-Fortschritt) während der Verarbeitung
- `GET /image` — Proxy fürs generierte Bild (ComfyUI blockt direkte Browser-Zugriffe per CORS/Referer-Check)
- `/admin/*` — siehe oben, kein Passwortschutz mehr

Die Fortschrittsanzeige funktioniert intern über eine dauerhafte WebSocket-Verbindung des Backends zu ComfyUI (`comfy-ws.js`) — das Frontend selbst pollt weiterhin nur ganz normal per REST, keine WebSocket-Komplexität im Browser nötig.

## Integration in ein übergeordnetes Tool

Die Backend-URL ist im Frontend überschreibbar:
```html
<script>
  window.PHOTOBOOTH_CONFIG = { backendUrl: "http://anderer-host:4000" };
</script>
<script src="app.js"></script>
```
Ohne diese Konfiguration wird `http://localhost:3000` verwendet (aktueller Stand). Das gilt für `app.js` und `settings.js` gleichermaßen.

**Was es (bewusst) nicht gibt:** keine Plugin-Schnittstelle, kein `postMessage`-Protokoll zwischen Modul und übergeordnetem Tool. Die Integration läuft über Einbettung der `index.html` (z.B. iframe oder Link) plus der obigen Backend-URL-Konfiguration — mehr ist für den aktuellen Projektstand nicht nötig.

CORS ist aktuell komplett offen (`cors()` ohne Optionen) — für den lokalen Einsatz auf einem Laptop unkritisch, bei einem produktiveren Einsatz sollte das eingeschränkt werden.

## Bekannte Grenzen (bewusst, siehe PROJECT_CONTEXT.md)

- Kein Produktionsbetrieb vorgesehen (kein Auto-Restart, keine Lastverteilung, keine Content-Moderation)
- `/admin/*` ist ungeschützt zugänglich (kein Login mehr)
- `styles.json`/`settings.json` sind einfache Dateien ohne nebenläufige Zugriffssicherung (reicht für Einzelnutzung)
