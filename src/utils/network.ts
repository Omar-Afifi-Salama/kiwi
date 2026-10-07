import os from "os";
import { getActiveWirelessInterface } from "./hotspot.js";

export function getLocalIP(): string {
    const interfaces = os.networkInterfaces();
    const activeInterface = getActiveWirelessInterface();
    const allCandidates: { name: string; address: string }[] = [];

    for (const name of Object.keys(interfaces)) {
        const nets = interfaces[name];
        if (nets) {
            for (const net of nets) {
                if (net.family === "IPv4" && !net.internal) {
                    allCandidates.push({ name, address: net.address });
                }
            }
        }
    }

    // 1. Strict match against detected active Wi-Fi interface
    if (activeInterface && interfaces[activeInterface]) {
        for (const net of interfaces[activeInterface] || []) {
            if (net.family === "IPv4" && !net.internal) return net.address;
        }
    }

    // 2. Look for typical Linux hotspot names if strict match failed
    const wirelessCandidate = allCandidates.find(
        (c) =>
            c.name.startsWith("wl") ||
            c.name.startsWith("wlan") ||
            c.name.includes("hotspot"),
    );
    if (wirelessCandidate) return wirelessCandidate.address;

    // 3. Look for any non-virtual IPv4 address
    const publicCandidate = allCandidates.find(
        (c) =>
            !c.name.startsWith("docker") &&
            !c.name.startsWith("br-") &&
            !c.name.startsWith("veth"),
    );
    if (publicCandidate) return publicCandidate.address;

    return allCandidates[0]?.address || "127.0.0.1";
}
