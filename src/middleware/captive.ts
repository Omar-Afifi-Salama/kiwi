import type { Request, Response, NextFunction } from "express";
import { getLocalIP } from "../utils/network.js";
import { PORT } from "../config.js";

const shareURL = `http://${getLocalIP()}:${PORT}`;

export function captivePortalMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    const host = req.get("host") || "";
    const url = req.url || "";

    if (
        host.includes("connectivitycheck") ||
        host.includes("msftconnecttest") ||
        host.includes("apple.com") ||
        url.includes("generate_204") ||
        url.includes("connecttest.txt") ||
        url.includes("hotspot-detect.html") ||
        url.includes("ncsi.txt") ||
        host.includes("clients3.google.com")
    ) {
        return res.redirect(shareURL);
    }
    next();
}
