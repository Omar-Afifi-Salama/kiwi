import { exec, execSync } from "child_process";
import os from "os";

// Helper to auto-detect wireless interface name on Linux
function getLinuxWirelessInterface(): string {
    try {
        // Run 'nmcli device' and parse the output for wifi devices
        const output = execSync("nmcli -t -f DEVICE,TYPE device").toString();
        const lines = output.split("\n");
        for (const line of lines) {
            const [device, type] = line.split(":");
            if (type === "wifi" && device) {
                return device.trim();
            }
        }
    } catch (e) {
        console.error("⚠️ Could not auto-detect Wi-Fi interface via nmcli.");
    }
    return "wlan0"; // Fallback default
}

export function createHotspot(ssid: string, password: string) {
    const platform = os.platform();
    let command = "";

    if (platform === "win32") {
        command = `netsh wlan set hostednetwork mode=allow ssid="${ssid}" key="${password}" && netsh wlan start hostednetwork`;
    } else if (platform === "darwin") {
        command = `networksetup -createnetworkservice "ClubHotspot" Wi-Fi && networksetup -setairportpower Wi-Fi on`;
    } else if (platform === "linux") {
        const interfaceName = getLinuxWirelessInterface();
        console.log(`🔍 Detected Linux Wi-Fi interface: "${interfaceName}"`);
        command = `nmcli device wifi hotspot ifname ${interfaceName} ssid "${ssid}" password "${password}"`;
    }

    if (!command) {
        console.log("⚠️ Hotspot auto-creation not supported on this platform.");
        return;
    }

    console.log(`🌐 Attempting to spin up Wi-Fi Hotspot "${ssid}"...`);
    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`❌ Hotspot creation failed: ${error.message}`);
            console.log(
                "⚠️ Automatic hotspot creation is restricted on Windows/Mac. Please turn on your OS Mobile Hotspot / Internet Sharing manually, then start the server!",
            );
            return;
        }
        console.log(
            `✅ Hotspot active! Connected devices can now join "${ssid}".`,
        );
    });
}
