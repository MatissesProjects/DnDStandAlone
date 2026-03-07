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
        let jsonStr = lastMessage;
        // Strip out "Client xxx: " prefix if it's there
        if (lastMessage.includes(": ROLL:")) {
           jsonStr = lastMessage.split(": ROLL:")[1];
        } else if (lastMessage.startsWith("ROLL:")) {
           jsonStr = lastMessage.substring(5);
        } else if (lastMessage.includes(": {")) {
           // Handle generic client prefix
           const firstBrace = lastMessage.indexOf('{');
           jsonStr = lastMessage.substring(firstBrace);
        }

        const data = JSON.parse(jsonStr);
        // Only add if it looks like a dice roll
        if (data.result && data.die) {
          setRecentRolls(prev => [data, ...prev].slice(0, 50));
        }
      } catch (e) {
        // Not JSON or wrong format, ignore
        console.log("WebSocket text message received:", lastMessage);
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
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      isSubtle: isSubtleMode,
      user: `Player ${clientId.substring(0, 4)}`
    };

    sendMessage(JSON.stringify(newRoll));
  };

  return (
    <div className="flex w-screen h-screen bg-gray-950 text-white font-sans overflow-hidden select-none">
      {/* Left Sidebar: Dice */}
      <aside className="w-[300px] h-full flex-none border-r border-gray-800 p-5 flex flex-col bg-gray-950 z-10 overflow-hidden">
        <div className="flex justify-between items-center border-b border-gray-800 pb-4 shrink-0">
          <h2 className="text-xl font-bold tracking-tight text-gray-100">Dice Roller</h2>
          <div 
            className={`h-3 w-3 rounded-full transition-shadow duration-500 ${isConnected ? 'bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.8)]' : 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.8)]'}`} 
            title={isConnected ? 'Connected' : 'Disconnected'}
          ></div>
        </div>

        <div className="flex flex-col gap-4 py-6 shrink-0">
          <div className="flex justify-between items-center">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Dice Types</h3>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Subtle</span>
              <div className="relative">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={isSubtleMode} 
                  onChange={() => setIsSubtleMode(!isSubtleMode)}
                />
                <div className="w-9 h-5 bg-gray-800 rounded-full border border-gray-700 peer peer-checked:bg-indigo-600 peer-checked:border-indigo-400 after:content-[''] after:absolute after:top-[3px] after:left-[4px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-4"></div>
              </div>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'].map(die => (
              <button
                key={die}
                onClick={() => rollDie(die)}
                className="bg-gray-900/50 hover:bg-gray-800 active:bg-gray-700 text-sm font-bold py-3 px-3 rounded-xl border border-gray-800 hover:border-gray-600 transition-all shadow-sm active:scale-95"
              >
                {die}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0 pt-4 border-t border-gray-800/50">
          <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] mb-4 shrink-0">Roll History</h3>
          <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
            {recentRolls.length === 0 ? (
              <div className="h-full flex items-center justify-center border-2 border-dashed border-gray-900 rounded-2xl">
                <p className="text-sm text-gray-700 font-medium">No activity yet</p>
              </div>
            ) : (
              recentRolls.map(roll => (
                <div key={roll.id} className={`p-4 rounded-xl border transition-all ${roll.isSubtle ? 'bg-indigo-950/20 border-indigo-900/50' : 'bg-gray-900/40 border-gray-800'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${roll.isSubtle ? 'text-indigo-400' : 'text-blue-500'}`}>
                      {roll.die} {roll.isSubtle && '• Subtle'}
                    </span>
                    <span className="text-[9px] font-mono text-gray-600">{roll.timestamp}</span>
                  </div>
                  <div className="text-3xl font-black text-white leading-none tracking-tighter">{roll.result}</div>
                  <div className="text-[9px] text-gray-500 mt-2 font-bold uppercase tracking-tight truncate">{roll.user}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </aside>

      {/* Main Area: Excalidraw */}
      <main className="flex-1 min-w-0 bg-gray-900 relative">
        <div className="absolute inset-0">
          <Excalidraw 
            theme="dark" 
            UIOptions={{
              canvasActions: {
                toggleTheme: false,
                export: false,
                loadScene: false,
                saveToActiveFile: false,
              }
            }}
          />
        </div>
      </main>

      {/* Right Sidebar: GM Tools */}
      <aside className="w-[320px] h-full flex-none border-l border-gray-800 p-5 flex flex-col bg-gray-950 z-10 overflow-hidden">
        <h2 className="text-xl font-bold border-b border-gray-800 pb-4 shrink-0 tracking-tight text-gray-100">GM Toolbox</h2>
        
        <div className="flex-1 overflow-y-auto space-y-8 pr-1 custom-scrollbar">
          <div className="space-y-4 pt-4">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Generation</h3>
            <div className="grid gap-3">
              <button className="w-full bg-blue-700 hover:bg-blue-600 active:bg-blue-800 active:scale-[0.98] text-white font-black py-4 px-4 rounded-2xl shadow-xl transition-all border border-blue-500/20 text-xs uppercase tracking-widest">
                Generate Enemy
              </button>
              <button className="w-full bg-indigo-700 hover:bg-indigo-600 active:bg-indigo-800 active:scale-[0.98] text-white font-black py-4 px-4 rounded-2xl shadow-xl transition-all border border-indigo-500/20 text-xs uppercase tracking-widest">
                Generate Lore
              </button>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">World Manifest</h3>
            <div className="bg-gray-900/80 p-5 rounded-2xl border border-gray-800 shadow-inner space-y-5">
              <div>
                <p className="text-[9px] text-gray-600 uppercase font-black mb-1.5 tracking-tighter">Current Location</p>
                <p className="text-sm font-bold text-gray-100">The Dark Forest</p>
                <p className="text-xs text-gray-500 font-medium leading-relaxed">Whispering Grove, Tier 2 Danger</p>
              </div>
              <div>
                <p className="text-[9px] text-gray-600 uppercase font-black mb-2.5 tracking-tighter">Danger Potential</p>
                <div className="flex gap-1.5 h-1.5">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className={`flex-1 rounded-full ${i <= 3 ? 'bg-red-600 shadow-[0_0_8px_rgba(220,38,38,0.4)]' : 'bg-gray-800'}`}></div>
                  ))}
                </div>
              </div>
              <div className="pt-1 flex items-center justify-between">
                <p className="text-[9px] text-gray-600 uppercase font-black tracking-tighter">Party Level</p>
                <span className="bg-gray-800 text-gray-300 text-[10px] font-black px-2 py-0.5 rounded-md border border-gray-700">LVL 5</span>
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Active NPCs</h3>
            <div className="space-y-2">
              <div className="bg-gray-900/40 p-3 rounded-xl border border-gray-800 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-900/50 border border-blue-700/50 flex items-center justify-center text-[10px] font-bold">OG</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate">Old Gaffer</p>
                  <p className="text-[9px] text-gray-500">NPC • Friendly</p>
                </div>
              </div>
              <div className="bg-gray-900/40 p-3 rounded-xl border border-gray-800 flex items-center gap-3 opacity-60">
                <div className="w-8 h-8 rounded-full bg-red-900/50 border border-red-700/50 flex items-center justify-center text-[10px] font-bold">SK</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate">Shadow Knight</p>
                  <p className="text-[9px] text-gray-500">Enemy • Unknown</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

export default App;
