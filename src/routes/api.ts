import { Router, type Request, type Response } from "express";
import {
    pendingRequests,
    toggleAutoAccept,
    approvedDownloads,
    rejectedRequests,
} from "../state.js";
import { broadcastState } from "../sockets/index.js";

const router = Router();

router.post("/toggle-auto", (req: Request, res: Response) => {
    const newState = toggleAutoAccept();
    res.json({ autoAccept: newState });
});

router.post("/resolve-request", (req: Request, res: Response): void => {
    const { requestId, approved } = req.body;
    const request = pendingRequests[requestId];

    if (!request) {
        res.status(400).send("Request not found.");
        return;
    }

    if (approved) {
        approvedDownloads[requestId] = {
            fileId: request.fileId,
            fileName: request.fileName,
            approvedAt: Date.now(),
        };
    } else {
        rejectedRequests.add(requestId);
    }

    delete pendingRequests[requestId];
    broadcastState();
    res.sendStatus(200);
});

export default router;
