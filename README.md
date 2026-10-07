<div align="center">

<img src="./assets/banner.png" alt="kiwi banner" width="100%" style="border-radius: 8px;"/>

<br />

<img src="https://img.shields.io/badge/Under%20the%20umbrella%20of-Capital--AI-7C3AED?style=for-the-badge" height="35" />

<br />

_A lightweight Express and TypeScript file-sharing tool built to distribute large workshop files to a room full of students over a local Wi-Fi hotspot without an internet connection._

<br />

[![Version](https://img.shields.io/badge/version-1.1.0-blue.svg?style=for-the-badge)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](#)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge)](#)
[![Maintained](https://img.shields.io/badge/Maintained%3F-yes-brightgreen.svg?style=for-the-badge)](#)
[![Platforms](https://img.shields.io/badge/platform-linux%20%7C%20macOS%20%7C%20windows-lightgrey.svg?style=for-the-badge)](#)
[![Built with Bun](https://img.shields.io/badge/Built_with-Bun-000000.svg?style=for-the-badge&logo=bun&logoColor=white)](#)

</div>

## Why it exists

In a typical classroom setting, if 40 students try to download a 200MB file at the exact same time, the local Wi-Fi router chokes, packets drop, and the connection stalls. `kiwi` solves this by enforcing an active download concurrency cap and routing excess clients into an automated queue with real-time position tracking.

## 🌟 Core Features

- **Local Hotspot First:** Runs completely offline over a local network or tethered hotspot.
- **Concurrency Limiter:** Restricts active downloads to a safe threshold (e.g., 4 concurrent slots) to prevent router congestion.
- **Smart Queueing:** Excess students are placed into a queue, receiving position updates and ETA calculations until an active slot opens up.
- **Restricted Host Panel:** The student portal is available at `/`, while administrative controls (`/host`) like file uploads and auto-accept toggles are restricted to local loopback (localhost).
- **Stress Testing Suite:** Includes an automated load test (`node:test` + `supertest`) that simulates 30 concurrent clients, handling streaming binary payloads and tracking throughput metrics in a live terminal dashboard.
- **Standalone Binaries:** Can be compiled into a single self-contained executable using Bun, meaning the workshop host doesn't need Node.js installed.

## 🧠 How It Works (Under the Hood)

- **Two-Step Stream Architecture:** To prevent mobile browsers and OS network monitors from timing out during the queue or while waiting for host approval, `kiwi` decouples the HTTP request. Clients first request a token via JSON. Once a concurrency slot opens up (or the host approves), a `Socket.io` event triggers the client to initiate the actual high-speed binary stream.
- **Captive Portal Routing:** Includes custom Express middleware that intercepts native OS connectivity probes (e.g., Apple, Android, Windows) and redirects them to the local drop hub.
- **Terminal UI & QR Codes:** Uses `@clack/prompts` and `qrcode-terminal` to generate an interactive startup sequence and side-by-side QR codes, allowing students to bypass captive portal SSL restrictions by simply scanning their screen to connect.

## 🛠️ Tech Stack

<img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" height="35" />
<img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" height="35" />
<img src="https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white" height="35" />
<img src="https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socketdotio&logoColor=white" height="35" />
<img src="https://img.shields.io/badge/Bun-000000?style=for-the-badge&logo=bun&logoColor=white" height="35" />

<br>

**CLI & Testing Utilities**

<img src="https://img.shields.io/badge/%40clack%2Fprompts-FF4154?style=for-the-badge" height="35" />
<img src="https://img.shields.io/badge/qrcode--terminal-000000?style=for-the-badge&logo=qrcode&logoColor=white" height="35" />
<img src="https://img.shields.io/badge/supertest-12A745?style=for-the-badge" height="35" />

---

## 📂 Project Structure

```bash
kiwi/
├── src/                          # Main backend source code
│   ├── config.ts                 # Global environment variables and directory paths
│   ├── index.ts                  # Server entry point, Express setup, and middleware pipeline
│   ├── middleware/
│   │   └── captive.ts            # OS captive portal interception to redirect users to the hub
│   ├── routes/                   # Express route controllers
│   │   ├── api.ts                # Host controls: resolving requests and toggling auto-accept
│   │   ├── files.ts              # Core transfer logic: uploads and the two-step download stream
│   │   ├── index.ts              # Router aggregator
│   │   └── pages.ts              # Serves the static HTML views (student portal & host panel)
│   ├── sockets/
│   │   └── index.ts              # Socket.io implementation for real-time queue and state broadcasts
│   ├── state.ts                  # In-memory database (download queue, active transfers, approvals)
│   ├── types.ts                  # Shared TypeScript interfaces (QueueItem, PendingRequest, etc.)
│   └── utils/                    # Standalone helper functions
│       ├── bandwidth.ts          # Calculates dynamic host bandwidth and transfer limits
│       ├── hotspot.ts            # OS-specific Wi-Fi hotspot creation and Clack CLI prompts
│       ├── logo.ts               # Terminal ASCII logo renderer
│       ├── network.ts            # Cross-platform active wireless IP resolution
│       └── renderQrCodes.ts      # Side-by-side terminal QR code generator
├── public/                       # Frontend assets (served directly to browsers)
│   ├── css/
│   │   ├── host.css              # Styling for the restricted Host Control Panel
│   │   └── index.css             # Styling for the main Student/Receiver view
│   ├── js/
│   │   ├── host.js               # Frontend socket listeners and API calls for the host
│   │   └── index.js              # Receiver logic (download requests, socket waiting, stream trigger)
│   ├── host.html                 # The Host Control Panel markup
│   ├── index.html                # The Student/Receiver portal markup
│   └── kiwi-icon.png             # Web favicon
├── icons/                        # OS-specific icons for compiling standalone executables
│   ├── kiwi-icon.icns            # macOS app icon format
│   ├── kiwi-icon.ico             # Windows app icon format
│   └── kiwi-icon.png             # Linux app icon format
├── tests/
│   └── stress-test.test.ts       # Automated 30-client concurrency load test (node:test + supertest)
├── package.json                  # Project dependencies and npm scripts (dev, test, build:all)
├── package-lock.json             # Dependency version lockfile
├── README.md                     # Project documentation and setup guide
├── LICENSE                       # MIT License
└── tsconfig.json                 # TypeScript compiler configuration
```

## 🚀 Getting Started

### 1. Installation

```bash
git clone https://github.com/Omar-Afifi-Salama/kiwi.git
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

## 📦 Building Binaries

If you want to compile standalone executables for distribution (Windows, Linux, and macOS) so the host can run the app without a Node environment:

```bash
# for windows users
npm run build:windows

# for linux users
npm run build:linux

# for macos users
npm run build:macos

# a way to build all of them at once
npm run build:all
```

Binaries will be outputted to the `dist-bin/` directory:

- `dist-bin/kiwi-linux-x64`
- `dist-bin/kiwi-win-x64.exe`
- `dist-bin/kiwi-mac-arm64`

## 🏫 Workshop Workflow

1. Turn on your laptop's Wi-Fi hotspot (or let the CLI auto-create one for you).
2. Launch `kiwi` (either via `npm run dev` or by executing the compiled binary).
3. Open `http://localhost:8080/host` on the host machine to upload your workshop files.
4. Display the terminal window on a projector. Students can scan the generated **QR Codes** to join the Wi-Fi network and instantly open the drop hub in their browser.
5. If auto-accept is off, manage incoming download requests from the Host Control Center.

## 🔧 Troubleshooting

- **Port `8080` Already in Use (`EADDRINUSE`):** If the server crashes on startup because the port is occupied, kill the existing process by running `npx kill-port 8080`.
- **Mobile Devices & Captive Portals:** Modern mobile operating systems enforce strict HTTPS rules for captive portals. Since `kiwi` runs locally over standard HTTP, mobile devices might flag it and drop the connection silently. **Solution:** Ask users to use their camera to scan the terminal-generated QR codes to join the network and open the app natively.

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://www.google.com/search?q=https://github.com/your-username/kiwi/issues).

## 📄 License

This project is under the [MIT](./LICENSE) license.
