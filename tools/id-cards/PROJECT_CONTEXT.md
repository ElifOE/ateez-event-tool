# Projekt: ComfyUI Photobooth für Fan-Event-Tool (Uni-Modul Generative Gestaltung)

## Kontext

Dies ist ein Teilmodul eines größeren generativen Tools für ein **fiktives Fanevent** einer Band, im Rahmen eines Uni-Moduls (Generative Gestaltung). Das Gesamttool gibt einer (fiktiven) Agency die Möglichkeit, Einstellungen für verschiedene vorbereitete Outputs vorzunehmen. Dieses Teilmodul ist ein **Photobooth**: Besucher:innen können ein Foto aufnehmen/hochladen, einen von 8 Stilen (einer pro Bandmitglied) auswählen, und bekommen ein stilisiertes "Personal"-Foto für ein Event-Lanyard zurück.

**Wichtig für alle Entscheidungen:** Das ist ein Uni-Projekt mit ca. 2 Tagen Zeit für diesen Teil, läuft nur lokal auf einem Laptop (RTX 4060 Laptop GPU, 8GB VRAM), muss nur ein paar Testdurchläufe aushalten, **nicht** produktionsreif für echten Eventbetrieb mit hunderten Nutzern sein. Komplexität, die nur für echten Live-Betrieb nötig wäre (Auto-Restart, Lastverteilung, Content-Moderation), ist explizit **out of scope** für jetzt.

## ComfyUI Verbindungsdaten

- **ComfyUI läuft lokal auf Port 8000** (bestätigt: `To see the GUI go to: http://127.0.0.1:8000`). Hinweis für später: dieser Port kann sich ändern, falls eine andere Anwendung ihn belegt und Comfy Desktop auf einen Fallback-Port ausweicht — im Zweifel im ComfyUI-Terminal-Log die Zeile `To see the GUI go to: ...` prüfen.
- Empfehlung fürs Backend: Port nicht hart im Code verdrahten, sondern über eine `.env`-Variable konfigurierbar machen, z.B. `COMFYUI_BASE_URL=http://127.0.0.1:8000` — falls sich der Port zwischen Sessions ändert, reicht eine Zeile Anpassung statt Code-Suche
- Basis-URL fürs Backend: `http://127.0.0.1:8000`
- **Wichtig für die Entwicklung:** ComfyUI Desktop muss während der gesamten Backend-Entwicklung/Testphase geöffnet und der Server gestartet sein (also der eigentliche ComfyUI-Prozess läuft, nicht nur die Desktop-App im Hintergrund). Ohne laufendes ComfyUI schlagen alle Requests ans Backend mit Connection-Fehlern fehl — das ist dann kein Backend-Bug.
- Relevante Endpunkte: `POST /prompt` (Job starten), `GET /history/{prompt_id}` (Status/Ergebnis abfragen), `POST /upload/image` (Bild hochladen), `GET /view?filename=...&type=output` (Ergebnisbild abholen)
- Die Workflow-Template-JSON liegt bereits bereit unter `photobooth-template.json` (extrahiert aus einem erfolgreichen `/history`-Eintrag, NICHT über einen Export-Button — ComfyUI Desktop bot keinen sichtbaren "Export API"-Menüpunkt; die Datei wurde stattdessen direkt aus einer `/history`-Abfrage des erfolgreichen Runs herausgezogen und bereinigt, siehe Hinweise unten)

### Hinweise zur Workflow-Template-JSON

