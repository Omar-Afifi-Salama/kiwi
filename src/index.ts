import express from "express";
import http from "http";
import { Server as SocketServer } from "socket.io";
import fileUpload from "express-fileupload";
import { exec } from "child_process";
import qrcode from "qrcode-terminal";
import pc from "picocolors";
import { intro, outro, note } from "@clack/prompts";
import ora from "ora";
import { renderSideBySideQRs } from "./utils/renderQrCodes.js";

import router, { captivePortalMiddleware } from "./routes/index.js";
import { initSockets } from "./sockets/index.js";
import { createHotspot, promptHotspotCredentials } from "./utils/hotspot.js";
import { getLocalIP } from "./utils/network.js";
import { PORT } from "./config.js";

const app = express();
const server = http.createServer(app);
const io = new SocketServer(server);

async function startServer() {
    intro(pc.inverse(pc.bold(" Club Local Drop Hub ")));

    // Prompt for hotspot credentials
    const { autoCreate, ssid, password } = await promptHotspotCredentials();

    if (autoCreate) {
        const spinner = ora(pc.cyan("Setting up Wi-Fi hotspot...")).start();
        const success = await createHotspot(ssid, password);

        if (!success) {
            spinner.fail(pc.red("Automatic hotspot setup failed."));
            note(
                pc.yellow(
                    "Please set up your Wi-Fi Hotspot or Internet Sharing manually in your OS settings, then restart the server.",
                ),
                "Action Required",
            );
            process.exit(1);
        }
        spinner.succeed(pc.green("Hotspot created successfully!"));

        const ipSpinner = ora(
            pc.cyan("Waiting for network interface address assignment..."),
        ).start();
        await new Promise((resolve) => setTimeout(resolve, 5000));
        ipSpinner.succeed(pc.green("Network interface ready!"));
    } else {
        note(
            pc.dim(
                "Skipping auto-creation. Assuming manual hotspot is active.",
            ),
            "Notice",
        );
    }

    const localIP = getLocalIP();

    // Middleware & Sockets
    app.use(captivePortalMiddleware);
    app.use(fileUpload());
    app.use(express.json());
    app.use(router);
    initSockets(io);

    server.listen(PORT, () => {
        const shareURL = `http://${localIP}:${PORT}`;
        const wifiString = `WIFI:S:${ssid};T:WPA;P:${password};;`;

        outro(
            pc.green(pc.bold("Server is up and running!")) +
                `\n\n` +
                `  ${pc.bold("Local Drop Hub   :")}   ${pc.cyan(shareURL)}\n` +
                `  ${pc.bold("Control Panel    :")}   ${pc.cyan(`http://localhost:${PORT}/host`)}`,
        );

        console.log(
            pc.bold(
                "\n📱 Scan this QR code with your phone camera to join the Wi-Fi hotspot:\n",
            ),
        );

        qrcode.generate(wifiString, { small: true }, (wifiQr) => {
            qrcode.generate(shareURL, { small: true }, (urlQr) => {
                renderSideBySideQRs(
                    wifiQr,
                    urlQr,
                    `1. Join Wi-Fi (${ssid})`,
                    `2. Open Drop Hub`,
                );
                console.log(
                    pc.dim(`\n  SSID: `) +
                        pc.white(ssid) +
                        pc.dim(` | Password: `) +
                        pc.white(password) +
                        pc.dim(` | URL: `) +
                        pc.cyan(shareURL) +
                        "\n",
                );
            });
        });

        const openCmd =
            process.platform === "win32"
                ? `start http://localhost:${PORT}/host`
                : process.platform === "darwin"
                  ? `open http://localhost:${PORT}/host`
                  : `xdg-open http://localhost:${PORT}/host`;
        exec(openCmd);
    });

    server.on("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE") {
            console.error(
                pc.red(`\n🛑 Error: Port ${PORT} is already in use.`),
            );
            console.error(
                pc.yellow(
                    `👉 Please stop any other running instances or run: `,
                ) + pc.bold(`npx kill-port ${PORT}\n`),
            );
            process.exit(1);
        } else {
            throw err;
        }
    });
}

startServer();
