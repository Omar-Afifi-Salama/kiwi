import { Router, type Request, type Response } from "express";
import fs from "fs";
import { uploadedFiles, pendingRequests, toggleAutoAccept } from "../state.js";
import { broadcastState } from "../sockets/index.js";

const router = Router();

router.post("/toggle-auto", (req: Request, res: Response) => {
    const newState = toggleAutoAccept();
    res.json({ autoAccept: newState });
});

function streamFile(
    file: { name: string; path: string; size: number },
    res: Response,
) {
    const stat = fs.statSync(file.path);
    res.writeHead(200, {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${file.name}"`,
        "Content-Length": stat.size,
    });
    fs.createReadStream(file.path).pipe(res);
}

router.post("/resolve-request", (req: Request, res: Response) => {
    const { requestId, approved } = req.body;
    const request = pendingRequests[requestId];
    if (!request) {
        return res.status(400).send("Request not found.");
    }

    if (approved) {
        const file = uploadedFiles[request.fileId];
        if (file) {
            streamFile(file, request.res);
        } else {
            request.res.status(404).send("File missing.");
        }
    } else {
        request.res.status(403).send("Download denied by host.");
    }

    delete pendingRequests[requestId];
    broadcastState();
    res.sendStatus(200);
});

export default router;
