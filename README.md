# Manga Tracker 🚀

A premium, self-hosted Manga and Anime tracking system. It automatically intercepts and tracks your reading progress across various manga sites using a Chrome Extension, and displays your collection in a stunning **Deep Space Glass UI** dashboard.

## ✨ Features

- **Automated Tracking**: A lightweight Chrome Extension runs in the background and automatically updates your reading progress whenever you visit a manga or anime chapter page.
- **Premium Dashboard**: A beautifully designed, native-app-like web dashboard (Deep Space Glass UI) that looks incredible on both Desktop and Mobile OLED screens.
- **Local Cover Caching**: Automatically fetches and caches manga cover images locally for lightning-fast loading times.
- **Invisible Engine**: The Go backend runs silently in your Windows System Tray. No annoying console windows!
- **Custom Domains**: Easily add your favorite unsupported manga sites directly from the dashboard settings.

## 🛠️ Architecture

The project consists of two main parts:
1. **The Backend (Go & SQLite)**: A blazing fast local API server (`http://localhost:8264`) that handles data storage, cover image caching, and serves the frontend UI.
2. **The Extension (JavaScript)**: A Chrome extension that monitors your active tabs and sends reading updates (`window.postMessage` & `fetch`) to the local API.

## 🚀 Installation & Setup

### 1. Start the Backend
You will need [Go](https://golang.org/) installed on your machine.
1. Clone this repository.
2. Run the build script:
   ```cmd
   build_and_restart.bat
   ```
   *This will compile the Go binary with hidden window flags (`-H=windowsgui`) and launch the server into your System Tray.*

### 2. Install the Chrome Extension
1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** (top right corner).
3. Click **Load unpacked** and select the `extension` folder inside this repository.
4. Open the extension popup, and it will automatically connect if the backend is running.

### 3. Open the Dashboard
Navigate to [http://localhost:8264](http://localhost:8264) in your browser. 

## ⚙️ Configuration
You can add custom domains to track (e.g., specific scanlation sites) directly through the **Settings** menu on the Dashboard. The settings sync instantly to the Chrome extension.

## 💻 Tech Stack
- **Backend**: Go (Golang), `mattn/go-sqlite3`, `getlantern/systray`
- **Frontend**: Vanilla HTML/CSS/JS (Zero framework, pure performance)
- **Extension**: Chrome Manifest V3

---
*Crafted with precision for manga enthusiasts.*
