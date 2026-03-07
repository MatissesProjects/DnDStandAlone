# Project Tracking

## Track A: Frontend & VTT (React / UI)
- [x] Initialize React + Vite project.
- [x] Install and render `@excalidraw/excalidraw`.
- [x] Build the layout skeleton (Canvas area, Dice Sidebar, GM Tools Sidebar).
- [ ] Create UI for standard and "subtle" dice rolls.
- [ ] Build the AI generation interface (loading states, accepting/rejecting generated enemies).

## Track B: Backend API & Real-time (Python / FastAPI)
- [x] Initialize FastAPI project and setup CORS.
- [x] Setup WebSocket manager to handle active connections and broadcast messages.
- [ ] Create Discord OAuth2 login flow.
- [ ] Build logic to separate GM WebSocket events from Player WebSocket events (for subtle rolls).

## Track C: Data & World State (Database)
- [ ] Spin up a local PostgreSQL database.
- [ ] Define SQLAlchemy (or similar ORM) models.
- [ ] Write CRUD endpoints for the GM to update the world state.

## Track D: AI Pipeline (Gemini)
- [ ] Get Gemini API key and set up the Python client.
- [ ] Draft a master prompt template with placeholders.
- [ ] Build a utility function that pulls history and formats them.
- [ ] Ensure Gemini outputs response in a strictly formatted structure (JSON).
