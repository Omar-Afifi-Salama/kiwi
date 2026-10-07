import { execSync } from "child_process";
import os from "os";
import pc from "picocolors";

// Helper to auto-detect wireless interface name on Linux robustly
export function getWirelessInterface(): string {
    const platform = os.platform();
    if (platform !== "linux") return "wlan0";

    try {
        // Method 1: Use NetworkManager (nmcli)
        const output = execSync("nmcli -t -f DEVICE,TYPE device", {
            stdio: ["pipe", "pipe", "ignore"],
        }).toString();
        for (const line of output.split("\n")) {
            const [device, type] = line.split(":");
            if (type === "wifi" && device) {
                return device.trim();
            }
        }
    } catch (e) {
        // nmcli failed or not installed, try alternative
    }

    try {
        // Method 2: Scan active system network directories (/sys/class/net/)
        const interfaces = execSync("ls /sys/class/net/", {
            stdio: ["pipe", "pipe", "ignore"],
        })
            .toString()
            .split("\n");
        for (const iface of interfaces) {
            const trimmed = iface.trim();
            if (trimmed.startsWith("wl") || trimmed.startsWith("wlan")) {
                return trimmed;
            }
        }
    } catch (e) {
        // Fallback
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
            if (!linkSpeedMbps) {
                try {
                    const iwOutput = execSync(`iw dev ${interfaceName} link`, {
                        stdio: ["pipe", "pipe", "ignore"],
                    }).toString();
                    const match = iwOutput.match(
                        /(?:tx )?bitrate:\s*([0-9.]+)\s*MBit\/s/i,
                    );
                    if (match && match[1]) {
                        linkSpeedMbps = parseFloat(match[1]);
                    }
                } catch (err) {
                    // iw not available or failed
                }
            }

            // Method 2: Try querying active Wi-Fi rate via 'nmcli' device wifi list
            if (!linkSpeedMbps) {
                try {
                    const nmcliOutput = execSync(
                        "nmcli -t -f ACTIVE,RATE dev wifi",
                        { stdio: ["pipe", "pipe", "ignore"] },
                    ).toString();
                    for (const line of nmcliOutput.split("\n")) {
                        if (line.startsWith("yes:")) {
                            const rateStr = line.split(":")[1]; // e.g., "150 Mbit/s"
                            const match = rateStr?.match(/([0-9.]+)/);
                            if (match && match[1]) {
                                linkSpeedMbps = parseFloat(match[1]);
                                break;
                            }
                        }
                    }
                } catch (err) {
                    // nmcli dev wifi failed
                }
            }

            // Method 3: Try legacy 'iwconfig' fallback
            if (!linkSpeedMbps) {
                try {
                    const iwconfigOutput = execSync(
                        `iwconfig ${interfaceName}`,
                        { stdio: ["pipe", "pipe", "ignore"] },
                    ).toString();
                    const match = iwconfigOutput.match(
                        /Bit Rate=([0-9.]+)\s*Mb\/s/i,
                    );
                    if (match && match[1]) {
                        linkSpeedMbps = parseFloat(match[1]);
                    }
                } catch (err) {
                    // iwconfig not installed
                }
            }
        } else if (platform === "darwin") {
            try {
                const output = execSync(
                    "/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport -I",
                    { stdio: ["pipe", "pipe", "ignore"] },
                ).toString();
                const match = output.match(/lastTxRate:\s*([0-9]+)/);
                if (match && match[1]) {
                    linkSpeedMbps = parseInt(match[1], 10);
                }
            } catch (e) {
                // airport failed
            }
        } else if (platform === "win32") {
            try {
                const output = execSync(
                    "powershell \"Get-NetAdapter | Where-Object {$_.Status -eq 'Up'} | Select-Object -ExpandProperty LinkSpeed\"",
                    { stdio: ["pipe", "pipe", "ignore"] },
                ).toString();
                const match = output.match(/([0-9]+)\s*Mbps/i);
                if (match && match[1]) {
                    linkSpeedMbps = parseInt(match[1], 10);
                }
            } catch (e) {
                // PowerShell failed
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
    const ceilingMB = (safeUsableBandwidth / (1024 * 1024)).toFixed(1);

    // Styled output with picocolors
    console.log(
        pc.cyan(`📊 Active Wi-Fi Link Speed: `) +
            pc.bold(`~${linkSpeedMbps} Mbps`) +
            pc.dim(` | Usable Host Ceiling: `) +
            pc.green(`${ceilingMB} MB/s`),
    );

    return Math.max(safeUsableBandwidth, 10 * 1024 * 1024); // Minimum floor of 10 MB/s
}
