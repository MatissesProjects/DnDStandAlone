# DnD StandAlone VTT

A powerful, web-based Virtual Tabletop (VTT) that unifies **Excalidraw** for mapping, **Digital "Note Passing"** for immersion, and **Gemini AI** for dynamic world-building. Designed for both desktop and mobile play.

## 🚀 Advanced Features

### 🗺️ The Glass Layer (Interactivity)
- **Ping System:** Click-to-ping with synchronized ripple VFX and username labels.
- **Smart Measurement:** Alt/Shift + Drag to measure distances with location-specific grid scales.
- **Fog of War:** GM-controlled shroud with "Flashlight" clearing (Ctrl+Drag) to reveal secrets.

### 🎭 Split-Party Orchestration
- **Parallel Realities:** Move specific players into different manifested locations (locales).
- **Projection Command:** GMs can selectively project their map stream and audio to specific groups while "freezing" the view for others.
- **Switchboard:** Real-time UI for managing which adventurer is in which part of the world.

### 🔊 Dynamic Atmosphere
- **Multi-Channel Audio:** Independent volume controls for "Atmosphere" and "Music".
- **Local Uploads:** GMs can upload MP3/WAV files directly from their PC to the VTT.
- **Location-Linked Sound:** Ambience automatically changes as players move between locales.

### 🤖 AI Weaver (Gemini 2.5 Flash)
- **Manifest Entity:** Generate balanced NPC/Enemy stats and backstories.
- **Script Lore:** Augment GM drafts or generate new atmospheric sensory descriptions.
- **Forge Loot:** Context-aware loot generation based on current location and session history.
- **Fate Spinner:** A synchronized visual 3D-style spinner for dramatic random outcomes.

### ⚔️ Combat & Tracking
- **Automated Initiative:** Persistent tracker with turn-based highlighting.
- **LitRPG Stats:** Track class, level, and a personal "Bag" (inventory) per account.
- **Whisper Network:** Private messaging and blind inquiry rolls (visible only to GM and sender).

---

## 🛠 Tech Stack

- **Frontend:** React 19, Vite, TailwindCSS 4, Framer Motion.
- **Backend:** Python 3.13, FastAPI, SQLAlchemy, WebSockets.
- **Mapping:** Integrated `@excalidraw/excalidraw` via a custom Bridge Extension.
- **AI:** Google Gemini API (`gemini-2.5-flash`) & Ollama fallback.

---

## ⚙️ Setup Instructions

### 1. Prerequisites
- Node.js (v18+)
- Python 3.10+
- A Gemini API Key (from [Google AI Studio](https://aistudio.google.com/))

### 2. Backend Setup
1. Navigate to the `backend/` directory.
2. Create and activate a virtual environment:
   ```powershell
   python -m venv venv
   .\venv\Scripts\Activate.ps1
   ```
3. Install dependencies: `pip install -r requirements.txt`
4. Run schema updates: `python update_schema.py`
5. Start server: `python run.py`

### 3. Frontend Setup
1. Navigate to the `frontend/` directory.
2. Install dependencies: `npm install`
3. Start dev server: `npm run dev`

### 4. VTT Bridge Extension
1. Open Chrome/Edge Extensions page (`chrome://extensions`).
2. Enable "Developer mode".
3. Click "Load unpacked" and select the `vtt-bridge/` folder.
4. Open [Excalidraw](https://excalidraw.com) in your browser to activate the GM stream.

---

## 🧪 Testing & Reliability
- **Dynamic Backend Resolution:** Frontend automatically detects and falls back to local backends if production `wss` is unreachable.
- **Exhaustive Reactivity:** All scene projections and handouts use timestamped WebSocket synchronization to ensure zero-lag updates.
