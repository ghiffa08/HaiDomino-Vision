import React, { useRef, useState, useEffect } from 'react';
import CameraFeed from './components/CameraFeed';
import Dashboard from './components/Dashboard';
import { useDominoVision } from './hooks/useDominoVision';

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [cards, setCards] = useState([]);
  const [totalScore, setTotalScore] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  useDominoVision({
    videoRef,
    canvasRef,
    isProcessing,
    onCardsDetected: (detectedCards) => {
      setCards(detectedCards);
      let total = 0;
      detectedCards.forEach(c => { total += (c.top + c.bottom); });
      setTotalScore(total);
    }
  });

  // Setup Camera
  useEffect(() => {
    let stream = null;
    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
             videoRef.current.play().catch(e => console.error("Play error: ", e));
          };
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
        alert("Camera access denied or unavailable.");
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const toggleProcessing = () => {
    setIsProcessing(!isProcessing);
    // OpenCV logic will be hooked here
  };

  const handleCapture = () => {
    // Freeze frame logic
  };

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(cards, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", "domino_results.json");
    dlAnchorElem.click();
  };

  return (
    <div className="min-h-screen bg-slate-900 overflow-hidden font-sans">
      <div className="absolute top-0 inset-x-0 h-64 bg-gradient-to-b from-red-500/10 to-transparent pointer-events-none"></div>
      
      <div className="max-w-7xl mx-auto p-4 md:p-8 flex flex-col items-center relative z-10">
        <header className="w-full mb-10 flex justify-between items-end">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-lg shadow-red-500/30">
                <div className="w-2 h-2 bg-white rounded-full"></div>
              </div>
              <h1 className="text-4xl font-black text-white tracking-tight">Domino Vision</h1>
            </div>
            <p className="text-slate-400 font-medium ml-11">Real-time detection & counting via OpenCV</p>
          </div>
        </header>
        
        <main className="w-full flex flex-col lg:flex-row gap-8 items-start">
          <div className="flex-1 w-full flex flex-col gap-4">
            <CameraFeed videoRef={videoRef} canvasRef={canvasRef} />
          </div>
          
          <Dashboard 
            totalScore={totalScore}
            cards={cards}
            isProcessing={isProcessing}
            toggleProcessing={toggleProcessing}
            handleCapture={handleCapture}
            handleExport={handleExport}
          />
        </main>
      </div>
    </div>
  );
}

export default App;
