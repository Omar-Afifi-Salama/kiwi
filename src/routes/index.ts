import { Router } from "express";
import path from "path";
import express from "express";
import { fileURLToPath } from "url";
import pagesRouter from "./pages.js";
import filesRouter from "./files.js";
import apiRouter from "./api.js";
import { captivePortalMiddleware } from "../middleware/captive.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

export { captivePortalMiddleware };

// Serve public static assets
router.use(express.static(path.join(__dirname, "../../public")));

// Mount modular sub-routers
router.use("/", pagesRouter);
router.use("/", filesRouter);
router.use("/api", apiRouter);

export default router;
