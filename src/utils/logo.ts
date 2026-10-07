// src/utils/logo.ts
import { renderFilled } from "oh-my-logo";

export async function renderKiwiLogo(): Promise<void> {
    try {
        await renderFilled("Kiwi", {
            font: "block", // Matches --block-font block
            direction: "vertical", // Matches -d vertical
            palette: ["#22c55e", "#84cc16"], // Custom green-to-lime gradient
            letterSpacing: 1,
        });
    } catch {
        console.log("\n 🥝 KIWI \n");
    }
}
