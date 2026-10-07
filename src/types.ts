import type { Response } from "express";

export interface StoredFile {
    id: string;
    name: string;
    path: string;
    size: number;
}

export interface PendingRequest {
    requestId: string;
    fileId: string;
    fileName: string;
    clientIP: string;
    timestamp: number;
}

export interface SafePendingRequest {
    requestId: string;
    fileName: string;
    clientIP: string;
}
