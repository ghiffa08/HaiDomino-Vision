import { useEffect, useRef, useCallback } from 'react';

export const useDominoVision = ({ videoRef, canvasRef, isProcessing, onCardsDetected }) => {
  const requestRef = useRef();
  const lastUpdateRef = useRef(0);
  const lastFrameTimeRef = useRef(0);
  const activeCardsRef = useRef([]);
  
  const processFrame = useCallback(() => {
    // Always loop native browser render sync
    requestRef.current = requestAnimationFrame(processFrame);

    // Throttle to ~30 FPS to massively save mobile battery and prevent thermal throttling
    const now = Date.now();
    if (now - lastFrameTimeRef.current < 30) return;
    lastFrameTimeRef.current = now;

    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Ensure video is ready
    if (video.readyState !== 4 || video.videoWidth === 0) {
      return;
    }

    // Downscale to max 640px to massively prevent mobile WASM crashes and thermal throttling
    const MAX_WIDTH = 640;
    const scale = Math.min(1, MAX_WIDTH / video.videoWidth);
    const width = Math.floor(video.videoWidth * scale);
    const height = Math.floor(video.videoHeight * scale);
    
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    // Always draw live video feed to canvas
    ctx.drawImage(video, 0, 0, width, height);

    if (!isProcessing || !window.cv || typeof window.cv.Mat !== 'function') {
       return;
    }

    try {
      // 1. Read image from canvas
      const src = window.cv.imread(canvas);
      
      // 2. Preprocess
      const gray = new window.cv.Mat();
      window.cv.cvtColor(src, gray, window.cv.COLOR_RGBA2GRAY, 0);
      
      // Blur to reduce noise
      const blurred = new window.cv.Mat();
      window.cv.GaussianBlur(gray, blurred, new window.cv.Size(11, 11), 0, 0, window.cv.BORDER_DEFAULT);

      // Canny edge detection with balanced thresholds to stop wood grain/shadow artifacts
      const edges = new window.cv.Mat();
      window.cv.Canny(blurred, edges, 40, 110, 3, false);
      
      // Dilate edges to connect broken segment loops
      const M_dilate = window.cv.getStructuringElement(window.cv.MORPH_RECT, new window.cv.Size(3, 3));
      window.cv.dilate(edges, edges, M_dilate, new window.cv.Point(-1, -1), 1, window.cv.BORDER_CONSTANT, window.cv.morphologyDefaultBorderValue());

      // Define static structure for pip counting outside loop for performance
      const countPips = (region) => {
         const grayPip = new window.cv.Mat();
         window.cv.cvtColor(region, grayPip, window.cv.COLOR_RGBA2GRAY, 0);
         
         const mask = new window.cv.Mat();
         // Adaptive threshold to find dark spots on white face regardless of lighting, glare or shadow
         window.cv.adaptiveThreshold(grayPip, mask, 255, window.cv.ADAPTIVE_THRESH_MEAN_C, window.cv.THRESH_BINARY_INV, 21, 12);
         
         const pipContours = new window.cv.MatVector();
         const pipHierarchy = new window.cv.Mat();
         window.cv.findContours(mask, pipContours, pipHierarchy, window.cv.RETR_EXTERNAL, window.cv.CHAIN_APPROX_SIMPLE);

         let pipCount = 0;
         for (let j = 0; j < pipContours.size(); ++j) {
            const pipCnt = pipContours.get(j);
            const pipArea = window.cv.contourArea(pipCnt);
            
            // Pips on 100x100 matrix area. The '1' pip is huge, up to 6000 pixels.
            if (pipArea > 15 && pipArea < 6000) {
                const perimeter = window.cv.arcLength(pipCnt, true);
                if (perimeter > 0) {
                    const circularity = 4 * Math.PI * (pipArea / (perimeter * perimeter));
                    // Check for general circular shape, dropping weird noise strings
                    if (circularity > 0.35) {
                        pipCount++;
                    }
                }
            }
            pipCnt.delete();
         }

         grayPip.delete(); mask.delete(); pipContours.delete(); pipHierarchy.delete();
         return Math.min(pipCount, 12);
      };

      // Find contours
      const contours = new window.cv.MatVector();
      const hierarchy = new window.cv.Mat();
      window.cv.findContours(edges, contours, hierarchy, window.cv.RETR_EXTERNAL, window.cv.CHAIN_APPROX_SIMPLE);
      
      const rawDetections = [];

      for (let i = 0; i < contours.size(); ++i) {
        const cnt = contours.get(i);
        const area = window.cv.contourArea(cnt);
        
        // Optimize: Domino must be reasonably large compared to frame, adjusted for our 640px downscale
        if (area > 800 && area < (width * height) / 2) {
            // Find minimum area bounding rectangle
            const rotatedRect = window.cv.minAreaRect(cnt);
            const w = rotatedRect.size.width;
            const h = rotatedRect.size.height;
            
            // Check aspect ratio of standard dominoes (approx 1:2 or 2:1), relaxed for perspective variance
            let aspectRatio = Math.max(w, h) / Math.min(w, h); // always >= 1
            const rectArea = w * h;
            const fillRatio = rectArea > 0 ? area / rectArea : 0;
            
            // Requires it to be a solid block (fillRatio > 0.6) to reject scattered wood grain and UI elements
            if (aspectRatio > 1.2 && aspectRatio < 3.0 && fillRatio > 0.65) {
                const box = window.cv.rotatedRectPoints(rotatedRect);
                
                // Smooth pip extraction by warping perspective into a constant size.
                // Domino standard upright representation is e.g. 100x200 pixels.
                const standardW = 100;
                const standardH = 200;
                
                // Determine layout (Vertical vs Horizontal in real world view)
                const pts = [box[0], box[1], box[2], box[3]];
                
                // Sort to find top-left, top-right, bottom-left, bottom-right
                pts.sort((a,b) => (a.x + a.y) - (b.x + b.y)); // sum smallest is TL, biggest is BR
                let tl = pts[0];
                let br = pts[3];
                
                let remaining = [pts[1], pts[2]];
                remaining.sort((a,b) => (a.x - a.y) - (b.x - b.y)); // diff x-y. smallest is BL, biggest is TR
                let bl = remaining[0];
                let tr = remaining[1];
                
                const distTR = Math.hypot(tl.x - tr.x, tl.y - tr.y);
                const distBL = Math.hypot(tl.x - bl.x, tl.y - bl.y);
                
                let isHorizontalPos = distTR > distBL;
                
                // We map [tl, tr, bl, br] to fixed corners so it is always 100x200 upright.
                let srcTri = window.cv.matFromArray(4, 1, window.cv.CV_32FC2, [tl.x, tl.y, tr.x, tr.y, bl.x, bl.y, br.x, br.y]);
                let dstTri;
                
                if (isHorizontalPos) {
                   // W=200, H=100 configuration, then we transpose it later
                   dstTri = window.cv.matFromArray(4, 1, window.cv.CV_32FC2, [0, 0, standardH, 0, 0, standardW, standardH, standardW]);
                } else {
                   // W=100, H=200 configuration
                   dstTri = window.cv.matFromArray(4, 1, window.cv.CV_32FC2, [0, 0, standardW, 0, 0, standardH, standardW, standardH]);
                }

                const M_trans = window.cv.getPerspectiveTransform(srcTri, dstTri);
                let warped = new window.cv.Mat();
                const warpedSize = isHorizontalPos ? new window.cv.Size(standardH, standardW) : new window.cv.Size(standardW, standardH);
                
                window.cv.warpPerspective(src, warped, M_trans, warpedSize);

                if (isHorizontalPos) {
                    // Force the horizontal image into a vertical 100x200 domino
                    window.cv.transpose(warped, warped);
                    window.cv.flip(warped, warped, 1);
                }

                // Ensure it is 100x200 before continuing safely
                if (warped.rows === standardH && warped.cols === standardW) {
                    const topRect = new window.cv.Rect(0, 0, standardW, standardW); // top square 100x100
                    const bottomRect = new window.cv.Rect(0, standardW, standardW, standardW); // bottom 100x100
                    
                    const topHalf = warped.roi(topRect);
                    const bottomHalf = warped.roi(bottomRect);

                    const topPips = countPips(topHalf);
                    const bottomPips = countPips(bottomHalf);

                    if (topPips + bottomPips <= 24) { // Basic sanity check
                      const minX = Math.min(box[0].x, box[1].x, box[2].x, box[3].x);
                      const maxX = Math.max(box[0].x, box[1].x, box[2].x, box[3].x);
                      const minY = Math.min(box[0].y, box[1].y, box[2].y, box[3].y);
                      const maxY = Math.max(box[0].y, box[1].y, box[2].y, box[3].y);
                      
                      rawDetections.push({
                          box,
                          topPips,
                          bottomPips,
                          center: { x: minX + (maxX - minX) / 2, y: minY + (maxY - minY) / 2 }
                      });
                    }

                    topHalf.delete(); bottomHalf.delete();
                }

                M_trans.delete(); warped.delete(); srcTri.delete(); dstTri.delete();
            }
        }
        cnt.delete();
      }

      // Temporal Smoothing Logic
      const MAX_HISTORY = 12;
      const DISTANCE_THRESH = 60; // Slightly smaller because we downscaled coordinates
      const currentActive = activeCardsRef.current;
      const newActive = [];

      rawDetections.forEach(raw => {
          let closest = null;
          let minDist = DISTANCE_THRESH;
          
          for (const active of currentActive) {
              const dist = Math.hypot(active.center.x - raw.center.x, active.center.y - raw.center.y);
              if (dist < minDist) {
                  minDist = dist;
                  closest = active;
              }
          }
          
          if (closest) {
              closest.center = raw.center;
              closest.topHistory.push(raw.topPips);
              closest.bottomHistory.push(raw.bottomPips);
              if (closest.topHistory.length > MAX_HISTORY) closest.topHistory.shift();
              if (closest.bottomHistory.length > MAX_HISTORY) closest.bottomHistory.shift();
              closest.missCount = 0;
              closest.box = raw.box;
              newActive.push(closest);
              currentActive.splice(currentActive.indexOf(closest), 1);
          } else {
              newActive.push({
                  center: raw.center,
                  topHistory: [raw.topPips],
                  bottomHistory: [raw.bottomPips],
                  missCount: 0,
                  box: raw.box
              });
          }
      });
      
      currentActive.forEach(active => {
          active.missCount++;
          if (active.missCount < 8) { // Keep alive invisibly for up to 8 frames to stop flicker
              newActive.push(active);
          }
      });
      
      activeCardsRef.current = newActive;

      const getMode = (arr) => {
          const map = {};
          let maxCount = 0;
          let mode = arr[0];
          for(const v of arr) {
              map[v] = (map[v] || 0) + 1;
              if (map[v] > maxCount) {
                  maxCount = map[v];
                  mode = v;
              }
          }
          return mode;
      };

      const finalCards = [];
      newActive.forEach(active => {
          if (active.missCount < 4) { // Draw on screen if unseen for < 4 frames
             const stableTop = getMode(active.topHistory);
             const stableBottom = getMode(active.bottomHistory);
             
             if (active.missCount === 0) {
                 finalCards.push({ top: stableTop, bottom: stableBottom });
             }
             
             const box = active.box;
             
             // Draw Rotated bounding box Outline
             const color = new window.cv.Scalar(0, 255, 0, 255);
             for (let j = 0; j < 4; j++) {
                 window.cv.line(src, box[j], box[(j + 1) % 4], color, 3, window.cv.LINE_AA, 0);
             }

             if (video.paused) {
                 const text = `${stableTop}|${stableBottom}`;
                 const minX = Math.min(box[0].x, box[1].x, box[2].x, box[3].x);
                 const minY = Math.min(box[0].y, box[1].y, box[2].y, box[3].y);
                 const textOrg = new window.cv.Point(minX, minY > 25 ? minY - 10 : 25);
                 
                 window.cv.putText(src, text, textOrg, window.cv.FONT_HERSHEY_DUPLEX, 1, new window.cv.Scalar(0, 0, 0, 255), 4, window.cv.LINE_AA);
                 window.cv.putText(src, text, textOrg, window.cv.FONT_HERSHEY_DUPLEX, 1, new window.cv.Scalar(0, 255, 0, 255), 2, window.cv.LINE_AA);
             }
          }
      });

      window.cv.imshow(canvas, src);
      
      const now = Date.now();
      if (now - lastUpdateRef.current > 250) {
        if (video.paused) {
            onCardsDetected(finalCards);
        }
        lastUpdateRef.current = now;
      }

      // Memory cleanup
      src.delete(); gray.delete(); blurred.delete(); edges.delete(); M_dilate.delete(); contours.delete(); hierarchy.delete();
    } catch (err) {
      console.error("OpenCV processing error:", err);
    }
  }, [videoRef, canvasRef, isProcessing, onCardsDetected]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(processFrame);
    return () => cancelAnimationFrame(requestRef.current);
  }, [processFrame]);
};
