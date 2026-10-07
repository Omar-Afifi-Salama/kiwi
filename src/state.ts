import type { Response } from "express";
import { getDynamicHostBandwidth } from "./utils/bandwidth.js";
import type { PendingRequest, StoredFile } from "./types.js";

export const uploadedFiles: Record<string, StoredFile> = {};
export const pendingRequests: Record<string, PendingRequest> = {};
export const activeClients = new Set<string>();

// Dynamic Host Bandwidth setup
export const MAX_HOST_BANDWIDTH = getDynamicHostBandwidth();
export const MAX_CONCURRENT_DOWNLOADS = 4; // Hard cap to prevent socket thrashing
export const activeDownloads = new Set<string>();

export interface QueueItem {
    requestId: string;
    fileId: string;
    fileName: string;
    clientIP: string;
    res: Response;
    timestamp: number;
}

export const downloadQueue: QueueItem[] = [];

let _autoAccept = false;
export function getAutoAccept(): boolean {
    return _autoAccept;
}
export function toggleAutoAccept(): boolean {
    _autoAccept = !_autoAccept;
    return _autoAccept;
}

export function getQueuePosition(requestId: string): number {
    return downloadQueue.findIndex((item) => item.requestId === requestId) + 1;
}

export function calculateETA(queuePosition: number): number {
    if (queuePosition === 0) return 0;
    // Estimate ~1 minute per batch of concurrent downloads ahead
    const batchesAhead = Math.ceil(queuePosition / MAX_CONCURRENT_DOWNLOADS);
    return Math.max(1, batchesAhead);
}
