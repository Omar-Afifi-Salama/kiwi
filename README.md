# kiwi

A lightweight Express and TypeScript file-sharing tool built to distribute large workshop files (datasets, VM images, starter kits) to a room full of students over a local Wi-Fi hotspot without needing an internet connection.

## Why it exists

In a typical classroom setting, if 40 students try to download a 200MB file at the exact same time, the local Wi-Fi router chokes, packets drop, and the connection stalls. `kiwi` solves this by enforcing an active download concurrency cap and routing excess clients into an automated queue with real-time position tracking.

## Core Features

- **Local Hotspot First:** Runs completely offline over a local network or tethered hotspot.
- **Concurrency Limiter:** Restricts active downloads to a safe threshold (e.g., 4 concurrent slots) to prevent router congestion.
- **Smart Queueing:** Excess students are placed into a queue, receiving position updates and ETA calculations until an active slot opens up.
- **Restricted Host Panel:** The student portal is available at `/`, while administrative controls (`/host`) like file uploads and auto-accept toggles are restricted to local loopback (localhost).
- **Stress Testing Suite:** Includes an automated load test (`node:test` + `supertest`) that simulates 30 concurrent clients, handling streaming binary payloads and tracking throughput metrics in a live terminal dashboard.
- **Standalone Binaries:** Can be compiled into a single self-contained executable using Bun, meaning the workshop host doesn't need Node.js installed.

## Tech Stack

- **Runtime & Framework:** Node.js, Express.js, TypeScript
- **Testing:** Node.js test runner (`node:test`), `supertest`
- **Compilation:** Bun compiler (`bun build --compile`)

---

## Getting Started

### 1. Installation

```bash
git clone https://github.com/your-username/kiwi.git
cd kiwi
npm install
```

### 2. Development

Start the development server with hot-reloading:

```bash
npm run dev
```

- **Student View:** `http://localhost:8080/`
- **Host Control Center:** `http://localhost:8080/host`

### 3. Running the Load Test

To run the automated stress test simulating 30 concurrent students pulling heavy files through the queue:

```bash
npm test
```

---

## Building Binaries

If you want to compile standalone executables for distribution (Windows, Linux, and macOS) so the host can run the app without a Node environment:

```bash
npm run build:all
```

Binaries will be outputted to the `dist-bin/` directory:

- `dist-bin/kiwi-linux-x64`
- `dist-bin/kiwi-win-x64.exe`
- `dist-bin/kiwi-mac-arm64`

---

## Workshop Workflow

1. Turn on your laptop's Wi-Fi hotspot.
2. Launch `kiwi` (either via `npm run dev` or by executing the compiled binary).
3. Open `http://localhost:8080/host` on the host machine to upload your workshop files.
4. Have students connect to your hotspot, if their platform supports it, the receiving page will automatically be open for them, if not they will need to navigate to your local IP address to start downloading or wait in the queue.
