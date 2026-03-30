import React, { useEffect } from 'react';

const CameraFeed = ({ videoRef, canvasRef }) => {
  return (
    <div className="relative w-full max-w-4xl aspect-video bg-slate-800 rounded-3xl overflow-hidden shadow-2xl border border-slate-700">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover hidden"
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute top-6 left-6 bg-black/60 text-white px-4 py-2 rounded-full text-sm font-medium backdrop-blur-md border border-white/10 shadow-lg">
        <span className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>
          Live Camera Feed
        </span>
      </div>
    </div>
  );
};

export default CameraFeed;
