import qrcode from "qrcode-terminal";
import pc from "picocolors";

/**
 * Renders two QR code strings side-by-side in the terminal.
 */
export function renderSideBySideQRs(
    qr1Str: string,
    qr2Str: string,
    label1: string,
    label2: string,
) {
    const lines1 = qr1Str.split("\n");
    const lines2 = qr2Str.split("\n");

    // Find the max width of the first QR code to align the second one
    const maxLen1 = Math.max(...lines1.map((l) => l.length));

    console.log(`  ${pc.bold(label1.padEnd(maxLen1 + 6))}${pc.bold(label2)}`);

    const maxRows = Math.max(lines1.length, lines2.length);
    for (let i = 0; i < maxRows; i++) {
        const row1 = lines1[i] || "";
        const row2 = lines2[i] || "";
        // Pad row1 so the second QR code sits neatly next to it with spacing
        console.log(`  ${row1.padEnd(maxLen1 + 6)}${row2}`);
    }
}
