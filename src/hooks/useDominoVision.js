import { useEffect, useRef, useCallback } from 'react';

export const useDominoVision = ({ videoRef, canvasRef, isProcessing, onCardsDetected }) => {
  const requestRef = useRef();
  
  const processFrame = useCallback(() => {
    // Always loop
    requestRef.current = requestAnimationFrame(processFrame);

    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Ensure video is ready
    if (video.readyState !== 4 || video.videoWidth === 0) {
      return;
    }

    const width = video.videoWidth;
    const height = video.videoHeight;
    
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
      
      // 2. Preprocess: Convert to grayscale and blur
      const gray = new window.cv.Mat();
      window.cv.cvtColor(src, gray, window.cv.COLOR_RGBA2GRAY, 0);
      
      const blurred = new window.cv.Mat();
      window.cv.GaussianBlur(gray, blurred, new window.cv.Size(5, 5), 0, 0, window.cv.BORDER_DEFAULT);

      // 3. Find Domino Borders (White Rectangles)
      const thresh = new window.cv.Mat();
      window.cv.adaptiveThreshold(blurred, thresh, 255, window.cv.ADAPTIVE_THRESH_GAUSSIAN_C, window.cv.THRESH_BINARY, 11, 2);
      
      const contours = new window.cv.MatVector();
      const hierarchy = new window.cv.Mat();
      window.cv.findContours(thresh, contours, hierarchy, window.cv.RETR_EXTERNAL, window.cv.CHAIN_APPROX_SIMPLE);
      
      const detectedCards = [];

      for (let i = 0; i < contours.size(); ++i) {
        const cnt = contours.get(i);
        const area = window.cv.contourArea(cnt);
        
        // Filter by area to avoid noise
        if (area > 3000 && area < 100000) {
          const perimeter = window.cv.arcLength(cnt, true);
          const approx = new window.cv.Mat();
          window.cv.approxPolyDP(cnt, approx, 0.03 * perimeter, true);
          
          if (approx.rows === 4) {
            const rect = window.cv.boundingRect(approx);
            const aspectRatio = rect.width / rect.height;
            const isVertical = aspectRatio < 0.8 && aspectRatio > 0.3;
            const isHorizontal = aspectRatio > 1.2 && aspectRatio < 3.0;
            
            if (isVertical || isHorizontal) {
              let color = new window.cv.Scalar(0, 255, 0, 255);
              const p1 = new window.cv.Point(rect.x, rect.y);
              const p2 = new window.cv.Point(rect.x + rect.width, rect.y + rect.height);
              window.cv.rectangle(src, p1, p2, color, 3);
              
              const roi = src.roi(rect);
              
              let topHalf, bottomHalf;
              if (isVertical) {
                 const midY = Math.floor(rect.height / 2);
                 const topRect = new window.cv.Rect(0, 0, rect.width, midY);
                 const bottomRect = new window.cv.Rect(0, midY, rect.width, rect.height - midY);
                 topHalf = roi.roi(topRect);
                 bottomHalf = roi.roi(bottomRect);
              } else {
                 const midX = Math.floor(rect.width / 2);
                 const leftRect = new window.cv.Rect(0, 0, midX, rect.height);
                 const rightRect = new window.cv.Rect(midX, 0, rect.width - midX, rect.height);
                 topHalf = roi.roi(leftRect);
                 bottomHalf = roi.roi(rightRect);
              }

              const countPips = (region) => {
                 const hsv = new window.cv.Mat();
                 window.cv.cvtColor(region, hsv, window.cv.COLOR_RGBA2RGB);
                 window.cv.cvtColor(hsv, hsv, window.cv.COLOR_RGB2HSV);

                 const mask1 = new window.cv.Mat();
                 const mask2 = new window.cv.Mat();
                 const mask = new window.cv.Mat();

                 // Adjusted Red boundaries
                 const lowerRed1 = new window.cv.Mat(hsv.rows, hsv.cols, hsv.type(), [0, 80, 80, 0]);
                 const upperRed1 = new window.cv.Mat(hsv.rows, hsv.cols, hsv.type(), [12, 255, 255, 0]);
                 window.cv.inRange(hsv, lowerRed1, upperRed1, mask1);

                 const lowerRed2 = new window.cv.Mat(hsv.rows, hsv.cols, hsv.type(), [165, 80, 80, 0]);
                 const upperRed2 = new window.cv.Mat(hsv.rows, hsv.cols, hsv.type(), [180, 255, 255, 0]);
                 window.cv.inRange(hsv, lowerRed2, upperRed2, mask2);

                 window.cv.bitwise_or(mask1, mask2, mask);

                 const M = window.cv.Mat.ones(3, 3, window.cv.CV_8U);
                 window.cv.morphologyEx(mask, mask, window.cv.MORPH_OPEN, M);

                 const pipContours = new window.cv.MatVector();
                 const pipHierarchy = new window.cv.Mat();
                 window.cv.findContours(mask, pipContours, pipHierarchy, window.cv.RETR_EXTERNAL, window.cv.CHAIN_APPROX_SIMPLE);

                 let pipCount = 0;
                 for (let j = 0; j < pipContours.size(); ++j) {
                    const pipCnt = pipContours.get(j);
                    const pipArea = window.cv.contourArea(pipCnt);
                    
                    if (pipArea > 20 && pipArea < 3000) { // widened pip size tolerance for closeups
                      pipCount++;
                    }
                    pipCnt.delete();
                 }

                 hsv.delete(); mask1.delete(); mask2.delete(); mask.delete(); lowerRed1.delete(); upperRed1.delete(); lowerRed2.delete(); upperRed2.delete(); M.delete(); pipContours.delete(); pipHierarchy.delete();
                 
                 return pipCount;
              };

              const topPips = countPips(topHalf);
              const bottomPips = countPips(bottomHalf);
              
              detectedCards.push({ top: topPips, bottom: bottomPips });

              const text = `${topPips}|${bottomPips}`;
              const textOrg = new window.cv.Point(rect.x, rect.y > 20 ? rect.y - 10 : 20);
              window.cv.putText(src, text, textOrg, window.cv.FONT_HERSHEY_DUPLEX, 0.8, new window.cv.Scalar(0, 255, 0, 255), 2, window.cv.LINE_AA);

              roi.delete(); topHalf.delete(); bottomHalf.delete();
            }
          }
          approx.delete();
        }
        cnt.delete();
      }

      window.cv.imshow(canvas, src);
      onCardsDetected(detectedCards);

      src.delete(); gray.delete(); blurred.delete(); thresh.delete(); contours.delete(); hierarchy.delete();
    } catch (err) {
      console.error("OpenCV processing error:", err);
    }
  }, [videoRef, canvasRef, isProcessing, onCardsDetected]);

  useEffect(() => {
    // Start loop on mount and continue
    requestRef.current = requestAnimationFrame(processFrame);
    return () => cancelAnimationFrame(requestRef.current);
  }, [processFrame]);
};
