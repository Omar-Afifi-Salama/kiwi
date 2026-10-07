import { Server as SocketServer } from "socket.io";
import {
    uploadedFiles,
    pendingRequests,
    activeClients,
    approvedDownloads,
    rejectedRequests,
} from "../state.js";

let ioInstance: SocketServer | null = null;

export function initSockets(io: SocketServer) {
    ioInstance = io;

    io.on("connection", (socket) => {
        activeClients.add(socket.id);
        broadcastState();

        socket.on("disconnect", () => {
            activeClients.delete(socket.id);
            broadcastState();
        });
    });
}

export function broadcastState() {
    if (!ioInstance) return;

    ioInstance.emit("state-update", {
        clientCount: activeClients.size,
        files: uploadedFiles,
        requests: pendingRequests,
        approved: approvedDownloads,
        rejected: Array.from(rejectedRequests),
    });
}