- Ein unbenutzter `IPAdapterUnifiedLoader`-Node wurde entfernt (Überbleibsel vom Umbau auf granulare Nodes, war nicht mehr verbunden)
- Ein `DepthAnythingPreprocessor`-Node ist in der Datei vorhanden, aber aktuell nicht verbunden/genutzt — nur `CannyEdgePreprocessor` ist aktiv im ControlNet-Pfad. Kann ignoriert werden, ist nur ein Test-Überbleibsel.
- Bestätigte, stabile Node-Titel zum Auffinden per `_meta.title` (NICHT nach den numerischen Node-IDs suchen, die können sich bei erneutem Export ändern):
  - `"INPUT_PHOTO"` — `LoadImage`-Node, hier muss der Dateiname des hochgeladenen Nutzerfotos eingesetzt werden
  - `"STYLE_REFERENCE"` — `LoadImage`-Node, hier der Dateiname des Style-Referenzbilds je nach gewähltem Stil
  - `"OUTPUT"` — `SaveImage`-Node, liefert im `/history`-Response unter `outputs["<node_id>"]["images"][0]["filename"]` den Ergebnis-Dateinamen

## WICHTIGES UPDATE: Workflow-Wechsel (Konzept-Pivot)

**Der ursprüngliche Stiltransfer-Ansatz (SDXL + IPAdapter + ControlNet, siehe unten) wurde verworfen.** Grund: Webcam-Input führte zu inkonsistenten Ergebnissen, Gesichter/Identität gingen zu stark verloren — das war für die Abgabe (Output-Konsistenz ist gleichrangig zum Konzept) nicht akzeptabel.

**Neues Konzept:** Statt das Foto der Person stilistisch zu verändern, wird ein **Anyteez-Charakter** (das Cartoon/Plüschtier-Maskottchen des jeweiligen Bandmitglieds) unverändert und im eigenen Cartoon-Stil **in das Foto hinzugefügt** (z.B. auf der Schulter sitzend), während die Person selbst zu 100% unverändert bleibt. Das eliminiert das Hauptrisiko (Identitätsverlust), weil die Person gar nicht mehr durch den Diffusionsprozess verändert wird.

**Neuer technischer Ansatz:** Flux.2 Klein (4B, distilled) mit einem Multi-Reference-Image-Mechanismus (`ReferenceLatent`-Chaining, in einer ComfyUI-Subgraph-Node gekapselt: "Image Edit (Flux.2 Klein 4B Distilled)"). Zwei Referenzbilder (Personenfoto + Anyteez-Bild) werden über verkettete `ReferenceLatent`-Nodes in die Konditionierung eingespeist, kombiniert mit einer expliziten Text-Anweisung, die genau beschreibt, was unverändert bleiben soll und was hinzugefügt werden soll. Dieser Ansatz funktioniert deutlich zuverlässiger als der vorherige IPAdapter-Ansatz, weil Flux-Kontext-artige Modelle tatsächlich Text-Anweisungen befolgen (im Gegensatz zu IPAdapter, das primär Stil/Bildmerkmale unkontrolliert überträgt).

**Warum nicht IPAdapter weiterversucht wurde:** IPAdapter Plus ist für Style-Transfer gebaut, nicht für "exaktes Subjekt/Objekt unverändert einfügen" — verschiedene `weight_type`-Presets wurden getestet (u.a. `linear`, `weak input`), keines lieferte ein erkennbares, unverwaschenes Charakterbild in der Maskenregion (Ergebnis war ein Farbblob bzw. eine leere Fläche).

**Warum nicht Flux Redux:** Redux ist primär für Bildvarianten gedacht, der Text-Prompt hat dabei kaum Steuerungseffekt — das hätte zum gleichen "ganzes Bild wird unkontrolliert verändert"-Problem geführt wie der ursprüngliche Ansatz.

### Aktueller Workflow: Datei `anyteez-template.json`

Extrahiert aus einem erfolgreichen `/history`-Eintrag (kein Export-Button verfügbar, gleiches Vorgehen wie beim ersten Workflow). Stabile Node-Titel zum Auffinden per `_meta.title`:
- `"INPUT_PHOTO"` — `LoadImage`-Node, das Foto der Person (Node-ID `"76"`)
- `"ANYTEEZ_REFERENCE"` — `LoadImage`-Node, das Anyteez-Charakterbild, wechselt je nach gewähltem Stil/Bandmitglied (Node-ID `"81"`)
- `"PROMPT"` — `CLIPTextEncode`-Node mit der Text-Anweisung; dieser Text MUSS pro Stil unterschiedlich befüllbar sein, da er die Position und ggf. charakterspezifische Beschreibung enthält (Node-ID `"92:109"`)
- `"OUTPUT"` — `SaveImage`-Node, liefert das Ergebnisbild (Node-ID `"94"`)

