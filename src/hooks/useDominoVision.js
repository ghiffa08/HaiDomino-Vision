import { useEffect, useRef, useCallback } from 'react';

export const useDominoVision = ({ videoRef, canvasRef, isProcessing, onCardsDetected }) => {
  const requestRef = useRef();
  const lastUpdateRef = useRef(0);
  
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
      
      // 2. Preprocess
      const gray = new window.cv.Mat();
      window.cv.cvtColor(src, gray, window.cv.COLOR_RGBA2GRAY, 0);
      
      // Blur to reduce noise
      const blurred = new window.cv.Mat();
      window.cv.GaussianBlur(gray, blurred, new window.cv.Size(11, 11), 0, 0, window.cv.BORDER_DEFAULT);

      // Canny edge detection with relaxed thresholds for better handling of lighting and motion blur
      const edges = new window.cv.Mat();
      window.cv.Canny(blurred, edges, 30, 100, 3, false);
      
      // Dilate edges to connect broken segment loops
      const M_dilate = window.cv.getStructuringElement(window.cv.MORPH_RECT, new window.cv.Size(3, 3));
      window.cv.dilate(edges, edges, M_dilate, new window.cv.Point(-1, -1), 1, window.cv.BORDER_CONSTANT, window.cv.morphologyDefaultBorderValue());

      // Define static structure for pip counting outside loop for performance
      const countPips = (region) => {
         const hsv = new window.cv.Mat();
         window.cv.cvtColor(region, hsv, window.cv.COLOR_RGBA2RGB);
         window.cv.cvtColor(hsv, hsv, window.cv.COLOR_RGB2HSV);

         // Look for Red Color Pips (HSV wraparound in OpenCV 0-10 & 165-180)
         const mask1 = new window.cv.Mat();
         const mask2 = new window.cv.Mat();
         const mask = new window.cv.Mat();

         const lowerRed1 = new window.cv.Mat(hsv.rows, hsv.cols, hsv.type(), [0, 90, 70, 0]);
         const upperRed1 = new window.cv.Mat(hsv.rows, hsv.cols, hsv.type(), [15, 255, 255, 0]);
         window.cv.inRange(hsv, lowerRed1, upperRed1, mask1);

         const lowerRed2 = new window.cv.Mat(hsv.rows, hsv.cols, hsv.type(), [165, 90, 70, 0]);
         const upperRed2 = new window.cv.Mat(hsv.rows, hsv.cols, hsv.type(), [180, 255, 255, 0]);
         window.cv.inRange(hsv, lowerRed2, upperRed2, mask2);

         window.cv.bitwise_or(mask1, mask2, mask);

         // Clean up the mask holes
         const M_morph = window.cv.getStructuringElement(window.cv.MORPH_ELLIPSE, new window.cv.Size(3, 3));
         window.cv.morphologyEx(mask, mask, window.cv.MORPH_OPEN, M_morph);
         window.cv.morphologyEx(mask, mask, window.cv.MORPH_CLOSE, M_morph);

         const pipContours = new window.cv.MatVector();
         const pipHierarchy = new window.cv.Mat();
         window.cv.findContours(mask, pipContours, pipHierarchy, window.cv.RETR_EXTERNAL, window.cv.CHAIN_APPROX_SIMPLE);

         let pipCount = 0;
         
         for (let j = 0; j < pipContours.size(); ++j) {
            const pipCnt = pipContours.get(j);
            const pipArea = window.cv.contourArea(pipCnt);
            
            // Relax constraints to account for motion blur
            if (pipArea > 10 && pipArea < 3500) {
                const perimeter = window.cv.arcLength(pipCnt, true);
                if (perimeter > 0) {
                    const circularity = 4 * Math.PI * (pipArea / (perimeter * perimeter));
                    if (circularity > 0.3) {
                        pipCount++;
                    }
                } else {
                    // Small points might not have significant perimeter but still be valid pip centers
                    pipCount++;
                }
            }
            pipCnt.delete();
         }

         hsv.delete(); mask1.delete(); mask2.delete(); mask.delete(); lowerRed1.delete(); upperRed1.delete(); lowerRed2.delete(); upperRed2.delete(); M_morph.delete(); pipContours.delete(); pipHierarchy.delete();
         
         return Math.min(pipCount, 12);
      };

      // Find contours
      const contours = new window.cv.MatVector();
      const hierarchy = new window.cv.Mat();
      window.cv.findContours(edges, contours, hierarchy, window.cv.RETR_EXTERNAL, window.cv.CHAIN_APPROX_SIMPLE);
      
      const detectedCards = [];

      for (let i = 0; i < contours.size(); ++i) {
        const cnt = contours.get(i);
        const area = window.cv.contourArea(cnt);
        
        // Optimize: Domino must be reasonably large compared to frame, relaxed for distance/blur
        if (area > 2000 && area < (width * height) / 2) {
            // Find minimum area bounding rectangle
            const rotatedRect = window.cv.minAreaRect(cnt);
            const w = rotatedRect.size.width;
            const h = rotatedRect.size.height;
            
            // Check aspect ratio of standard dominoes (approx 1:2 or 2:1), relaxed for perspective variance
            let aspectRatio = Math.max(w, h) / Math.min(w, h); // always >= 1
            
            if (aspectRatio > 1.2 && aspectRatio < 3.0) {
                const box = window.cv.rotatedRectPoints(rotatedRect);
                
                // Draw rotated bounding box Outline
                const color = new window.cv.Scalar(0, 255, 0, 255);
                for (let j = 0; j < 4; j++) {
                    window.cv.line(src, box[j], box[(j + 1) % 4], color, 3, window.cv.LINE_AA, 0);
                }

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
                      detectedCards.push({ top: topPips, bottom: bottomPips });

                      // Display overlaid count on the original camera image
                      const text = `${topPips}|${bottomPips}`;
                      const minX = Math.min(box[0].x, box[1].x, box[2].x, box[3].x);
                      const minY = Math.min(box[0].y, box[1].y, box[2].y, box[3].y);
                      const textOrg = new window.cv.Point(minX, minY > 25 ? minY - 10 : 25);
                      
                      // Text drop shadow / outline to make it readable in different lightings
                      window.cv.putText(src, text, textOrg, window.cv.FONT_HERSHEY_DUPLEX, 1, new window.cv.Scalar(0, 0, 0, 255), 4, window.cv.LINE_AA);
                      window.cv.putText(src, text, textOrg, window.cv.FONT_HERSHEY_DUPLEX, 1, new window.cv.Scalar(0, 255, 0, 255), 2, window.cv.LINE_AA);
                    }

                    topHalf.delete(); bottomHalf.delete();
                }

                M_trans.delete(); warped.delete(); srcTri.delete(); dstTri.delete();
            }
        }
        cnt.delete();
      }

      window.cv.imshow(canvas, src);
      
      const now = Date.now();
      if (now - lastUpdateRef.current > 250) {
        onCardsDetected(detectedCards);
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
