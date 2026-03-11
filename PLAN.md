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


## Next steps
1. Interacting with the Read-Only Canvas
Since the Excalidraw component is in updateScene() mode for the players, they can't natively draw on it. To give them interactivity without breaking the GM's master state, you use a Transparent Overlay.

The React Glass Layer: Render a transparent <div> exactly over the Excalidraw canvas.

The Ping System: When a player clicks on this glass layer, it captures the X/Y coordinates. The frontend sends a PLAYER_PING WebSocket event containing those coordinates and the player's color.

The Render: The backend broadcasts this to all clients. The glass layer on everyone's screen temporarily renders an animated CSS ripple at those coordinates. This lets players say, "I search this chest," without messing up the GM's drawing.

Measurement Tools: You can expand this overlay to allow players to click and drag to measure distances (e.g., "Is the goblin within 30 feet for my spell?"), which renders a temporary line just for them.

2. The Whisper Network
Building a robust targeted messaging system is essential for scheming, hidden motives, or secret GM knowledge.

Direct Messaging (Player-to-Player): In your VTT's chat sidebar, players can select a specific character from a dropdown to send a whisper. The WebSocket payload includes a target_id. The backend checks this ID and only routes the message to that specific client, completely bypassing the global chat array.

Digital "Note Passing" (GM-to-Player): If a player rolls a high Perception check, the GM shouldn't announce what they see to the whole table. The GM clicks the player's name and sends a "Perception Note." This triggers a distinct UI pop-up on that specific player's screen—perhaps a stylized parchment animation—containing the secret information.

Blind Inquiries (Player-to-GM): Players can send a whisper to the GM asking a question ("Does my character know anything about this faction?"). The GM can then use the Gemini integration to quickly generate a lore-accurate response and whisper it back.

3. The "Split Party" Room Architecture
This is the most powerful feature you mentioned, but it requires a solid WebSocket room strategy.

WebSocket Rooms: Frameworks like Socket.io or FastAPI WebSockets allow you to group connections into "rooms" or "channels." By default, everyone connects to room_main.

The GM Switchboard: If the rogue falls down a trapdoor, the GM opens their control panel and drags the rogue's token/name into room_crypt.

State Isolation: The backend now knows the rogue is in a different state. When the GM updates the main Excalidraw canvas, the backend only broadcasts it to room_main. The GM can switch their own view to the Crypt, draw the dark room, and that payload only broadcasts to the rogue.

Audio Routing: This exact architecture mirrors audio sequencing channels perfectly. When you drop players into separate rooms, your backend can dynamically route different ambient audio loops to each group. The players in the tavern hear a bustling crowd, while the isolated rogue hears dripping water and eerie silence.

The Broadcast Mix: If you happen to broadcast these sessions, you can create a specific "Audience" WebSocket client that remains subscribed to all rooms. This lets the stream see and hear the entire overarching narrative, while the players genuinely have no idea what is happening to each other.

4. Immersion & Atmosphere
Dynamic Audio Sequencing: Tie a built-in soundboard or audio mixer directly to your database's Location table. When the GM updates the "Active Scene" to the Sunken Crypt, the backend triggers a WebSocket event that commands the frontend to crossfade into the specific ambient track and sound effects assigned to that zone.

Narrative AI Lore Drops: When players find a random book or carving, the GM can use Gemini to instantly generate a 3-paragraph myth or historical text that fits the current world state, which is then broadcast to the players' screens as a readable pop-up.

5. Stream & Audience Integration
If you ever broadcast these sessions to Twitch or YouTube, building in audience interactivity makes the VTT a unique viewing experience.

Chat Voting Hooks: Build a simple API endpoint that listens to Twitch chat commands. The audience could vote on minor environmental weather effects, or choose which door an AI-generated enemy bursts through.

The "Omniscient Viewer" Mode: Create a third frontend view (alongside GM and Player). This view sees the GM's "subtle rolls" and hidden stats, letting the audience in on the secret while the players remain in the dark.

6. Advanced Combat Mechanics
Automated Initiative Tracker: A dynamic sidebar where players click "Roll Initiative." The backend collects the rolls, sorts the turn order, and pushes the active list to everyone's UI. It highlights whose turn it is and who is "on deck."

LitRPG-Style Inventory & Stat Tracking: Move beyond static text sheets. Build a relational inventory system where equipment stats (AC bonuses, weapon damage) automatically feed into the dice roller's modifiers. If a player is "Poisoned," the system automatically flags their next attack roll with disadvantage.

7. Excalidraw Visual Hacks
Fog of War / Masking Layer: Since Excalidraw doesn't have native Fog of War, you can build a workaround. The GM renders a massive black rectangle over the map on a specific top-level z-index. Using the eraser tool (or deleting specific black shapes), the GM reveals the map underneath, and that updated state broadcasts to the players.

Dynamic Pings & Measure Tools: Add a custom React overlay on top of the read-only player canvas. If a player clicks and holds, it sends a coordinate payload via WebSocket to render an animated "ping" on everyone's screen to point out a trap or target.

8. Expanded AI Utility
Automated Session Recaps: At the end of the night, bundle the entire History_Log of that session (every location visited, enemy generated, and major dice roll) and feed it to Gemini. Have it generate a stylized "Bard's Tale" recap of the session to drop into your Discord server.

Context-Aware Loot Generation: When an enemy is defeated, Gemini looks at the enemy's generated stats, the current location, and the party's level to generate a custom loot table that makes narrative sense (e.g., no finding a pristine magical broadsword inside a gelatinous cube, but rather a partially dissolved, acid-resistant ring).