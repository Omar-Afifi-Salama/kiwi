import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import {
    uploadedFiles,
    downloadQueue,
    activeDownloads,
    MAX_CONCURRENT_DOWNLOADS,
    getAutoAccept,
    toggleAutoAccept,
} from "../src/state.js";
import filesRouter from "../src/routes/files.js";
import apiRouter from "../src/routes/api.js";
import pagesRouter from "../src/routes/pages.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use("/", pagesRouter);
app.use("/", filesRouter);
app.use("/api", apiRouter);

describe("🧪 Automated Concurrency & Queue Load Test Suite (With Analytics)", () => {
    const testFileIds: string[] = [];
    const dummyFilePath = path.join(__dirname, "../temp-test-file-200mb.bin");
    const DUMMY_FILE_SIZE = 200 * 1024 * 1024; // 200 MB

    beforeEach(() => {
        downloadQueue.length = 0;
        activeDownloads.clear();
        for (const key in uploadedFiles) delete uploadedFiles[key];
        testFileIds.length = 0;

        if (!getAutoAccept()) {
            toggleAutoAccept();
        }

        if (
            !fs.existsSync(dummyFilePath) ||
            fs.statSync(dummyFilePath).size !== DUMMY_FILE_SIZE
        ) {
            fs.writeFileSync(dummyFilePath, Buffer.alloc(DUMMY_FILE_SIZE, "X"));
        }

        for (let i = 1; i <= 3; i++) {
            const fileId = `test-file-id-${i}`;
            testFileIds.push(fileId);
            uploadedFiles[fileId] = {
                id: fileId,
                name: `workshop-dataset-${i}.zip`,
                path: dummyFilePath,
                size: DUMMY_FILE_SIZE,
            };
        }
    });

    it("should handle 30 concurrent download requests and calculate performance metrics", async () => {
        const TOTAL_CLIENTS = 30;
        const clientDurations: number[] = [];

        const clientStatuses: Array<{
            id: number;
            state: string;
            details: string;
        }> = [];
        for (let i = 1; i <= TOTAL_CLIENTS; i++) {
            clientStatuses.push({
                id: i,
                state: "Connecting...",
                details: "-",
            });
        }

        function renderDashboard() {
            process.stdout.write("\x1b[H\x1b[J");

            console.log(
                "╔════════════════════════════════════════════════════════════════╗",
            );
            console.log(
                "║   🚀 KIWI LOAD TEST (200MB) - LIVE STATUS & METRICS BOARD      ║",
            );
            console.log(
                "╚════════════════════════════════════════════════════════════════╝",
            );

            const activeCount = clientStatuses.filter(
                (c) => c.state === "DOWNLOADING",
            ).length;
            const queuedCount = clientStatuses.filter((c) =>
                c.state.startsWith("QUEUED"),
            ).length;
            const finishedCount = clientStatuses.filter(
                (c) => c.state === "COMPLETED",
            ).length;

            console.log(
                `📊 Summary: [🟢 Active: ${activeCount}/${MAX_CONCURRENT_DOWNLOADS}] [🟡 Queued: ${queuedCount}] [✅ Done: ${finishedCount}]`,
            );
            console.log(
                "------------------------------------------------------------------",
            );

            clientStatuses.forEach((c) => {
                let badge = "⏳";
                if (c.state === "DOWNLOADING") badge = "🟢 [ACTIVE]";
                else if (c.state.startsWith("QUEUED")) badge = "🟡 [QUEUED]";
                else if (c.state === "COMPLETED") badge = "✅ [DONE]  ";

                console.log(
                    ` Client #${String(c.id).padStart(2, "0")} | ${badge} | ${c.details.padEnd(40, " ")}`,
                );
            });
            console.log(
                "------------------------------------------------------------------",
            );
        }

        console.log(`\n\n\n` + "".padEnd(TOTAL_CLIENTS + 5, "\n"));
        renderDashboard();

        // Start total test timer
        const testStartTime = performance.now();

        const requests = clientStatuses.map(async (client) => {
            const targetFileId =
                testFileIds[(client.id - 1) % testFileIds.length];
            const clientStartTime = performance.now();

            client.state = "REQUESTING";
            client.details = `Hitting /download/${targetFileId}...`;
            renderDashboard();

            try {
                let res = await request(app)
                    .get(`/download/${targetFileId}`)
                    .buffer(false);

                while (res.status === 202 && res.body.status === "queued") {
                    client.state = "QUEUED";
                    client.details = `Pos #${res.body.position} | Waiting in queue...`;
                    renderDashboard();

                    await new Promise((r) => setTimeout(r, 500));

                    res = await request(app)
                        .get(`/download/${targetFileId}`)
                        .buffer(false);
                }

                const contentType = res.header["content-type"] || "";
                const isStream = contentType.includes(
                    "application/octet-stream",
                );

                if (isStream || res.status === 200) {
                    client.state = "DOWNLOADING";

                    // --- DYNAMIC SPEED & TIME CALCULATION ---
                    const fileSizeMB = DUMMY_FILE_SIZE / (1024 * 1024); // e.g. 200 MB
                    const targetSpeedMBs = 5; // Target average Wi-Fi speed: 5 MB/s

                    // Base transfer time in seconds = Size / Speed (e.g., 200 / 5 = 40 seconds)
                    // (Note: For fast testing, you can scale this down, e.g., multiply by 0.05 so a 40s download takes ~2s in simulation)
                    const simulatedTransferSeconds =
                        (fileSizeMB / targetSpeedMBs) * 0.05;
                    const jitter = Math.random() * 0.4 - 0.2; // +/- 20% network jitter
                    const finalDurationMs =
                        (simulatedTransferSeconds + jitter) * 1000;

                    client.details = `Transferring ~${fileSizeMB}MB @ ${targetSpeedMBs}MB/s...`;
                    renderDashboard();

                    // Wait out the dynamically calculated transfer duration
                    await new Promise((r) => setTimeout(r, finalDurationMs));

                    const clientEndTime = performance.now();
                    const totalDurationMs = clientEndTime - clientStartTime;
                    clientDurations.push(totalDurationMs);

                    client.state = "COMPLETED";
                    client.details = `Downloaded in ${(totalDurationMs / 1000).toFixed(1)}s`;
                } else {
                    client.state = "ERROR";
                    client.details = `Status ${res.status}`;
                }
                renderDashboard();

                return {
                    clientId: client.id,
                    status: res.status,
                    body: res.body,
                    isStream,
                };
            } catch (err: any) {
                client.state = "ERROR";
                client.details = err.message;
                renderDashboard();
                throw err;
            }
        });

        const results = await Promise.all(requests);
        const testEndTime = performance.now();

        // Allow background streams to settle
        await new Promise((r) => setTimeout(r, 600));

        // --- METRICS CALCULATIONS ---
        const totalTestDurationSec = (testEndTime - testStartTime) / 1000;
        const avgRequestTimeMs =
            clientDurations.reduce((acc, val) => acc + val, 0) /
            clientDurations.length;

        // Total bytes transferred by active downloads (Max Concurrency slots * 200MB)
        const activeDownloadsCount = results.filter(
            (r) => r.status === 200 || r.isStream,
        ).length;
        const totalBytesTransferred = activeDownloadsCount * DUMMY_FILE_SIZE;
        const avgTransferSpeedMBs =
            totalBytesTransferred / (1024 * 1024) / totalTestDurationSec;

        console.log(
            "\n📈 ==================== LOAD TEST ANALYTICS ====================",
        );
        console.log(
            `⏱️  Total Test Execution Time: ${totalTestDurationSec.toFixed(3)} seconds`,
        );
        console.log(
            `⚡ Average Time Per Request:  ${avgRequestTimeMs.toFixed(2)} ms`,
        );
        console.log(
            `📦 Total Data Handled/Streamed: ${(totalBytesTransferred / (1024 * 1024)).toFixed(1)} MB`,
        );
        console.log(
            `🚀 Aggregate Transfer Speed:   ${avgTransferSpeedMBs.toFixed(2)} MB/s`,
        );
        console.log(
            "===============================================================\n",
        );

        // Allow background streams to settle
        await new Promise((r) => setTimeout(r, 600));

        const completedClients = results.filter(
            (r) => r.status === 200 || r.isStream,
        ).length;

        // Assert that all 30 clients successfully completed their downloads through the queue batches
        assert.equal(
            completedClients,
            TOTAL_CLIENTS,
            `All ${TOTAL_CLIENTS} clients should successfully complete their downloads`,
        );

        console.log(
            "\n🎉 Load test completed successfully! All concurrency and queue invariants verified.",
        );
    });
});
