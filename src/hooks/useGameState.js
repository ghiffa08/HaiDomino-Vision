import { useState, useEffect } from 'react';

const STORAGE_KEY = 'domino_game_state';

const defaultState = {
  players: [
    { id: '1', name: 'Player 1', score: 0 },
    { id: '2', name: 'Player 2', score: 0 }
  ]
};

export const useGameState = () => {
  const [gameState, setGameState] = useState(() => {
    try {
      const item = window.localStorage.getItem(STORAGE_KEY);
      if (item) return JSON.parse(item);
    } catch (e) {
      console.warn("Error reading localStorage", e);
    }
    return defaultState;
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(gameState));
  }, [gameState]);

  const addPlayer = () => {
    if (gameState.players.length >= 4) return;
    setGameState(prev => ({
      ...prev,
      players: [
        ...prev.players,
        { id: Date.now().toString(), name: `Player ${prev.players.length + 1}`, score: 0 }
      ]
    }));
  };

  const removePlayer = (id) => {
    if (gameState.players.length <= 2) return;
    setGameState(prev => ({
      ...prev,
      players: prev.players.filter(p => p.id !== id)
    }));
  };

  const addScore = (id, points) => {
    setGameState(prev => ({
      ...prev,
      players: prev.players.map(p => p.id === id ? { ...p, score: p.score + points } : p)
    }));
  };

  const updateName = (id, newName) => {
    setGameState(prev => ({
      ...prev,
      players: prev.players.map(p => p.id === id ? { ...p, name: newName } : p)
    }));
  };

  const resetScores = () => {
    setGameState(prev => ({
      ...prev,
      players: prev.players.map(p => ({ ...p, score: 0 }))
    }));
  };

  return {
    gameState,
    addPlayer,
    removePlayer,
    addScore,
    updateName,
    resetScores
  };
};
