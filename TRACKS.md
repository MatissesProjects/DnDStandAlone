# Development Tracks

This document breaks the project down into actionable, parallel tracks.

## Track A: Frontend & VTT (React / UI)
- [ ] Initialize React + Vite project.
- [ ] Install and render `@excalidraw/excalidraw`.
- [ ] Build the layout skeleton (Canvas area, Dice Sidebar, GM Tools Sidebar).
- [ ] Create UI for standard and "subtle" dice rolls.
- [ ] Build the AI generation interface (loading states, accepting/rejecting generated enemies).

## Track B: Backend API & Real-time (Python / FastAPI)
- [ ] Initialize FastAPI project and setup CORS.
- [ ] Setup WebSocket manager to handle active connections and broadcast messages.
- [ ] Create Discord OAuth2 login flow.
- [ ] Build logic to separate GM WebSocket events from Player WebSocket events (for subtle rolls).

## Track C: Data & World State (Database)
- [ ] Spin up a local PostgreSQL database.
- [ ] Define SQLAlchemy (or similar ORM) models:
    - `User` (Discord ID, Role)
    - `Location` (Name, Description, Danger Level)
    - `Entity` (NPC/Enemy stats, linked to a Location)
    - `History_Log` (Recent events to feed the AI)
- [ ] Write CRUD endpoints for the GM to update the world state.

## Track D: AI Pipeline (Gemini)
- [ ] Get Gemini API key and set up the Python client.
- [ ] Draft a master prompt template with placeholders (e.g., `{location}`, `{recent_events}`).
- [ ] Build a utility function that pulls the last 5 `History_Log` entries and formats them for the prompt.
- [ ] Ensure Gemini outputs response in a strictly formatted structure (JSON) so it can be parsed directly into a new `Entity` database row.