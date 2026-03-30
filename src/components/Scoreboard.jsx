import React from 'react';
import { RefreshCw, UserPlus, UserMinus, Plus } from 'lucide-react';

const Scoreboard = ({ gameState, addPlayer, removePlayer, updateName, resetScores, onAddScore, onAddScoreManual }) => {
  const { players } = gameState;
  
  const cols = players.length === 2 ? 'grid-cols-2' : 'grid-cols-2'; // 3-4 players fit logically in a 2x2 grid
  
  const getThemeColor = (index) => {
    const colors = ['bg-blue-500 shadow-blue-500/50', 'bg-red-500 shadow-red-500/50', 'bg-emerald-500 shadow-emerald-500/50', 'bg-amber-500 shadow-amber-500/50'];
    const textColors = ['text-blue-500', 'text-red-500', 'text-emerald-500', 'text-amber-500'];
    return { bg: colors[index % colors.length], text: textColors[index % textColors.length] };
  };

  return (
    <div className="flex flex-col min-h-[100dvh] bg-[#121216] text-white">
      {/* Header bar */}
      <header className="flex justify-between items-center p-4 border-b border-white/5">
        <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-600 border border-red-500/50 flex items-center justify-center font-bold shadow-[0_0_15px_rgba(220,38,38,0.5)]">W</div>
            <h1 className="font-black text-lg tracking-widest bg-clip-text text-transparent bg-gradient-to-r from-red-500 to-amber-500 uppercase">WARVAN DOMINOS</h1>
        </div>
        <div className="flex gap-5 text-slate-400">
           <button onClick={addPlayer} disabled={players.length >= 4} className="hover:text-white disabled:opacity-30"><UserPlus size={22}/></button>
           <button onClick={() => removePlayer(players[players.length-1].id)} disabled={players.length <= 2} className="hover:text-white disabled:opacity-30"><UserMinus size={22}/></button>
           <button onClick={resetScores} className="hover:text-white"><RefreshCw size={22}/></button>
        </div>
      </header>

      {/* Players grid */}
      <div className={`flex-1 grid ${cols} divide-x divide-y divide-white/5`}>
        {players.map((player, index) => {
          const theme = getThemeColor(index);
          const hasLost = player.score >= 100;
          return (
            <div key={player.id} className={`flex flex-col items-center py-6 px-4 relative ${hasLost ? 'bg-red-950/20' : ''}`}>
              {/* Name */}
              <input 
                type="text" 
                value={player.name}
                onChange={(e) => updateName(player.id, e.target.value)}
                className={`bg-transparent text-center font-black text-xl mb-4 outline-none w-full ${theme.text}`}
              />

              {/* Loser Warning */}
              {hasLost && (
                 <div className="w-full text-center bg-red-600 text-xs font-bold uppercase tracking-widest py-1 mb-2 animate-pulse rounded shadow-lg shadow-red-500/50">
                    Bangkong
                 </div>
              )}

              {/* Score History */}
              <div className="flex-1 w-full overflow-y-auto mb-4 flex flex-col items-center gap-2 font-mono text-lg text-slate-300">
                {player.history?.map((pts, i) => (
                    <div key={i} className="flex gap-3 items-center border-b border-white/5 w-24 justify-center pb-1">
                        <span className="text-slate-600 text-xs">{i+1}.</span>
                        <span>{pts}</span>
                    </div>
                ))}
              </div>

              {/* Add Buttons */}
              <div className="flex flex-col items-center gap-3 mt-auto mb-6">
                 <button  
                   onClick={() => onAddScore(player.id)}
                   className={`w-20 h-20 rounded-full flex items-center justify-center text-white ${theme.bg} hover:brightness-110 active:scale-95 transition-all shadow-xl`}
                 >
                   <Plus size={40} />
                 </button>
                 <button  
                   onClick={() => {
                        const val = window.prompt(`Enter manual score for ${player.name}:`);
                        if (val !== null && val.trim() !== '' && !isNaN(val)) {
                            onAddScoreManual(player.id, parseInt(val, 10));
                        }
                   }}
                   className="text-[10px] text-slate-400 font-bold uppercase tracking-widest py-2 px-4 bg-white/5 rounded-full active:bg-white/10"
                 >
                   Manual Input
                 </button>
              </div>
              
              {/* Score Display */}
              <div className={`text-7xl font-black tracking-tighter ${theme.text}`}>
                {player.score}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Scoreboard;
