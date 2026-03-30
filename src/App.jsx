import React, { useState } from 'react';
import Scoreboard from './components/Scoreboard';
import ScannerView from './components/ScannerView';
import { useGameState } from './hooks/useGameState';

function App() {
  const gameStateHook = useGameState();
  const [activePlayerForScan, setActivePlayerForScan] = useState(null);

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
    <Scoreboard 
       {...gameStateHook}
       onAddScore={(id) => {
           const player = gameStateHook.gameState.players.find(p => p.id === id);
           setActivePlayerForScan(player);
       }}
    />
  );
}

export default App;
