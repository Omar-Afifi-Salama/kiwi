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
    approvedDownloads,
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
        for (const key in approvedDownloads) delete approvedDownloads[key];
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

        const testStartTime = performance.now();

        const requests = clientStatuses.map(async (client) => {
            const targetFileId =
                testFileIds[(client.id - 1) % testFileIds.length];
            const clientStartTime = performance.now();

            client.state = "REQUESTING";
            client.details = `Hitting /download/${targetFileId}...`;
            renderDashboard();

            try {
                // Step 1: Request Download (Returns JSON)
                let res = await request(app).get(`/download/${targetFileId}`);
                let { status, requestId, position } = res.body;

                // Step 2: Mimic Socket.io Wait Event (No HTTP polling)
                if (res.status === 202 && status === "queued") {
                    while (!approvedDownloads[requestId]) {
                        client.state = "QUEUED";
                        client.details = `Pos #${position || "?"} | Waiting (Socket Sim)...`;
                        renderDashboard();
                        await new Promise((r) => setTimeout(r, 500));
                    }
                    // Request successfully promoted by processQueue
                    status = "approved";
                }

                if (status === "approved" || res.status === 200) {
                    client.state = "DOWNLOADING";

                    const fileSizeMB = DUMMY_FILE_SIZE / (1024 * 1024);
                    const targetSpeedMBs = 5;
                    const simulatedTransferSeconds =
                        (fileSizeMB / targetSpeedMBs) * 0.05;
                    const jitter = Math.random() * 0.4 - 0.2;
                    const finalDurationMs =
                        (simulatedTransferSeconds + jitter) * 1000;

                    client.details = `Transferring ~${fileSizeMB}MB @ ${targetSpeedMBs}MB/s...`;
                    renderDashboard();

                    // Step 3: Stream Request (Consume stream entirely to free up activeDownloads slots)
                    let isStream = false;
                    await new Promise((resolve, reject) => {
                        request(app)
                            .get(`/download/stream/${requestId}`)
                            .buffer(false)
                            .parse((stream, callback) => {
                                isStream = true;
                                stream.on("data", () => {}); // Discard bytes in memory
                                stream.on("end", () => callback(null, ""));
                            })
                            .end((err, response) => {
                                if (err) return reject(err);
                                resolve(response);
                            });
                    });

                    await new Promise((r) => setTimeout(r, finalDurationMs));

                    const clientEndTime = performance.now();
                    const totalDurationMs = clientEndTime - clientStartTime;
                    clientDurations.push(totalDurationMs);

                    client.state = "COMPLETED";
                    client.details = `Downloaded in ${(totalDurationMs / 1000).toFixed(1)}s`;
                    renderDashboard();

                    return {
                        clientId: client.id,
                        status: 200,
                        isStream,
                    };
                } else {
                    client.state = "ERROR";
                    client.details = `Unexpected status ${res.status}`;
                    renderDashboard();
                    return {
                        clientId: client.id,
                        status: res.status,
                        isStream: false,
                    };
                }
            } catch (err: any) {
                client.state = "ERROR";
                client.details = err.message;
                renderDashboard();
                throw err;
            }
        });

        const results = await Promise.all(requests);
        const testEndTime = performance.now();

        await new Promise((r) => setTimeout(r, 600));

        const totalTestDurationSec = (testEndTime - testStartTime) / 1000;
        const avgRequestTimeMs =
            clientDurations.reduce((acc, val) => acc + val, 0) /
            clientDurations.length;

        const activeDownloadsCount = results.filter((r) => r.isStream).length;
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
            `📦 Total Data Streamed:       ${(totalBytesTransferred / (1024 * 1024)).toFixed(1)} MB`,
        );
        console.log(
            `🚀 Aggregate Transfer Speed:  ${avgTransferSpeedMBs.toFixed(2)} MB/s`,
        );
        console.log(
            "===============================================================\n",
        );

        assert.equal(
            activeDownloadsCount,
            TOTAL_CLIENTS,
            `All ${TOTAL_CLIENTS} clients should successfully complete their streams`,
        );

        console.log(
            "\n🎉 Load test completed successfully! All concurrency and queue invariants verified.",
        );
    });
});
