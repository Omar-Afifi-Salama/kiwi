import express from "express";
import http from "http";
import { Server as SocketServer } from "socket.io";
import fileUpload from "express-fileupload";
import { exec } from "child_process";

import router, { captivePortalMiddleware } from "./routes/index.js";
import { initSockets } from "./sockets/index.js";
import { createHotspot, promptHotspotCredentials } from "./utils/hotspot.js";
import { getLocalIP } from "./utils/network.js";
import { PORT } from "./config.js";

const app = express();
const server = http.createServer(app);
const io = new SocketServer(server);

// 2. Put your startup sequence inside an async function or main block
async function startServer() {
    // spin up hotspot and calculate bandwidth
    const { autoCreate, ssid, password } = await promptHotspotCredentials();

    if (autoCreate) {
        const success = await createHotspot(ssid, password);
        if (!success) {
            console.error("\n🛑 Fatal: Automatic hotspot setup failed.");
            console.error(
                "👉 Please set up your Wi-Fi Hotspot or Internet Sharing manually in your OS settings, then restart the server.",
            );
            process.exit(1); // Clean exit
        }
    } else {
        console.log(
            "ℹ️ Skipping auto-creation. Assuming manual hotspot is active.",
        );
    }
    // then after the hotspot is created get the local IP
    const localIP = getLocalIP();

    // Middleware & Sockets
    app.use(captivePortalMiddleware);
    app.use(fileUpload());
    app.use(express.json());
    app.use(router);
    initSockets(io);

    server.listen(PORT, () => {
        console.log(
            `\n🚀 Club Local Drop Hub running at: http://${localIP}:${PORT}`,
        );
        console.log(`🎛️ Host Control Panel: http://localhost:${PORT}/host\n`);

        const openCmd =
            process.platform === "win32"
                ? `start http://localhost:${PORT}/host`
                : process.platform === "darwin"
                  ? `open http://localhost:${PORT}/host`
                  : `xdg-open http://localhost:${PORT}/host`;
        exec(openCmd);
    });
}

startServer();
