# Development Tracks

This document breaks the project down into actionable, parallel tracks.

## Track A: Frontend & VTT (React / UI)
- [x] Initialize React + Vite project.
- [x] Install and render `@excalidraw/excalidraw`.
- [x] Build the layout skeleton (Canvas area, Dice Sidebar, GM Tools Sidebar).
- [x] Create UI for standard and "subtle" dice rolls.
- [x] Build the AI generation interface.

## Track B: Backend API & Real-time (Python / FastAPI)
- [x] Initialize FastAPI project and setup CORS.
- [x] Setup WebSocket manager to handle active connections and broadcast messages.
- [x] Create Discord OAuth2 login flow.
- [x] Build logic to separate GM WebSocket events from Player WebSocket events (for subtle rolls).

## Track C: Data & World State (Database)
- [x] Spin up a local database.
- [x] Define SQLAlchemy models (User, Location, Entity, History_Log, Handout).
- [x] Write CRUD endpoints for the GM to update the world state.

## Track D: AI Pipeline (Gemini)
- [x] Get Gemini API key and set up the Python client.
- [x] Draft prompt templates for Enemies and Lore.
- [x] Build history context gathering for prompts.
- [x] Implement structured JSON output parsing.

## Track E: Advanced Interactivity (The Glass Layer)
- [ ] Implement transparent React overlay over the Excalidraw canvas.
- [ ] Build the Ping System (Click -> Broadcast -> Ripple VFX).
- [ ] Implement Measurement Tools (Click+Drag -> Local ruler).

## Track F: The Whisper Network (Messaging)
- [ ] Implement targeted WebSocket messaging (Player-to-Player whispers).
- [ ] Add Digital "Note Passing" (GM-to-Player secret notes with UI pop-up).
- [ ] Implement "Blind Inquiries" (Player-to-GM with AI assistance option).

## Track G: Orchestration & Ambience (Split Party & Audio)
- [ ] Refactor WebSocket manager to support sub-rooms (Location-based).
- [ ] Build the GM Switchboard UI to move players between rooms.
- [ ] Implement Dynamic Audio Sequencing (FastAPI routes -> Frontend crossfade).

## Track H: Combat & Visual Hacks
- [ ] Automated Initiative Tracker (Sidebar UI + Turn order logic).
- [ ] LitRPG-Style Inventory & Stat Tracking.
- [ ] Fog of War workaround (Black rectangles + eraser sync).

## Track I: Expanded AI Utility
- [ ] Automated Session Recaps (End-of-night summary generation).
- [ ] Context-Aware Loot Generation.
