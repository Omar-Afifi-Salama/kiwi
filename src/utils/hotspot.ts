import { execSync, exec } from "child_process";
import os from "os";
import { select, text, isCancel, cancel, note } from "@clack/prompts";
import pc from "picocolors";

export function getActiveWirelessInterface(): string {
    const platform = os.platform();

    try {
        if (platform === "linux") {
            try {
                const output = execSync("nmcli -t -f DEVICE,TYPE device", {
                    stdio: ["pipe", "pipe", "ignore"],
                }).toString();
                for (const line of output.split("\n")) {
                    const [device, type] = line.split(":");
                    if (type === "wifi" && device) return device.trim();
                }
            } catch (e) {}

            const interfaces = execSync("ls /sys/class/net/", {
                stdio: ["pipe", "pipe", "ignore"],
            })
                .toString()
                .split("\n");
            for (const iface of interfaces) {
                const trimmed = iface.trim();
                if (trimmed.startsWith("wl") || trimmed.startsWith("wlan"))
                    return trimmed;
            }
            return "wlan0";
        } else if (platform === "darwin") {
            try {
                const output = execSync("networksetup -listallhardwareports", {
                    stdio: ["pipe", "pipe", "ignore"],
                }).toString();
                const lines = output.split("\n");
                for (let i = 0; i < lines.length; i++) {
                    if (
                        lines[i]?.includes("Hardware Port: Wi-Fi") ||
                        lines[i]?.includes("Hardware Port: AirPort")
                    ) {
                        const match =
                            lines[i + 1]?.match(/Device:\s*(en[0-9]+)/);
                        if (match && match[1]) return match[1];
                    }
                }
            } catch (e) {}
            return "en0";
        } else if (platform === "win32") {
            try {
                const output = execSync(
                    "powershell \"Get-NetAdapter | Where-Object {$_.InterfaceDescription -like '*Wi-Fi*' -or$_.InterfaceDescription -like '*Wireless*'} | Select-Object -ExpandProperty Name\"",
                    { stdio: ["pipe", "pipe", "ignore"] },
                )
                    .toString()
                    .trim();
                if (output) return output.split("\n")[0]?.trim() || "Wi-Fi";
            } catch (e) {}
            return "Wi-Fi";
        }
    } catch (e) {}
    return "wlan0";
}

export async function promptHotspotCredentials(): Promise<{
    autoCreate: boolean;
    ssid: string;
    password: string;
}> {
    const choice = await select({
        message: pc.bold("Wi-Fi Hotspot Configuration:"),
        options: [
            {
                value: "auto",
                label: "Automatically create hotspot",
                hint: "Enter custom SSID & Password",
            },
            {
                value: "manual",
                label: "I have already created my own hotspot manually",
            },
        ],
    });

    if (isCancel(choice)) {
        cancel(pc.yellow("Operation cancelled by user."));
        process.exit(0);
    }

    if (choice === "auto") {
        const ssidInput = await text({
            message: "Enter Hotspot Name (SSID):",
            initialValue: "Capital-Ai-Drop-1",
            placeholder: "Capital-Ai-Drop-1",
        });
        if (isCancel(ssidInput)) {
            cancel(pc.yellow("Operation cancelled by user."));
            process.exit(0);
        }

        const passInput = await text({
            message: "Enter Password (min 8 chars):",
            initialValue: "workshop123",
            placeholder: "workshop123",
            validate: (value) => {
                if (value && value.length < 8)
                    return "Password must be at least 8 characters long.";
            },
        });
        if (isCancel(passInput)) {
            cancel(pc.yellow("Operation cancelled by user."));
            process.exit(0);
        }

        return {
            autoCreate: true,
            ssid: (ssidInput as string).trim() || "Capital-Ai-Drop-1",
            password: (passInput as string).trim() || "workshop123",
        };
    }
    return { autoCreate: false, ssid: "", password: "" };
}

export function createHotspot(
    ssid: string,
    password: string,
): Promise<boolean> {
    return new Promise((resolve) => {
        const platform = os.platform();
        let command = "";

        if (platform === "win32") {
            command = `netsh wlan set hostednetwork mode=allow ssid="${ssid}" key="${password}" && netsh wlan start hostednetwork`;
        } else if (platform === "darwin") {
            command = `networksetup -createnetworkservice "ClubHotspot" Wi-Fi && networksetup -setairportpower Wi-Fi on`;
        } else if (platform === "linux") {
            const interfaceName = getActiveWirelessInterface();
            note(
                pc.dim(`Detected Linux Wi-Fi interface: "${interfaceName}"`),
                "Hardware Info",
            );
            command = `nmcli device wifi hotspot ifname ${interfaceName} ssid "${ssid}" password "${password}"`;
        } else {
            note(
                pc.red("Hotspot auto-creation not supported on this platform."),
                "Warning",
            );
            resolve(false);
            return;
        }

        const hotspotProcess = exec(command);
        let resolved = false;

        hotspotProcess.on("error", () => {
            if (!resolved) {
                resolved = true;
                resolve(false);
            }
        });

        hotspotProcess.on("exit", (code) => {
            if (code !== 0 && !resolved) {
                resolved = true;
                resolve(false);
            }
        });

        setTimeout(() => {
            if (!resolved) {
                resolved = true;
                resolve(true);
            }
        }, 2000);
    });
}
