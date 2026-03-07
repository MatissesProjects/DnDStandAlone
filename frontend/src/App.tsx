import { Excalidraw } from "@excalidraw/excalidraw";
import { useWebSocket } from "./hooks/useWebSocket";
import { useMemo } from "react";

function App() {
  const clientId = useMemo(() => Math.random().toString(36).substring(7), []);
  const { isConnected, lastMessage, sendMessage } = useWebSocket(`ws://localhost:8000/ws/${clientId}`);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-900 text-white">
      {/* Left Sidebar: Dice */}
      <aside className="w-64 border-r border-gray-700 p-4 flex flex-col gap-4 overflow-y-auto">
        <div className="flex justify-between items-center border-b border-gray-700 pb-2">
          <h2 className="text-xl font-bold">Dice Roller</h2>
          <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} title={isConnected ? 'Connected' : 'Disconnected'}></div>
        </div>
        <div className="flex flex-wrap gap-2">
          {['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'].map(die => (
            <button
              key={die}
              className="bg-gray-800 hover:bg-gray-700 text-sm font-medium py-2 px-4 rounded border border-gray-600 transition-colors"
            >
              {die}
            </button>
          ))}
        </div>
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Recent Rolls</h3>
          <div className="mt-2 space-y-1 text-sm text-gray-300">
            <p>Roll 1: 15 (d20)</p>
            <p>Roll 2: 8 (d8)</p>
          </div>
        </div>
      </aside>

      {/* Main Area: Excalidraw */}
      <main className="flex-1 relative">
        <Excalidraw />
      </main>

      {/* Right Sidebar: GM Tools */}
      <aside className="w-80 border-l border-gray-700 p-4 flex flex-col gap-4 overflow-y-auto">
        <h2 className="text-xl font-bold border-b border-gray-700 pb-2">GM Tools</h2>
        <div>
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">AI Generation</h3>
          <button className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 px-4 rounded transition-colors mb-2">
            Generate Enemy
          </button>
          <button className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 px-4 rounded transition-colors">
            Generate Lore
          </button>
        </div>
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Active State</h3>
          <div className="bg-gray-800 p-3 rounded text-sm space-y-2 border border-gray-700">
            <p><span className="text-gray-400">Location:</span> The Dark Forest</p>
            <p><span className="text-gray-400">Party Level:</span> 5</p>
          </div>
        </div>
      </aside>
    </div>
  );
}

export default App;
