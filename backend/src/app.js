import express from "express";
import multer from "multer";
import { loadLocalEnv } from "./env.js";
import {
  logoutSession,
  resolveAuthenticatedSession,
} from "./auth-service.js";
import {
  createDocumentItem,
  getErrorMessage,
  HttpError,
  uploadMedia,
} from "./upload-service.js";
import {
  generateMonthlyReleaseReport,
  postMonthlyReleaseReportToCoda,
} from "./report-service.js";

loadLocalEnv();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "docu-stream-backend" });
});

app.post("/api/auth/session", async (req, res) => {
  try {
    const data = await resolveAuthenticatedSession({
      authorization: req.get("Authorization"),
    });

    res.json({ data });
  } catch (error) {
    console.error("[auth-session]", getErrorMessage(error));
    res.status(error instanceof HttpError ? error.status : 502).json({
      message: getErrorMessage(error, "Sign in failed."),
    });
  }
});

app.post("/api/auth/logout", async (req, res) => {
  await logoutSession({
    authorization: req.get("Authorization"),
  });

  res.status(204).end();
});

app.post("/api/media/upload", upload.single("file"), async (req, res) => {
  try {
    const data = await uploadMedia({
      authorization: req.get("Authorization"),
      file: req.file,
    });

    res.status(201).json({ data });
  } catch (error) {
    console.error("[media-upload]", getErrorMessage(error));
    res.status(error instanceof HttpError ? error.status : 502).json({
      message: getErrorMessage(error),
    });
  }
});

app.post("/api/content/items", async (req, res) => {
  try {
    const data = await createDocumentItem({
      authorization: req.get("Authorization"),
      body: req.body,
    });

    res.status(201).json({ data });
  } catch (error) {
    console.error("[content-item]", getErrorMessage(error));
    res.status(error instanceof HttpError ? error.status : 502).json({
      message: getErrorMessage(error),
    });
  }
});

app.post("/api/reports/monthly-release", async (req, res) => {
  try {
    const report = await generateMonthlyReleaseReport({
      authorization: req.get("Authorization"),
      month: req.body?.month,
    });

    res.json({ data: report });
  } catch (error) {
    console.error("[monthly-release-report]", getErrorMessage(error));
    res.status(error instanceof HttpError ? error.status : 502).json({
      message: getErrorMessage(error, "Release report generation failed."),
    });
  }
});

app.post("/api/reports/monthly-release/coda", async (req, res) => {
  try {
    const data = await postMonthlyReleaseReportToCoda({
      authorization: req.get("Authorization"),
      month: req.body?.month,
    });

    res.status(202).json({ data });
  } catch (error) {
    console.error("[monthly-release-coda]", getErrorMessage(error));
    res.status(error instanceof HttpError ? error.status : 502).json({
      message: getErrorMessage(error, "Coda release note post failed."),
    });
  }
});

app.use((_req, res) => {
  res.status(404).json({ message: "Not found." });
});

export default app;