**Wichtige Eigenheit dieser Workflow-Datei:** Mehrere Node-IDs enthalten Doppelpunkte (z.B. `"92:101"`, `"92:112:116"`), weil der Workflow aus einer ComfyUI-Subgraph-Struktur stammt. Das ist rein kosmetisch in der Benennung — diese sind ganz normale, flache Top-Level-Keys im JSON, kein Sonderhandling im Code nötig. Beim Einsetzen von Werten anhand `_meta.title` (wie geplant) spielt das keine Rolle.

**Verwendete Modelle (für Referenz, falls Setup auf anderer Maschine wiederholt werden muss):**
- `flux-2-klein-4b-fp8.safetensors` → `models/diffusion_models/`
- `qwen_3_4b.safetensors` → `models/text_encoders/`
- `flux2-vae.safetensors` → `models/vae/`
- Download-Links stehen im Markdown-Note-Node innerhalb des Original-ComfyUI-Workflows, alle von offiziellen Comfy-Org/Black-Forest-Labs HuggingFace-Repos

**Bewusst noch nicht gelöst / spätere Ausbaustufe:** Die Position des Anyteez-Charakters (z.B. "rechte Schulter") ist aktuell nur als Teil des Prompt-Texts fest hinterlegt, kein eigener API-Parameter. Falls später mehrere Positionen wählbar sein sollen, ist die einfachste Erweiterung: mehrere Prompt-Varianten pro Stil in der `styles.json` hinterlegen, vom Frontend aus zwischen ihnen wählen lassen — keine Architekturänderung nötig.

**Style-Referenzbilder sind freigestellt** (transparenter Hintergrund) — das verbessert die Qualität des Ergebnisses spürbar.

### Auswirkung auf styles.json

Die Struktur ändert sich inhaltlich: statt `styleReferenceImage` (Stilbild für IPAdapter) wird daraus `anyteezReferenceImage` (das Charakterbild), und es kommt ein neues Feld `promptText` hinzu (da der Prompt jetzt pro Stil unterschiedlich ist, nicht mehr fix). Beispiel:

```json
[
  {
    "id": "style-01",
    "name": "Bandmitglied 1",
    "thumbnail": "thumb-01.jpg",
    "anyteezReferenceImage": "member1_anyteez.png",
    "promptText": "add the character from image2 perched on top of the person's right shoulder, the character's body resting on the shoulder with its feet/bottom touching the shoulder surface, it should be roughly a third of the person's head, positioned lower and more to the side, not overlapping the face, keep the person's face, body, clothing and background from image1 completely unchanged, keep the character from image2 in its original cartoon/plush toy art style, do not blend or stylize the character, add a soft natural contact shadow where the character touches the shoulder",
    "seed": 745764332101515
  }
]
```

---

## Ursprünglicher Workflow (VERWORFEN, nur als Referenz)

Der folgende Abschnitt beschreibt den ursprünglichen SDXL/IPAdapter/ControlNet-Ansatz. Dieser wird NICHT mehr verwendet, bleibt aber zur Dokumentation des Entwicklungswegs erhalten.

## Bisheriger Stand: ComfyUI-Workflow (FERTIG UND GETESTET)

Der ComfyUI-Teil läuft bereits erfolgreich. Aufbau:

- **Checkpoint:** SDXL (`sd_xl_base_1.0.safetensors`)
- **Style-Transfer:** IPAdapter Plus (granulare Nodes, NICHT der Unified Loader — der hatte einen Bug mit der CLIP-Vision-Erkennung)
  - `IPAdapterModelLoader` → `ip-adapter-plus_sdxl_vit-h.safetensors`
  - `CLIPVisionLoader` → `CLIP-ViT-H-14-laion2B-s32B.b79K.safetensors` (Achtung: NICHT die bigG-Variante, die ist inkompatibel mit der vit-h IPAdapter-Datei — Embedding-Dimension-Mismatch)
  - `IPAdapterAdvanced` kombiniert Checkpoint-MODEL + IPADAPTER + CLIP_VISION + Style-Referenzbild
