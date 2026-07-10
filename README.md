# ATEEZ Sendoff Event Tool

Statische Multi-Tool-Seite (`index.html`), jedes Tool unter `tools/<name>/` läuft als eigenes iframe.

## Starten

Im Repo-Root:
```
python -m http.server 8001
```
Danach `http://localhost:8001` öffnen. Port 8001 (statt z.B. 8000), damit ComfyUIs Standardport frei bleibt, falls ComfyUI parallel läuft (für den Event-ID-Creator / `id_photobooth` nötig, siehe unten).

## Event ID Creator (id_photobooth)

Ausführliche Anleitung (Setup, Backend/ComfyUI-Start, Referenzbilder-Verwaltung) liegt in [`tools/id_photobooth/README.md`](tools/id_photobooth/README.md).
