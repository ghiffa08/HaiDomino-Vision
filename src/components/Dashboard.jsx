import React from 'react';
import { Camera, Download, Play, Square } from 'lucide-react';

const Dashboard = ({ totalScore, cards, isCaptured, handleCapture, handleExport }) => {
  return (
    <div className="w-full max-w-sm flex flex-col gap-6">
      {/* Total Score Card */}
      <div className="bg-slate-800/80 backdrop-blur-xl rounded-[2rem] p-8 border border-slate-700 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
        <h2 className="text-slate-400 text-sm font-bold uppercase tracking-widest mb-3">Total Score</h2>
        <div className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-br from-red-500 via-orange-500 to-amber-400 drop-shadow-sm">
          {isCaptured ? totalScore : '-'}
        </div>
        <p className="text-slate-400 font-medium mt-3 flex items-center gap-2">
          {isCaptured ? (
              <><span className="bg-slate-700/50 px-2 py-0.5 rounded-md text-white">{cards.length}</span> cards detected</>
          ) : (
              <span>Point camera and capture to analyze</span>
          )}
        </p>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={handleCapture}
          className={`flex items-center justify-center gap-2 py-4 px-4 rounded-2xl font-bold transition-all duration-300 shadow-lg hover:shadow-xl ${
            isCaptured 
              ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/30' 
              : 'bg-slate-800 text-white hover:bg-slate-700 border border-slate-700'
          }`}
        >
          {isCaptured ? <Play fill="currentColor" size={20} /> : <Camera size={20} />}
          {isCaptured ? 'Resume' : 'Capture'}
        </button>
        <button
          onClick={handleExport}
          className="flex items-center justify-center gap-2 py-4 px-4 rounded-2xl font-bold bg-slate-800 text-white hover:bg-slate-700 border border-slate-700 transition-all duration-300 shadow-lg hover:shadow-xl"
        >
          <Download size={20} />
          Export JSON
        </button>
      </div>

      {/* Detected Cards List */}
      <div className="bg-slate-800/80 backdrop-blur-xl rounded-[2rem] p-6 border border-slate-700 shadow-2xl flex-1 max-h-[400px] overflow-y-auto custom-scrollbar">
        <h2 className="text-slate-400 text-sm font-bold uppercase tracking-widest mb-5 sticky top-0 bg-slate-800/80 backdrop-blur-xl py-2 z-10">Detected Cards</h2>
        <div className="flex flex-col gap-3">
          {!isCaptured ? (
            <div className="text-slate-500 text-sm text-center py-8 font-medium">Waiting for capture...</div>
          ) : cards.length === 0 ? (
            <div className="text-slate-500 text-sm text-center py-8 font-medium">No cards detected in frame</div>
          ) : (
            cards.map((card, idx) => (
              <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-slate-900/50 border border-slate-700/50 hover:bg-slate-800 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-14 bg-white rounded-md flex flex-col border border-slate-200 shadow-sm relative overflow-hidden shrink-0">
                    <div className="flex-1 flex items-center justify-center text-red-600 font-extrabold text-sm border-b border-slate-200">{card.top}</div>
                    <div className="flex-1 flex items-center justify-center text-red-600 font-extrabold text-sm">{card.bottom}</div>
                  </div>
                  <div>
                    <div className="text-white font-bold">Domino {idx + 1}</div>
                    <div className="text-slate-400 text-sm font-medium">{card.top} | {card.bottom}</div>
                  </div>
                </div>
                <div className="text-2xl font-black text-white ml-4">
                  {card.top + card.bottom}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
