import React, { useRef, useState, useEffect } from 'react';
import CameraFeed from './CameraFeed';
import { useDominoVision } from '../hooks/useDominoVision';
import { Camera, Play, Check, X } from 'lucide-react';

const ScannerView = ({ playerName, onCancel, onConfirm }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  
  const [cards, setCards] = useState([]);
  const [totalScore, setTotalScore] = useState(0);
  const [isCaptured, setIsCaptured] = useState(false);

  useDominoVision({
    videoRef,
    canvasRef,
    isProcessing: true,
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
      }
    };
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleCapture = () => {
    if (videoRef.current) {
      if (isCaptured) {
        videoRef.current.play();
        setIsCaptured(false);
      } else {
        videoRef.current.pause();
        setIsCaptured(true);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-[#0a0a0c] z-50 flex flex-col font-sans">
       <header className="flex justify-between items-center p-6 border-b border-white/5">
          <button onClick={onCancel} className="bg-white/10 p-3 rounded-full text-white active:scale-95"><X size={20}/></button>
          <div className="text-center">
             <h2 className="text-white font-bold tracking-widest text-xs text-slate-400">SCANNING SCORE FOR</h2>
             <div className="text-amber-500 font-black text-xl">{playerName}</div>
          </div>
          <div className="w-[44px]"></div>
       </header>

       <div className="flex-1 relative flex flex-col justify-center items-center p-4">
          <CameraFeed videoRef={videoRef} canvasRef={canvasRef} />
       </div>

       <div className="bg-slate-900 rounded-t-[2.5rem] p-8 flex flex-col gap-8 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
          <div className="flex justify-between items-center">
             <div>
                <div className="text-slate-400 text-sm font-bold uppercase tracking-widest">Detected Score</div>
                <div className="text-6xl font-black text-white">{isCaptured ? totalScore : '-'}</div>
             </div>
             <div className="text-right">
                <div className="text-slate-400 text-sm font-bold uppercase tracking-widest">Cards</div>
                <div className="text-2xl font-bold text-white">{isCaptured ? cards.length : '-'}</div>
             </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
             <button 
                onClick={handleCapture}
                className={`py-5 rounded-2xl font-bold flex items-center justify-center gap-2 transition-colors ${
                  isCaptured ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-white'
                }`}
             >
                {isCaptured ? <Play size={20} /> : <Camera size={20} />}
                {isCaptured ? 'Retake' : 'Capture'}
             </button>
             
             <button 
                onClick={() => onConfirm(totalScore)}
                disabled={!isCaptured}
                className="bg-emerald-500 text-white py-5 rounded-2xl font-bold flex items-center justify-center gap-2 disabled:opacity-20 disabled:scale-100 active:scale-95 transition-all"
             >
                <Check size={20} />
                Add Score
             </button>
          </div>
       </div>
    </div>
  );
}

export default ScannerView;
