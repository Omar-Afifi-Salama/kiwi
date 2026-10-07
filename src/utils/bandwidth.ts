import { execSync } from "child_process";
import os from "os";

// Helper to auto-detect wireless interface name on Linux
export function getWirelessInterface(): string {
    try {
        const output = execSync("nmcli -t -f DEVICE,TYPE device").toString();
        const lines = output.split("\n");
        for (const line of lines) {
            const [device, type] = line.split(":");
            if (type === "wifi" && device) {
                return device.trim();
            }
        }
    } catch (e) {
        // Fallback if nmcli fails
    }
    return "wlan0";
}

export function getDynamicHostBandwidth(): number {
    const platform = os.platform();
    let linkSpeedMbps = 0;

    try {
        if (platform === "linux") {
            const interfaceName = getWirelessInterface();

            // Method 1: Try reading via 'iw dev <interface> link'
            try {
                const iwOutput = execSync(
                    `iw dev ${interfaceName} link`,
                ).toString();
                const match = iwOutput.match(
                    /(?:tx )?bitrate:\s*([0-9.]+)\s*MBit\/s/i,
                );
                if (match && match[1]) {
                    linkSpeedMbps = parseFloat(match[1]);
                }
            } catch (err) {
                // Ignore and try next method
            }

            // Method 2: Try reading via 'nmcli' device show if iw didn't return a speed
            if (!linkSpeedMbps) {
                try {
                    const nmcliOutput = execSync(
                        `nmcli -f GENERAL.BITRATE device show ${interfaceName}`,
                    ).toString();
                    const match = nmcliOutput.match(/([0-9]+)\s*Mbit\/s/i);
                    if (match && match[1]) {
                        linkSpeedMbps = parseInt(match[1], 10);
                    }
                } catch (err) {
                    // Ignore
                }
            }
        } else if (platform === "darwin") {
            const output = execSync(
                "/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport -I",
            ).toString();
            const match = output.match(/lastTxRate:\s*([0-9]+)/);
            if (match && match[1]) {
                linkSpeedMbps = parseInt(match[1], 10);
            }
        } else if (platform === "win32") {
            const output = execSync(
                "powershell \"Get-NetAdapter | Where-Object {$_.Status -eq 'Up'} | Select-Object -ExpandProperty LinkSpeed\"",
            ).toString();
            const match = output.match(/([0-9]+)\s*Mbps/i);
            if (match && match[1]) {
                linkSpeedMbps = parseInt(match[1], 10);
            }
        }
    } catch (e) {
        // Silent catch for system execution limits
    }

    // If link speed couldn't be resolved, fallback to a sensible 150 Mbps Wi-Fi baseline
    if (!linkSpeedMbps || isNaN(linkSpeedMbps)) {
        linkSpeedMbps = 150;
    }

    // Convert Megabits/sec to Bytes/sec, then apply a 60% safety ceiling for Wi-Fi half-duplex overhead
    const megabitsToBytesPerSec = (linkSpeedMbps * 1_000_000) / 8;
    const safeUsableBandwidth = Math.round(megabitsToBytesPerSec * 0.6);

    console.log(
        `📊 Active Wi-Fi Link Speed: ~${linkSpeedMbps} Mbps | Usable Host Ceiling: ${(safeUsableBandwidth / (1024 * 1024)).toFixed(1)} MB/s`,
    );

    return Math.max(safeUsableBandwidth, 10 * 1024 * 1024); // Minimum floor of 10 MB/s
}
