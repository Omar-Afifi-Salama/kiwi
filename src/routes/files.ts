import { Router, type Request, type Response } from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import type { UploadedFile } from "express-fileupload";
import {
    uploadedFiles,
    pendingRequests,
    activeDownloads,
    downloadQueue,
    MAX_CONCURRENT_DOWNLOADS,
    getQueuePosition,
    calculateETA,
    getAutoAccept,
    approvedDownloads,
    type QueueItem,
} from "../state.js";
import { broadcastState } from "../sockets/index.js";
import { uploadDir } from "../config.js";

const router = Router();

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

export function processQueue(): void {
    while (
        downloadQueue.length > 0 &&
        activeDownloads.size < MAX_CONCURRENT_DOWNLOADS
    ) {
        const nextItem = downloadQueue.shift();
        if (nextItem) {
            approvedDownloads[nextItem.requestId] = {
                fileId: nextItem.fileId,
                fileName: nextItem.fileName,
                approvedAt: Date.now(),
            };
            broadcastState();
        }
    }
    broadcastState();
}

// Upload Route
router.post("/upload", (req: Request, res: Response): void => {
    if (!req.files || !req.files.files) {
        res.status(400).send("No files uploaded.");
        return;
    }

    const uploaded = req.files.files as UploadedFile | UploadedFile[];
    const filesArray = Array.isArray(uploaded) ? uploaded : [uploaded];

    filesArray.forEach((file: UploadedFile) => {
        const fileId = crypto.randomBytes(6).toString("hex");
        const targetPath = path.join(uploadDir, `${fileId}_${file.name}`);

        file.mv(targetPath, (err: unknown) => {
            if (err) {
                console.error("❌ Failed to save uploaded file:", err);
            } else {
                uploadedFiles[fileId] = {
                    id: fileId,
                    name: file.name,
                    path: targetPath,
                    size: file.size,
                };
                broadcastState();
            }
        });
    });

    res.redirect("/host");
});

// 1. Initial Request
router.get("/download/:id", (req: Request, res: Response): void => {
    const rawId = req.params.id;
    const fileId = Array.isArray(rawId) ? rawId[0] : rawId;

    if (!fileId) {
        res.status(400).send("Invalid file ID.");
        return;
    }

    const file = uploadedFiles[fileId];
    if (!file || !fs.existsSync(file.path)) {
        res.status(404).send("File not found.");
        return;
    }

    const clientIP = (req.ip || "").replace(/^.*:/, "") || "127.0.0.1";
    const requestId = crypto.randomBytes(8).toString("hex");

    const queueItem: QueueItem = {
        requestId,
        fileId,
        fileName: file.name,
        clientIP,
        timestamp: Date.now(),
    };

    if (
        activeDownloads.size < MAX_CONCURRENT_DOWNLOADS &&
        downloadQueue.length === 0
    ) {
        if (getAutoAccept()) {
            approvedDownloads[requestId] = {
                fileId,
                fileName: file.name,
                approvedAt: Date.now(),
            };
            broadcastState();
            res.json({ status: "approved", requestId });
            return;
        } else {
            pendingRequests[requestId] = queueItem;
            broadcastState();
            res.status(202).json({
                status: "pending_approval",
                requestId,
                message: "Request sent to host. Waiting for approval...",
            });
            return;
        }
    } else {
        downloadQueue.push(queueItem);
        broadcastState();

        const position = getQueuePosition(requestId);
        const eta = calculateETA(position);

        res.status(202).json({
            status: "queued",
            requestId,
            position,
            etaMinutes: eta,
            message: `Network is busy. You are #${position} in the queue.`,
        });
        return;
    }
});

// 2. High-Speed File Stream Route
router.get(
    "/download/stream/:requestId",
    (req: Request, res: Response): void => {
        const rawId = req.params.requestId;
        const requestId = Array.isArray(rawId) ? rawId[0] : rawId;

        if (!requestId) {
            res.status(400).send("Invalid request ID.");
            return;
        }

        const approval = approvedDownloads[requestId];
        if (!approval) {
            res.status(403).send("Download request not approved or expired.");
            return;
        }

        const file = uploadedFiles[approval.fileId];
        if (!file || !fs.existsSync(file.path)) {
            res.status(404).send("File missing on server.");
            return;
        }

        // ⚡ Performance Optimization 1: Disable Nagle's algorithm to blast packets immediately
        if (req.socket) {
            req.socket.setNoDelay(true);
        }

        activeDownloads.add(requestId);
        broadcastState();

        const stat = fs.statSync(file.path);

        // ⚡ Performance Optimization 2: Set TCP keep-alive and octet stream headers
        res.writeHead(200, {
            "Content-Type": "application/octet-stream",
            "Content-Disposition": `attachment; filename="${encodeURIComponent(file.name)}"`,
            "Content-Length": stat.size,
            "Accept-Ranges": "bytes",
            Connection: "keep-alive",
            "Cache-Control": "no-cache",
        });

        // ⚡ Performance Optimization 3: Read in 1 MB chunks (1024 * 1024) instead of 64 KB
        const readStream = fs.createReadStream(file.path, {
            highWaterMark: 1024 * 1024,
        });

        readStream.pipe(res);

        const cleanup = () => {
            // Clean up token after completion so mobile managers don't get 403 on reconnections
            delete approvedDownloads[requestId];
            activeDownloads.delete(requestId);
            processQueue();
        };

        readStream.on("close", cleanup);
        readStream.on("error", cleanup);
    },
);

export default router;
