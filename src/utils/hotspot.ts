import { execSync, exec } from "child_process";
import os from "os";
import readline from "readline/promises";
import { stdin as input, stdout as output } from "process";

// Helper to auto-detect wireless interface name on Linux
function getLinuxWirelessInterface(): string {
    try {
        const output = execSync("nmcli -t -f DEVICE,TYPE device", {
            stdio: ["pipe", "pipe", "ignore"],
        }).toString();
        const lines = output.split("\n");
        for (const line of lines) {
            const [device, type] = line.split(":");
            if (type === "wifi" && device) {
                return device.trim();
            }
        }
    } catch (e) {
        // Fallback
    }
    return "wlan0";
}

/**
 * Interactive prompt allowing the user to choose whether to create a hotspot
 * and enter custom credentials.
 */
export async function promptHotspotCredentials(): Promise<{
    autoCreate: boolean;
    ssid: string;
    password: string;
}> {
    const rl = readline.createInterface({ input, output });

    console.log("\n📡 Wi-Fi Hotspot Configuration:");
    console.log(
        "  1) Automatically create hotspot (Enter custom SSID & Password)",
    );
    console.log("  2) I have already created my own hotspot manually\n");

    try {
        const choice = await rl.question("👉 Choose an option (1 or 2): [1]: ");
        const selectedOption = choice.trim();

        if (
            selectedOption === "" ||
            selectedOption === "1" ||
            selectedOption.toLowerCase().includes("auto")
        ) {
            console.log("\n--- Hotspot Setup ---");
            const ssidInput = await rl.question(
                "👉 Enter Hotspot Name (SSID) [Capital-Ai-Drop-1]: ",
            );
            const passInput = await rl.question(
                "👉 Enter Password (min 8 chars) [workshop123]: ",
            );
            rl.close();

            return {
                autoCreate: true,
                ssid: ssidInput.trim() || "Capital-Ai-Drop-1",
                password: passInput.trim() || "workshop123",
            };
        }

        rl.close();
        return { autoCreate: false, ssid: "", password: "" };
    } catch (e) {
        rl.close();
        return {
            autoCreate: true,
            ssid: "Capital-Ai-Drop",
            password: "workshop123",
        };
    }
}

/**
 * Asynchronously starts the Wi-Fi hotspot in the background without blocking the event loop.
 */
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
            const interfaceName = getLinuxWirelessInterface();
            console.log(
                `🔍 Detected Linux Wi-Fi interface: "${interfaceName}"`,
            );
            command = `nmcli device wifi hotspot ifname ${interfaceName} ssid "${ssid}" password "${password}"`;
        } else {
            console.log(
                "⚠️ Hotspot auto-creation not supported on this platform.",
            );
            resolve(false);
            return;
        }

        console.log(`🌐 Attempting to spin up Wi-Fi Hotspot "${ssid}"...`);

        // Use non-blocking 'exec' so the server continues starting and Ctrl+C works!
        const hotspotProcess = exec(command);

        // Give it a couple seconds to establish, then resolve success
        let resolved = false;

        hotspotProcess.on("error", (error) => {
            if (!resolved) {
                resolved = true;
                console.error(`❌ Hotspot error: ${error.message}`);
                resolve(false);
            }
        });

        // If the process exits immediately with an error code
        hotspotProcess.on("exit", (code) => {
            if (code !== 0 && !resolved) {
                resolved = true;
                console.error(`❌ Hotspot exited with code ${code}`);
                resolve(false);
            }
        });

        // Assume success after a short timeout if no immediate failure occurs
        setTimeout(() => {
            if (!resolved) {
                resolved = true;
                console.log(
                    `✅ Hotspot active! Connected devices can now join "${ssid}".`,
                );
                resolve(true);
            }
        }, 2000);
    });
}