- **Strukturerhaltung:** ControlNet (Canny Edge ODER Depth Anything als Preprocessor — im Test wurde mit beidem experimentiert, finale Wahl steht noch nicht 100% fest)
- **Sampling:** Standard KSampler, img2img-Ansatz (`VAEEncode` vom Inputfoto statt EmptyLatentImage)
- **Output:** Standard `SaveImage`

**Wichtige Lektion aus der Einrichtung:** Modelle müssen manuell in die ComfyUI-Model-Ordner kopiert werden (bei Comfy Desktop liegt der tatsächlich aktive Pfad oft unter `Documents\ComfyUI\models\...`, NICHT unter den anderen scheinbaren Pfaden wie `AppData\Local\Comfy-Desktop\ComfyUI-Shared`). Nach jedem Modell-Hinzufügen ist ein kompletter ComfyUI-Neustart nötig.

**Aktueller Tuning-Status:** Workflow läuft technisch fehlerfrei durch, der Stil wird klar erkennbar übertragen. Feinabstimmung der Parameter (`denoise`, IPAdapter `weight`, ControlNet `strength`) für die Balance zwischen "Stil" und "Identität erhalten" ist noch nicht abgeschlossen — das passiert parallel/danach, unabhängig von Backend/Frontend.

## Node-Struktur der Workflow-JSON (API-Format)

Die Workflow wird als ComfyUI "API Format" JSON exportiert. Wichtige Nodes, die das Backend ansprechen muss (Node-IDs können sich bei Re-Export ändern — Backend sollte nach `_meta.title` suchen, nicht nach hartcodierten IDs):

- **Node mit Titel `INPUT_PHOTO`** (Typ `LoadImage`): hier muss das vom Nutzer kommende Foto eingesetzt werden
- **Node mit Titel `STYLE_REFERENCE`** (Typ `LoadImage`): das Stil-Referenzbild — wird vom Backend je nach gewähltem Stil ausgetauscht
- **`SaveImage`-Node** (Titel `OUTPUT`): hier kommt das fertige Bild heraus

Da die 8 Stil-Workflows **strukturell identisch** sind (laut Planung), wird im Backend EIN Workflow-Template + eine `styles.json` mit Override-Werten verwendet (Style-Referenzbild-Dateiname, ggf. abweichende Parameter wie `weight`/`seed` pro Stil), statt 8 komplett separater Workflow-Dateien.

## Architektur-Entscheidungen (bereits getroffen)

- **Backend: Node.js + Express** (nicht Python) — Begründung: Frontend ist ohnehin JS/p5, ComfyUI wird nur über REST/WebSocket angesprochen (kein direkter Python-Import nötig), daher kein Vorteil durch Python. Eine Sprache für beide Seiten reduziert Kontext-Switching in der knappen Zeit.
- **Fortschrittsanzeige: Polling zuerst.** Kein WebSocket-Progress-Tracking in der ersten Version — der Server pollt den ComfyUI-Status (z.B. `/history/{prompt_id}` Endpoint) in Intervallen, das Frontend pollt wiederum den eigenen Server. WebSocket-Live-Progress ist ein optionaler Ausbauschritt für später, falls Zeit bleibt.
- **Frontend: p5.js, eigenständig.** Der Photobooth-Teil wird als eigenständiger, isolierter Prototyp gebaut (eigenes HTML + p5.min.js, kein Einbau in das bestehende Agency-Tool). Erst wenn dieser Teil für sich funktioniert, wird er später in das Haupttool integriert. Es existiert noch kein Code dafür.
- **Foto-Input:** beide Wege — Webcam-Capture (`getUserMedia`) UND klassischer Datei-Upload, beide im selben Interface anbietbar.
- **8 Stile**, einer pro Bandmitglied, Anzahl soll bei Bedarf nach oben erweiterbar sein (kein Hardcoding von "genau 8" in der Architektur).

