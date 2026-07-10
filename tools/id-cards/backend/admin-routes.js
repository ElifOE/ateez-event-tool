// Admin-Bereich: Styles verwalten (inkl. Anyteez-Referenzbild-Upload direkt
// aus dem Browser + Prompt-Text pro Stil).
//
// WICHTIG (siehe README/Plan): der Passwortschutz hier ist bewusst simpel
// und NICHT produktionsreif - ein einzelnes geteiltes Secret per Header,
// kein Hashing, keine echte Session-Verwaltung. Das reicht als Bremse gegen
// zufaelligen Zugriff bei diesem lokalen Uni-Projekt, ist aber keine
// echte Absicherung (siehe PROJECT_CONTEXT.md: nicht produktionsreif).

import express from "express";
import { readFile, writeFile } from "node:fs/promises";
import { uploadImageToComfyUI } from "./comfyui.js";

const STYLES_PATH = "./styles.json";

async function readJson(path) {
  const raw = await readFile(path, "utf-8");
  return JSON.parse(raw);
}

async function writeJson(path, data) {
  await writeFile(path, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

// Prueft den Header "X-Admin-Secret" gegen die ADMIN_SECRET-Umgebungsvariable.
function adminAuthMiddleware(req, res, next) {
  const provided = req.get("X-Admin-Secret");
  if (!process.env.ADMIN_SECRET || provided !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: "Nicht autorisiert" });
  }
  next();
}

// multer-Instanz wird von server.js uebergeben (gleiche Memory-Storage-
// Konfiguration wie bei /generate, keine zweite Instanz noetig).
export function createAdminRouter(upload) {
  const router = express.Router();
  router.use(adminAuthMiddleware);

  // GET /admin/styles - volle Style-Objekte (im Unterschied zu GET /styles,
  // das nur die oeffentlichen Felder zeigt).
  router.get("/styles", async (req, res) => {
    try {
      const styles = await readJson(STYLES_PATH);
      res.json(styles);
    } catch (err) {
      console.error("Fehler bei GET /admin/styles:", err);
      res.status(500).json({ error: "Stile konnten nicht geladen werden" });
    }
  });

  // POST /admin/styles - neuen Stil anlegen. Referenzbild kommt separat
  // ueber POST /admin/styles/:id/reference-image (siehe unten).
  router.post("/styles", async (req, res) => {
    try {
      const styles = await readJson(STYLES_PATH);
      const { name, seed, promptText } = req.body;

      if (!name) {
        return res.status(400).json({ error: "name ist erforderlich" });
      }

      // Kein separates "thumbnail"-Feld mehr - anyteezReferenceImage ist
      // ohnehin dasselbe Bild und wird auch als Vorschau verwendet (siehe
      // GET /styles in server.js). Eine Quelle der Wahrheit statt zwei
      // Felder, die man sonst staendig synchron halten muesste.
      const newStyle = {
        id: `style-${Date.now()}`,
        name,
        anyteezReferenceImage: null,
        seed: Number(seed) || Math.floor(Math.random() * 1_000_000),
        promptText: promptText || "",
      };

      styles.push(newStyle);
      await writeJson(STYLES_PATH, styles);
      res.status(201).json(newStyle);
    } catch (err) {
      console.error("Fehler bei POST /admin/styles:", err);
      res.status(500).json({ error: "Stil konnte nicht angelegt werden" });
    }
  });

  // PUT /admin/styles/:id - Teil-Update eines bestehenden Stils.
  router.put("/styles/:id", async (req, res) => {
    try {
      const styles = await readJson(STYLES_PATH);
      const index = styles.findIndex((s) => s.id === req.params.id);

      if (index === -1) {
        return res.status(404).json({ error: "Stil nicht gefunden" });
      }

      styles[index] = { ...styles[index], ...req.body, id: styles[index].id };
      await writeJson(STYLES_PATH, styles);
      res.json(styles[index]);
    } catch (err) {
      console.error("Fehler bei PUT /admin/styles/:id:", err);
      res.status(500).json({ error: "Stil konnte nicht aktualisiert werden" });
    }
  });

  // DELETE /admin/styles/:id - entfernt den Stil aus styles.json. Das
  // hochgeladene Referenzbild bleibt in ComfyUI's Input-Ordner liegen
  // (harmloser Datenrest, Loeschen dort ist nicht im Scope).
  router.delete("/styles/:id", async (req, res) => {
    try {
      const styles = await readJson(STYLES_PATH);
      const filtered = styles.filter((s) => s.id !== req.params.id);

      if (filtered.length === styles.length) {
        return res.status(404).json({ error: "Stil nicht gefunden" });
      }

      await writeJson(STYLES_PATH, filtered);
      res.status(204).end();
    } catch (err) {
      console.error("Fehler bei DELETE /admin/styles/:id:", err);
      res.status(500).json({ error: "Stil konnte nicht geloescht werden" });
    }
  });

  // POST /admin/styles/:id/reference-image - Referenzbild-Upload direkt aus
  // dem Browser. Nutzt die bereits vorhandene uploadImageToComfyUI() (siehe
  // comfyui.js, schon fuer /generate im Einsatz) - kein neuer Upload-Code.
  router.post("/styles/:id/reference-image", upload.single("image"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Kein Bild im Feld 'image' erhalten" });
      }

      const styles = await readJson(STYLES_PATH);
      const style = styles.find((s) => s.id === req.params.id);

      if (!style) {
        return res.status(404).json({ error: "Stil nicht gefunden" });
      }

      const confirmedFilename = await uploadImageToComfyUI(
        req.file.buffer,
        req.file.originalname
      );

      style.anyteezReferenceImage = confirmedFilename;
      await writeJson(STYLES_PATH, styles);

      res.json({ anyteezReferenceImage: confirmedFilename });
    } catch (err) {
      console.error("Fehler bei POST /admin/styles/:id/reference-image:", err);
      res.status(500).json({ error: "Referenzbild konnte nicht hochgeladen werden" });
    }
  });

  return router;
}
