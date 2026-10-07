import path from "path";
import os from "os";
import fs from "fs";

export const PORT = 8080;
export const uploadDir = path.join(os.tmpdir(), "kiwi");

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
