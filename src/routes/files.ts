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
    type QueueItem,
} from "../state.js";
import { broadcastState } from "../sockets/index.js";
import { uploadDir } from "../config.js";

const router = Router();

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

export function processQueue() {
    while (
        downloadQueue.length > 0 &&
        activeDownloads.size < MAX_CONCURRENT_DOWNLOADS
    ) {
        const nextItem = downloadQueue.shift();
        if (nextItem) {
            startActiveDownload(nextItem);
        }
    }
    broadcastState();
}

function startActiveDownload(item: QueueItem) {
    // Prevent writing headers if response is already sent or finished
    if (item.res.headersSent || item.res.writableEnded) {
        return;
    }

    const file = uploadedFiles[item.fileId];
    if (!file || !fs.existsSync(file.path)) {
        if (!item.res.headersSent) item.res.status(404).send("File missing.");
        return;
    }

    activeDownloads.add(item.requestId);
    broadcastState();

    const stat = fs.statSync(file.path);
    item.res.writeHead(200, {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${file.name}"`,
        "Content-Length": stat.size,
    });

    const readStream = fs.createReadStream(file.path);
    readStream.pipe(item.res);

    readStream.on("close", () => {
        activeDownloads.delete(item.requestId);
        processQueue();
    });

    readStream.on("error", () => {
        activeDownloads.delete(item.requestId);
        processQueue();
    });
}

// File Upload Route
router.post("/upload", (req: Request, res: Response) => {
    if (!req.files || !req.files.files) {
        return res.status(400).send("No files uploaded.");
    }

    let uploaded = req.files.files as UploadedFile | UploadedFile[];
    const filesArray = Array.isArray(uploaded) ? uploaded : [uploaded];

    filesArray.forEach((file) => {
        const fileId = crypto.randomBytes(6).toString("hex");
        const targetPath = path.join(uploadDir, `${fileId}_${file.name}`);

        file.mv(targetPath, (err) => {
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

// Download Route & Queue Allocator
router.get("/download/:id", (req: Request, res: Response) => {
    const fileId = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;
    if (!fileId) return res.status(400).send("Invalid file ID.");

    const file = uploadedFiles[fileId];
    if (!file || !fs.existsSync(file.path))
        return res.status(404).send("File not found.");

    const clientIP = (req.ip || "").replace(/^.*:/, "") || "127.0.0.1";
    const requestId = crypto.randomBytes(8).toString("hex");

    const queueItem: QueueItem = {
        requestId,
        fileId,
        fileName: file.name,
        clientIP,
        res,
        timestamp: Date.now(),
    };

    if (
        activeDownloads.size < MAX_CONCURRENT_DOWNLOADS &&
        downloadQueue.length === 0
    ) {
        if (getAutoAccept()) {
            startActiveDownload(queueItem);
        } else {
            pendingRequests[requestId] = queueItem as any;
            broadcastState();
        }
    } else {
        downloadQueue.push(queueItem);
        broadcastState();

        const position = getQueuePosition(requestId);
        const eta = calculateETA(position);

        res.status(202).json({
            status: "queued",
            position,
            etaMinutes: eta,
            message: `Network is busy. You are #${position} in the queue. Estimated start: ${eta} min.`,
        });
    }
});

export default router;
