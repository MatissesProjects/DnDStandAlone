# DnD StandAlone VTT

A standalone web-based Virtual Tabletop (VTT) that unifies **Excalidraw** for mapping, **Discord** for communication/auth, and **Gemini AI** for dynamic world-building.

## 🚀 Features

- **Real-time Canvas:** Shared mapping experience powered by `@excalidraw/excalidraw`.
- **Integrated Dice Roller:** Full support for standard and "Subtle" (GM-only) dice rolls.
- **Discord Authentication:** Secure login using Discord OAuth2 to distinguish between GMs and Players.
- **Room-based Sessions:** Create unique campaign rooms with join codes.
- **AI Dungeon Master Assistant:** Generate unique enemies and atmospheric lore on-the-fly using Google Gemini AI.
- **Persistent World State:** Database-backed tracking of campaigns, locations, and NPCs.

## 🛠 Tech Stack

- **Frontend:** React 19, Vite, TailwindCSS 4, Excalidraw.
- **Backend:** Python 3.13, FastAPI, SQLAlchemy, WebSockets.
- **Database:** SQLite (default for development) or PostgreSQL.
- **AI:** Google Gemini API (`gemini-1.5-flash`).

---

## ⚙️ Setup Instructions

### 1. Prerequisites
- Node.js (v18+)
- Python 3.10+
- A Discord Application (from [Discord Developer Portal](https://discord.com/developers/applications))
- A Gemini API Key (from [Google AI Studio](https://aistudio.google.com/))

### 2. Backend Setup
1. Navigate to the `backend/` directory.
2. Create and activate a virtual environment:
   ```powershell
   python -m venv venv
   .\venv\Scripts\Activate.ps1
   ```
3. Install dependencies:
   ```powershell
   pip install -r requirements.txt
   ```
4. Configure environment variables:
   Copy `.env.example` to `backend/.env` and fill in your credentials:
   ```env
   DISCORD_CLIENT_ID=your_id
   DISCORD_CLIENT_SECRET=your_secret
   GEMINI_API_KEY=your_key
   ```
5. Run the server:
   ```powershell
   python app/main.py
   ```

### 3. Frontend Setup
1. Navigate to the `frontend/` directory.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

---

## 🧪 Testing

The project includes an automated test suite for the backend.

**Run Backend Tests:**
```powershell
cd backend
$env:PYTHONPATH="."
python -m pytest tests/
```

---

## 🗺 Development Roadmap

- [x] **Phase 1:** Core Canvas & Real-time WebSockets.
- [x] **Phase 2:** Discord Auth & Role Separation.
- [x] **Phase 3:** Room-based Sessions & Join Codes.
- [x] **Phase 4:** AI Generation Pipeline (Gemini).
- [ ] **Phase 5:** GM Dashboard for World Management (WIP).
- [ ] **Phase 6:** Persistent Canvas State saving.