## Geplanter Datenfluss (Soll-Zustand)

```
[p5 Frontend]
   |  (1) Foto aufnehmen/hochladen
   |  (2) Stil auswählen (aus Liste, von Backend geladen)
   |  (3) POST /generate { photo, styleId }
   v
[Node/Express Backend]
   |  (4) Bild zwischenspeichern/normalisieren (z.B. mit "sharp")
   |  (5) Bild zu ComfyUI hochladen: POST /upload/image
   |  (6) Workflow-Template laden, INPUT_PHOTO-Node mit hochgeladenem Dateinamen befüllen,
   |      STYLE_REFERENCE-Node + Parameter gemäß gewähltem styleId aus styles.json befüllen
   |  (7) Workflow an ComfyUI senden: POST /prompt → liefert prompt_id zurück
   |  (8) Frontend pollt Backend-Endpoint /status/:promptId
   |  (9) Backend pollt intern ComfyUI /history/:promptId bis fertig
   v
[ComfyUI :8188 lokal]
   |  verarbeitet Workflow, legt Ergebnis-Bild in eigenem output-Ordner ab
   v
[Node/Express Backend]
   |  (10) Bild von ComfyUI abholen: GET /view?filename=...&type=output
   |  (11) Bild an Frontend zurückgeben (z.B. als Base64 oder über eigene statische Route)
   v
[p5 Frontend]
   (12) Ergebnis anzeigen / fürs Lanyard-Layout nutzen
```

## Geplante Backend-Endpunkte

- `GET /styles` — liefert Liste der verfügbaren Stile (id, name, thumbnail) aus `styles.json`
- `POST /generate` — nimmt Foto + styleId, startet ComfyUI-Job, gibt `jobId`/`promptId` zurück
- `GET /status/:jobId` — liefert aktuellen Status (`pending` / `done` / `error`) + bei `done` die Bild-URL/-Daten

## styles.json Struktur (Vorschlag, noch nicht final)

```json
[
  {
    "id": "style-01",
    "name": "Bandmitglied 1",
    "thumbnail": "thumb-01.jpg",
    "styleReferenceImage": "member1_ref.png",
    "ipAdapterWeight": 0.7,
    "controlnetStrength": 1.0,
    "denoise": 0.6,
    "seed": 12345
  }
]
```

## Was noch zu klären/bauen ist (nächste Schritte)

1. Workflow-Template als API-Format-JSON final exportieren (nach Abschluss der Parameter-Feinjustierung)
2. Node-Server-Grundgerüst (Express, die 3 Endpunkte oben)
3. Funktion zum Einsetzen von Werten in die Workflow-JSON anhand `_meta.title` (nicht anhand numerischer Node-IDs, da diese bei Re-Export wechseln können)
4. Bild-Upload-Handling zu ComfyUI (`/upload/image`) vor dem Senden des Prompts
5. Polling-Mechanismus Backend ↔ ComfyUI (`/history/:promptId`)
6. p5-Frontend: Capture/Upload-UI, Style-Auswahl-Grid, Status-Polling, Ergebnisanzeige
7. Verbindung beider Teile testen (lokal, ein Foto, ein Stil, Ende-zu-Ende)
8. Mit mehreren Testfotos durch alle Stile laufen lassen, Konsistenz prüfen

## Wichtiger Arbeitsmodus-Hinweis

Der/die Entwickler:in möchte das **schrittweise und gut dokumentiert** umgesetzt haben, um den Prozess selbst zu verstehen (kein "fertige Blackbox liefern"). Bitte beim Bauen:
- In kleinen, nachvollziehbaren Schritten vorgehen statt alles auf einmal zu generieren
- Code kommentieren und kurz erklären, warum etwas so gelöst wurde
- Bei Architekturentscheidungen kurz die Alternative + Begründung nennen, nicht nur stillschweigend umsetzen