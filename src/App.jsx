import React, { useState, useEffect } from 'react';
import Scoreboard from './components/Scoreboard';
import ScannerView from './components/ScannerView';
import { useGameState } from './hooks/useGameState';

function App() {
  const gameStateHook = useGameState();
  const [activePlayerForScan, setActivePlayerForScan] = useState(null);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the install prompt');
        }
        setDeferredPrompt(null);
      });
    }
  };

  const handleScoreConfirm = (score) => {
     if (activePlayerForScan) {
         gameStateHook.addScore(activePlayerForScan.id, score);
         setActivePlayerForScan(null);
     }
  };

  if (activePlayerForScan) {
     return (
        <ScannerView 
           playerName={activePlayerForScan.name}
           onCancel={() => setActivePlayerForScan(null)}
           onConfirm={handleScoreConfirm}
        />
     );
  }

  return (
    <div className="flex flex-col min-h-[100dvh]">
      {/* PWA Install Banner */}
      {deferredPrompt && (
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-3 flex justify-between items-center shadow-lg z-50">
           <div className="flex flex-col">
              <span className="font-bold text-sm">Install Warvan Dominos</span>
              <span className="text-xs text-blue-200">Play offline & fullscreen!</span>
           </div>
           <button onClick={handleInstallClick} className="bg-white text-blue-600 px-4 py-1.5 rounded-full font-bold text-xs shadow-sm hover:scale-105 transition-transform active:scale-95">
              Install App
           </button>
        </div>
      )}
      
      <div className="flex-1 flex flex-col relative">
        <Scoreboard 
           {...gameStateHook}
           onAddScore={(id) => {
               const player = gameStateHook.gameState.players.find(p => p.id === id);
               setActivePlayerForScan(player);
           }}
           onAddScoreManual={(id, points) => {
               gameStateHook.addScore(id, points);
           }}
        />
      </div>
    </div>
  );
}

export default App;
