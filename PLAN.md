# VTT D&D Project Plan

## 1. Project Overview
A standalone web-based Virtual Tabletop (VTT) that unifies Excalidraw for mapping, Discord for communication/auth, and Gemini AI for dynamic world-building. 

## 2. Core Tech Stack
* **Frontend:** React (Required for the official `@excalidraw/excalidraw` package), TailwindCSS for rapid UI styling.
* **Backend:** Python with FastAPI (Ideal for AI routing, quick API endpoints, and handling game state logic).
* **Real-time Communication:** WebSockets (Socket.io or FastAPI WebSockets) for live dice rolls and map updates.
* **Database:** PostgreSQL (Relational structure is best for linking locations, factions, and past encounters).
* **AI Integration:** Google Gemini API.

## 3. Development Phases

### Phase 1: The Canvas Foundation
* Set up the React frontend repository.
* Embed the Excalidraw component to take up the main viewport.
* Set up the Python/FastAPI backend.
* Establish basic bi-directional communication (WebSockets) so multiple browser windows see the same Excalidraw updates.

### Phase 2: Dice & Discord
* Implement Discord OAuth2 for user login (identifying GM vs. Players).
* Build the dice roller component (UI and backend logic).
* Add "Subtle Rolls" (Blind/Whisper rolls) that route exclusively to the GM's WebSocket connection.

### Phase 3: World State & Memory
* Design the database schema (Tables: `Campaigns`, `Locations`, `NPCs`, `Encounters`, `Lore_Snippets`).
* Build a GM dashboard/sidebar to input and track current party location and recent events.
* Ensure the active state (where the party is right now) is actively tracked in the backend.

### Phase 4: Gemini AI Integration
* Build the context-gathering pipeline: fetch current location, recent lore, and party level from the database.
* Engineer the Gemini prompts to accept this context and output structured JSON (Stats, Backstory, Loot).
* Create the UI for the GM to click "Generate Enemy", review the AI output, and drop it into the game state.

### Phase 5: Polish & Deployment
* Refine UI/UX for immersion.
* Test edge cases (e.g., WebSocket disconnections during a roll).
* Deploy (e.g., Vercel for Frontend, Render/Railway for Python Backend & DB).