import React from 'react';
import { RefreshCw, UserPlus, UserMinus, Plus } from 'lucide-react';

const Scoreboard = ({ gameState, addPlayer, removePlayer, updateName, resetScores, onAddScore }) => {
  const { players } = gameState;
  
  const cols = players.length === 2 ? 'grid-cols-2' : 'grid-cols-2'; // 3-4 players fit logically in a 2x2 grid
  
  const getThemeColor = (index) => {
    const colors = ['bg-blue-500', 'bg-red-500', 'bg-emerald-500', 'bg-amber-500'];
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

              {/* Add Button */}
              <button 
                onClick={() => onAddScore(player.id)}
                className={`w-20 h-20 rounded-full flex items-center justify-center text-white ${theme.bg} hover:brightness-110 active:scale-95 transition-all shadow-xl mt-auto mb-6`}
                style={{boxShadow: `0 10px 25px -5px ${theme.bg.replace('bg-', '')}`}}
              >
                <Plus size={40} />
              </button>
              
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
