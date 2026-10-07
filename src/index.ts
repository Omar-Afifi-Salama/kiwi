import express from "express";
import http from "http";
import { Server as SocketServer } from "socket.io";
import fileUpload from "express-fileupload";
import { exec } from "child_process";
import router, { captivePortalMiddleware } from "./routes/index.js";
import { initSockets } from "./sockets/index.js";
import { createHotspot } from "./utils/hotspot.js";
import { getLocalIP } from "./utils/network.js";
import { PORT } from "./config.js";

const app = express();
const server = http.createServer(app);
const io = new SocketServer(server);

const localIP = getLocalIP();

createHotspot("Capital-Ai-Drop-1", "workshop123");

// Middleware
app.use(captivePortalMiddleware);
app.use(fileUpload());
app.use(express.json());
app.use(router);

// Initialize Sockets
initSockets(io);

server.listen(PORT, () => {
    console.log(`🚀 Club Local Drop Hub running at: http://${localIP}:${PORT}`);
    console.log(`🎛️ Host Control Panel: http://localhost:${PORT}/host`);

    const openCmd =
        process.platform === "win32"
            ? `start http://localhost:${PORT}/host`
            : process.platform === "darwin"
              ? `open http://localhost:${PORT}/host`
              : `xdg-open http://localhost:${PORT}/host`;
    exec(openCmd);
});
