import type { Request, Response, NextFunction } from "express";
import { getLocalIP } from "../utils/network.js";
import { PORT } from "../config.js";

export function captivePortalMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    const host = req.get("host") || "";
    const url = req.url || "";

    // Dynamically evaluate the IP on request so it's always accurate
    const currentShareURL = `http://${getLocalIP()}:${PORT}`;

    // Expanded list of OS connectivity check domains & paths
    const isCaptiveProbe =
        host.includes("connectivitycheck") ||
        host.includes("gstatic.com") ||
        host.includes("msftconnecttest") ||
        host.includes("apple.com") ||
        host.includes("netscape.com") ||
        host.includes("thinkbroadband.com") ||
        url.includes("generate_204") ||
        url.includes("gen_204") ||
        url.includes("connecttest.txt") ||
        url.includes("hotspot-detect.html") ||
        url.includes("ncsi.txt") ||
        url.includes("success.txt") ||
        host.includes("clients3.google.com");

    if (isCaptiveProbe) {
        // Use a 302 Found redirect pointing to your live server IP
        return res.redirect(302, currentShareURL);
    }

    next();
}
