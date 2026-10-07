import { Router, type Request, type Response } from "express";
import path from "path";
import { fileURLToPath } from "url";
import { getLocalIP } from "../utils/network.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();
const localIP = getLocalIP();

// Receiver view (Main landing page)
router.get("/", (req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, "../../public/index.html"));
});

// Host control panel view (Restricted to Host Machine Only)
router.get("/host", (req: Request, res: Response) => {
    const clientIP = req.ip || "";
    const isLocalhost =
        clientIP.includes("127.0.0.1") ||
        clientIP === "::1" ||
        clientIP === "::ffff:127.0.0.1" ||
        clientIP === localIP;

    if (!isLocalhost) {
        return res.status(403).send(`
            <!DOCTYPE html>
            <html lang="en">
            <head><meta charset="UTF-8"><title>Access Denied</title><script src="https://cdn.tailwindcss.com"></script></head>
            <body class="bg-slate-950 text-white flex items-center justify-center h-screen">
                <div class="text-center space-y-3">
                    <h1 class="text-2xl font-bold text-rose-500">🚫 Access Denied</h1>
                    <p class="text-slate-400 text-sm">The Host Control Center is restricted to the workshop instructor.</p>
                    <a href="/" class="inline-block bg-indigo-600 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-500">Go to Download Page</a>
                </div>
            </body>
            </html>
        `);
    }

    res.sendFile(path.join(__dirname, "../../public/host.html"));
});

export default router;
