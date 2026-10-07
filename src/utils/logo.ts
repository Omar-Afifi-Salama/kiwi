// src/utils/logo.ts
import { renderFilled } from "oh-my-logo";
import pc from "picocolors";

export async function renderKiwiLogo(): Promise<void> {
    try {
        await renderFilled("Kiwi", {
            font: "block", // Matches --block-font block
            direction: "vertical", // Matches -d vertical
            palette: ["#22c55e", "#84cc16"], // Custom green-to-lime gradient
            letterSpacing: 1,
        });
    } catch {
        console.log(pc.bold(pc.greenBright("\n 🥝 KIWI \n")));
    }

    console.log(pc.bold(pc.magentaBright("----- Under The Umbrella Of -----")));

    try {
        await renderFilled("Capital-AI", {
            font: "block", // Matches --block-font block
            direction: "vertical", // Matches -d vertical
            palette: ["#c084fc", "#3b82f6"], // Custom green-to-lime gradient
            letterSpacing: 1,
        });
    } catch {
        console.log(pc.bold(pc.magentaBright("\n Capital-AI \n")));
    }
}
