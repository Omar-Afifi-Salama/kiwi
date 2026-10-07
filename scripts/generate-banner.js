import { createCanvas } from "canvas";
import fs from "fs";
import { renderFilled } from "oh-my-logo";

async function generateBanners() {
    let terminalBanner = "";

    // 1. Intercept standard output to capture the logo string
    const originalWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk, encoding, callback) => {
        terminalBanner += chunk.toString();
        return originalWrite(chunk, encoding, callback);
    };

    // Generate the logo
    await renderFilled("KIWI", {
        font: "block", // Matches --block-font block
        direction: "vertical", // Matches -d vertical
        palette: ["#22c55e", "#84cc16"], // Custom green-to-lime gradient
        letterSpacing: 1,
    });

    // Restore terminal behavior
    process.stdout.write = originalWrite;

    // Clean up trailing newlines
    terminalBanner = terminalBanner.replace(/\n+$/, "");

    // 2. Setup High-Resolution Canvas (2000x500 instead of 1000x250)
    const canvasWidth = 2000;
    const canvasHeight = 500;
    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext("2d");

    // Draw dark slate background
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // 3. Configure Font & Scaling
    const fontSize = 56; // Scaled up font size
    ctx.font = `bold ${fontSize}px "Courier New", monospace`;
    ctx.textBaseline = "top";

    const lines = terminalBanner.split("\n");

    // Exact centering math
    const stripAnsi = (str) => str.replace(/\x1b\[[0-9;]*m/g, "");
    const longestLineLength = Math.max(
        ...lines.map((l) => stripAnsi(l).length),
    );

    // Measure exact width of a single block character
    const blockWidth = ctx.measureText("█").width;

    // Use a 1.0 multiplier so vertical blocks touch seamlessly
    const lineHeight = fontSize * 1.0;

    // Calculate precise start coordinates to perfectly center the grid
    const totalTextWidth = longestLineLength * blockWidth;
    const totalTextHeight = lines.length * lineHeight;

    const startX = (canvasWidth - totalTextWidth) / 2;
    const startY = (canvasHeight - totalTextHeight) / 2;

    let currentY = startY;

    // 4. Parse ANSI codes and render blocks to canvas
    for (const line of lines) {
        let currentX = startX;
        let currentColor = "#84cc16"; // Fallback kiwi green

        const parts = line.split(/(\x1b\[[0-9;]*m)/);

        for (const part of parts) {
            if (part.startsWith("\x1b[")) {
                // Extract RGB values from truecolor ANSI codes
                const rgbMatch = part.match(/\x1b\[38;2;(\d+);(\d+);(\d+)m/);
                if (rgbMatch) {
                    currentColor = `rgb(${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]})`;
                }
            } else if (part.length > 0) {
                // Draw text chunk
                ctx.fillStyle = currentColor;
                ctx.fillText(part, currentX, currentY);
                // Advance X coordinate by exactly the measured width of the drawn blocks
                currentX += part.length * blockWidth;
            }
        }
        currentY += lineHeight;
    }

    // 5. Export high-res PNG
    const out = fs.createWriteStream("./assets/banner.png");
    const stream = canvas.createPNGStream();
    stream.pipe(out);

    out.on("finish", () =>
        console.log(
            "\n✅ High-Res banner perfectly centered and saved to ./public/banner.png",
        ),
    );
}

generateBanners();
