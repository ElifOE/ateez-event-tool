# Photobooth

Stilisierte "Personal"-Fotos für ein Fan-Event-Lanyard: Foto aufnehmen/hochladen, einen von mehreren Stilen wählen, per ComfyUI generieren lassen.

Ausführliche Architektur-Begründungen (warum Node/Express, warum Polling statt nur WebSocket im Frontend, ComfyUI-Workflow-Aufbau etc.) stehen in [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md) und [`FRONTEND_CONTEXT-md`](./FRONTEND_CONTEXT-md). Dieses README ist die Kurzfassung zum Starten/Benutzen.

## Setup

1. **ComfyUI muss laufen** (lokal, Port 8000 standardmäßig) — siehe `PROJECT_CONTEXT.md` für die Workflow-Details.
2. Backend-Abhängigkeiten installieren:
   ```
   cd backend
   npm install
   ```
3. `.env` aus `.env.example` erstellen und ausfüllen (insbesondere `ADMIN_SECRET` ändern — das ist das Passwort für den Admin-Bereich).

## Starten

```
cd backend
npm run dev          # Backend auf http://localhost:3000
```

Frontend: `frontend/index.html` über einen lokalen statischen Server öffnen (z.B. VS Code "Live Server" — **direkt die Datei**, nicht den Workspace-Root öffnen, sonst landet man in einer Verzeichnisliste statt der Seite).

## Stile verwalten (Admin-Bereich)

`frontend/admin.html` öffnen (gleicher lokaler Server wie `index.html`), mit dem in `.env` gesetzten `ADMIN_SECRET` einloggen.

Dort lassen sich:
- Stile anlegen/bearbeiten/löschen (Name, IPAdapter-Gewicht, ControlNet-Stärke, Denoise, Seed)
- Referenzbilder direkt aus dem Browser hochladen (landen automatisch in ComfyUI's Input-Ordner — kein manuelles Hochladen über die ComfyUI-GUI mehr nötig)
- Globale ComfyUI-Workflow-Parameter ändern (KSampler: Steps, CFG, Sampler, Scheduler) — gelten für alle Stile

**Sicherheitshinweis:** Der Passwortschutz ist bewusst einfach (ein geteiltes Secret per Header, kein Hashing, keine echte Session-Verwaltung). Das reicht als Zugriffsbremse für den lokalen Uni-Projekt-Einsatz, ist aber **keine echte Absicherung** — nicht ungeschützt ins Internet stellen.

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
- `/admin/*` — siehe oben, passwortgeschützt

Die Fortschrittsanzeige funktioniert intern über eine dauerhafte WebSocket-Verbindung des Backends zu ComfyUI (`comfy-ws.js`) — das Frontend selbst pollt weiterhin nur ganz normal per REST, keine WebSocket-Komplexität im Browser nötig.

## Integration in ein übergeordnetes Tool

Die Backend-URL ist im Frontend überschreibbar:
```html
<script>
  window.PHOTOBOOTH_CONFIG = { backendUrl: "http://anderer-host:4000" };
</script>
<script src="app.js"></script>
```
Ohne diese Konfiguration wird `http://localhost:3000` verwendet (aktueller Stand). Das gilt für `app.js` und `admin.js` gleichermaßen.

**Was es (bewusst) nicht gibt:** keine Plugin-Schnittstelle, kein `postMessage`-Protokoll zwischen Modul und übergeordnetem Tool. Die Integration läuft über Einbettung der `index.html` (z.B. iframe oder Link) plus der obigen Backend-URL-Konfiguration — mehr ist für den aktuellen Projektstand nicht nötig.

CORS ist aktuell komplett offen (`cors()` ohne Optionen) — für den lokalen Einsatz auf einem Laptop unkritisch, bei einem produktiveren Einsatz sollte das eingeschränkt werden.

## Bekannte Grenzen (bewusst, siehe PROJECT_CONTEXT.md)

- Kein Produktionsbetrieb vorgesehen (kein Auto-Restart, keine Lastverteilung, keine Content-Moderation)
- Admin-Passwortschutz ist kein echter Security-Mechanismus
- `styles.json`/`settings.json` sind einfache Dateien ohne nebenläufige Zugriffssicherung (reicht für Einzelnutzung)
