<div align="center">
  <img src="logo.png" alt="APIScan Ai Logo" width="120" />

  # APIScan Ai
  **The Elite API Key Validation & Auditing Engine**

  [![Tauri](https://img.shields.io/badge/Tauri-2.0-24c8da?logo=tauri&logoColor=white)](#)
  [![Rust](https://img.shields.io/badge/Rust-1.75+-000000?logo=rust&logoColor=white)](#)
  [![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=black)](#)
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

  *Secure, Local-First, and Blazing Fast Bulk API Key Validation.*
</div>

---

## � Overview

**APIScan Ai** is a high-performance desktop application tailored for developers, researchers, and AI professionals. It effortlessly audits and validates massive datasets of AI API keys (OpenAI, Anthropic, Gemini, Groq, etc.). 

Built with a **Rust** core and a **React** frontend using **Tauri**, APIScan Ai eliminates the limitations of traditional web-based validators. It offers unparalleled speed, handles files with over 50,000+ rows (15MB+), and guarantees absolute privacy by processing everything locally on your machine.

---

## ✨ Key Features

- 🚀 **Limit-Breaker Engine**: A custom-built, streaming CSV/XLSX parser designed to parse and extract keys from large files instantly without freezing the UI or consuming excessive RAM.
- 🧠 **Smart Auto-Detection**: Uses internal heuristics to identify the AI provider based solely on the format of the API key. No manual selection needed.
- 👑 **Flagship Model Auditing**: Not only checks if a key is valid, but intelligently queries endpoints to detect if the key has access to "Flagship" premium models (e.g., `gpt-4o`, `claude-3-5-sonnet-latest`).
- 🔒 **100% Local & Secure**: No intermediary servers. No data collection. The application compiles to a standalone Rust binary that communicates directly and securely with the official AI provider endpoints.
- 🌍 **Bilingual Support**: Fully localized in both English (EN) and Arabic (AR) with seamless RTL/LTR layout switching.
- 💎 **Premium Glassmorphism UI**: A gorgeous, highly responsive, and hardware-accelerated user interface featuring micro-animations, built via Tailwind CSS and Framer Motion.

---

## 🏗️ Technical Architecture

APIScan Ai operates on a strict separation of concerns, leveraging Tauri's IPC (Inter-Process Communication) bridge:

### The Backend (Rust / Tauri)
- **Data Parsing**: Uses `csv` (with flexible dimension handling) and customized `quick-xml` & `zip` implementations to parse malformed or massive `.xlsx` and `.xls` files directly from disk streams.
- **Concurrency**: Leverages `tokio` asynchronous runtimes and `Semaphore` to execute multi-threaded, parallel HTTP validation requests (via `reqwest`) without hitting OS socket limits.
- **Memory Management**: Extracts only file metadata to send to the UI. The actual dataset is streamed chunk-by-chunk during the validation process.

### The Frontend (React 19 / TypeScript)
- **View Layer**: Built with React 19, focusing on functional components and hooks.
- **Styling**: Tailwind V4 coupled with bespoke Vanilla CSS for intricate Glassmorphic panels, scrollbars, and dynamic background generation.
- **State Management**: React state synced gracefully with Tauri events emitted from the Rust backend (e.g., `test-result`, `test-finished`).

---

## 💻 Tech Stack

- **Application Framework**: [Tauri v2](https://tauri.app/)
- **Systems Language**: [Rust](https://www.rust-lang.org/)
- **Frontend Framework**: [React 19](https://react.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)

---

## 🚀 Getting Started (Local Development)

### 1. Prerequisites
Ensure you have the following installed on your system:
- [Node.js](https://nodejs.org/en/) (v18 or higher)
- [Rust](https://www.rust-lang.org/tools/install) (Ensure `rustup` is in your PATH)
- C++ Build Tools (Specifically for Windows users: Visual Studio C++ Build tools)

### 2. Clone the Repository
```bash
git clone https://github.com/Omar-Tnzxo/ApiScan-Ai.git
cd ApiScan-Ai
```

### 3. Install Dependencies
Install the JS/TS packages via npm:
```bash
npm install
```

### 4. Run the Development Server
Launch the application in development mode (spins up both Vite dev server and the Rust backend):
```bash
npm run tauri dev
```
*(Note: The first run will take some time as Cargo compiles the Rust dependencies).*

---

## 📦 Building for Production

To create a standalone, optimized executable for your operating system:

```bash
npm run tauri build
```

Once completed, the installers and executables will be located in:
- **Windows**: `src-tauri/target/release/bundle/nsis/`

---

## 🛡️ Privacy & Security Model

APIScan Ai was built with a "Zero-Trust" mindset regarding third-party servers:
1. **Direct connections**: The application makes HTTPS requests *directly* from your machine's IP address to the respective official API endpoints (e.g., `https://api.openai.com`).
2. **Memory cleanup**: API keys are held volatilely in RAM only during the exact moment of execution and are immediately dropped post-check.
3. **CSP Enforcement**: Content Security Policy is strictly defined in `tauri.conf.json` to prevent arbitrary code execution or connections to unspecified domains.

---

## 📄 License

This project is licensed under the **MIT License**. See the [LICENSE](./LICENSE) file for full details.

---
<p align="center">
  Crafted with passion by <b>RebixRise</b>.
</p>
