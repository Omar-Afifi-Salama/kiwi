import { Server as SocketServer } from "socket.io";
import { activeClients, uploadedFiles, pendingRequests } from "../state.js";
import type { SafePendingRequest } from "../types.js";

let ioInstance: SocketServer | null = null;

export function initSockets(io: SocketServer) {
    ioInstance = io;

    io.on("connection", (socket) => {
        const clientIP =
            socket.handshake.address.replace(/^.*:/, "") || "127.0.0.1";
        activeClients.add(clientIP);
        broadcastState();

        socket.on("disconnect", () => {
            activeClients.delete(clientIP);
            broadcastState();
        });
    });
}

export function broadcastState() {
    if (!ioInstance) return;

    const safeRequests: Record<string, SafePendingRequest> = {};
    for (const [id, req] of Object.entries(pendingRequests)) {
        safeRequests[id] = {
            requestId: req.requestId,
            fileName: req.fileName,
            clientIP: req.clientIP,
        };
    }

    ioInstance.emit("state-update", {
        clientCount: activeClients.size,
        files: uploadedFiles,
        requests: safeRequests,
    });
}
