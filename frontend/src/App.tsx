import { Excalidraw } from "@excalidraw/excalidraw";
import { useWebSocket } from "./hooks/useWebSocket";
import { useMemo, useState, useEffect } from "react";

interface DiceRoll {
  id: string;
  die: string;
  result: number;
  timestamp: string;
  isSubtle: boolean;
  user: string;
}

function App() {
  const clientId = useMemo(() => Math.random().toString(36).substring(7), []);
  const { isConnected, lastMessage, sendMessage } = useWebSocket(`ws://localhost:8000/ws/${clientId}`);
  const [recentRolls, setRecentRolls] = useState<DiceRoll[]>([]);
  const [isSubtleMode, setIsSubtleMode] = useState(false);

  useEffect(() => {
    if (lastMessage) {
      try {
        // Assume messages are JSON strings starting with "ROLL:" for simplicity now
        if (lastMessage.startsWith("ROLL:")) {
          const rollData = JSON.parse(lastMessage.substring(5)) as DiceRoll;
          setRecentRolls(prev => [rollData, ...prev].slice(0, 20));
        }
      } catch (e) {
        console.error("Failed to parse message", e);
      }
    }
  }, [lastMessage]);

  const rollDie = (die: string) => {
    const sides = parseInt(die.substring(1));
    const result = Math.floor(Math.random() * sides) + 1;
    const newRoll: DiceRoll = {
      id: Math.random().toString(36).substring(7),
      die,
      result,
      timestamp: new Date().toLocaleTimeString(),
      isSubtle: isSubtleMode,
      user: `Client ${clientId.substring(0, 4)}`
    };

    // Broadcast roll to backend
    sendMessage(`ROLL:${JSON.stringify(newRoll)}`);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-900 text-white font-sans">
      {/* Left Sidebar: Dice */}
      <aside className="w-72 border-r border-gray-700 p-5 flex flex-col gap-6 bg-gray-950 shrink-0">
        <div className="flex justify-between items-center border-b border-gray-700 pb-3">
          <h2 className="text-xl font-bold tracking-tight">Dice Roller</h2>
          <div className={`h-2.5 w-2.5 rounded-full ${isConnected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'}`} title={isConnected ? 'Connected' : 'Disconnected'}></div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Controls</h3>
            <label className="flex items-center gap-2 cursor-pointer group">
              <span className="text-xs text-gray-400 group-hover:text-gray-300 transition-colors">Subtle</span>
              <div className="relative">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={isSubtleMode} 
                  onChange={() => setIsSubtleMode(!isSubtleMode)}
                />
                <div className="w-8 h-4 bg-gray-700 rounded-full peer peer-checked:bg-purple-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-4"></div>
              </div>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'].map(die => (
              <button
                key={die}
                onClick={() => rollDie(die)}
                className="bg-gray-800 hover:bg-gray-700 active:bg-gray-600 text-sm font-semibold py-2.5 px-3 rounded-lg border border-gray-700 hover:border-gray-500 transition-all shadow-sm"
              >
                {die}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Recent Rolls</h3>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {recentRolls.length === 0 ? (
              <p className="text-sm text-gray-600 italic">No rolls yet</p>
            ) : (
              recentRolls.map(roll => (
                <div key={roll.id} className={`p-3 rounded-lg border text-sm ${roll.isSubtle ? 'bg-purple-900/20 border-purple-500/30' : 'bg-gray-800/50 border-gray-700'}`}>
                  <div className="flex justify-between mb-1">
                    <span className={`font-bold ${roll.isSubtle ? 'text-purple-400' : 'text-blue-400'}`}>
                      {roll.die} {roll.isSubtle && '(Subtle)'}
                    </span>
                    <span className="text-xs text-gray-500">{roll.timestamp}</span>
                  </div>
                  <div className="text-2xl font-black text-white">{roll.result}</div>
                  <div className="text-[10px] text-gray-500 mt-1 uppercase tracking-tighter">{roll.user}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </aside>

      {/* Main Area: Excalidraw */}
      <main className="flex-1 relative min-w-0 bg-gray-800">
        <div className="absolute inset-0">
          <Excalidraw theme="dark" />
        </div>
      </main>

      {/* Right Sidebar: GM Tools */}
      <aside className="w-80 border-l border-gray-700 p-5 flex flex-col gap-6 bg-gray-950 shrink-0">
        <h2 className="text-xl font-bold border-b border-gray-700 pb-3 tracking-tight">GM Tools</h2>
        
        <div className="space-y-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">AI Generation</h3>
          <div className="grid gap-3">
            <button className="w-full bg-blue-700 hover:bg-blue-600 active:bg-blue-800 text-white font-bold py-3 px-4 rounded-xl shadow-lg transition-all border border-blue-500/30">
              Generate Enemy
            </button>
            <button className="w-full bg-indigo-700 hover:bg-indigo-600 active:bg-indigo-800 text-white font-bold py-3 px-4 rounded-xl shadow-lg transition-all border border-indigo-500/30">
              Generate Lore
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">World Status</h3>
          <div className="bg-gray-900 p-4 rounded-xl border border-gray-800 shadow-inner space-y-3">
            <div>
              <p className="text-[10px] text-gray-500 uppercase font-bold mb-0.5">Current Location</p>
              <p className="text-sm font-medium text-gray-200">The Dark Forest - Whispering Grove</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase font-bold mb-0.5">Danger Level</p>
              <div className="flex gap-1 mt-1">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className={`h-1 flex-1 rounded-full ${i <= 3 ? 'bg-red-500' : 'bg-gray-700'}`}></div>
                ))}
              </div>
            </div>
            <div className="pt-1">
              <p className="text-[10px] text-gray-500 uppercase font-bold mb-0.5">Party Level</p>
              <p className="text-sm font-medium text-gray-200">Level 5</p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

export default App;
