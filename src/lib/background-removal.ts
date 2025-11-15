/**
 * PhotoFrame Background Removal System
 *
 * This implementation uses a multi-tier fallback approach for reliable background removal:
 *
 * 1. PRIMARY: Python rembg backend service (Best quality)
 *    - Local development: localhost:5001 (python-bg-service/)
 *    - Production: Vercel deployment (python-bg-vercel/)
 *    - Fallback: Railway deployment
 *    - Uses geekyscript/BackgroundRemoverOfObject approach with U2Net model
 *
 * 2. SECONDARY: API-based services (Remove.bg, PhotoRoom)
 *    - Remove.bg API (50 free images/month with API key)
 *    - PhotoRoom API (200 free trial images)
 *    - Falls back to demo modes if no API keys provided
 *
 * 3. TERTIARY: Browser-based color analysis (Basic fallback)
 *    - Uses canvas-based color sampling and edge detection
 *    - Works offline but lower quality than AI models
 *
 * Current Status: ✅ PRODUCTION READY
 * - Python backend deployed to Vercel with HuggingFace RMBG-1.4 API
 * - Complete fallback chain ensures reliability
 * - Supports both file uploads and base64 data URLs
 */

import { removeBackgroundBackend, isBackendServiceAvailable } from './background-removal-backend';
import { removeBackgroundReliable } from './background-removal-simple';
export const removeBackgroundClient = async (imageData: string | Blob | File): Promise<string> => {
  try {
    // Try Python rembg backend service first (best quality)
    console.log('Checking Python rembg backend service...');
    const backendStatus = await isBackendServiceAvailable();

    if (backendStatus.available) {
      console.log(`Using Python rembg backend at: ${backendStatus.url}`);
      return await removeBackgroundBackend(imageData);
    } else {
      console.warn('Python backend not available, trying API methods...');
    }
  } catch (backendError) {
    console.warn('Python backend failed:', backendError);
  }

  try {
    // Fallback to API methods (Remove.bg, etc.)
    console.log('Using API fallback methods...');
    return await removeBackgroundReliable(imageData);
  } catch (reliableError) {
    console.warn('API methods failed, trying basic local method:', reliableError);

    // Final fallback to basic color-based method
    try {
      return await removeBackgroundColorBased(imageData);
    } catch (colorError) {
      console.error('All background removal methods failed:', colorError);
      throw new Error('Failed to remove background with any method');
    }
  }
};

// Export backend methods for direct usage
export {
  removeBackgroundBackend,
  removeBackgroundBackendBatch,
  isBackendServiceAvailable
} from './background-removal-backend';

// Export reliable API fallbacks
export {
  removeBackgroundReliable,
  removeBackgroundSimple,
  removeBackgroundBasic
} from './background-removal-simple';

// Fallback color-based background removal
const removeBackgroundColorBased = async (imageData: string | Blob | File): Promise<string> => {
  try {
    // Convert input to HTMLImageElement
    let imageElement: HTMLImageElement;

    if (typeof imageData === 'string') {
      // Handle base64 data URL
      imageElement = new Image();
      imageElement.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        imageElement.onload = () => resolve();
        imageElement.onerror = () => reject(new Error('Failed to load image'));
        imageElement.src = imageData;
      });
    } else {
      // Handle Blob/File
      const url = URL.createObjectURL(imageData);
      imageElement = new Image();
      imageElement.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        imageElement.onload = () => resolve();
        imageElement.onerror = () => reject(new Error('Failed to load image'));
        imageElement.src = url;
      });
      URL.revokeObjectURL(url);
    }

    // Create canvas for processing
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }

    canvas.width = imageElement.width;
    canvas.height = imageElement.height;

    // Draw original image
    ctx.drawImage(imageElement, 0, 0);

    // Get image data
    const imageDataObj = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageDataObj.data;

    const width = canvas.width;
    const height = canvas.height;

    // Sample corner colors to identify background
    const cornerSamples = [
      ...sampleArea(data, width, 0, 0, 10, 10),
      ...sampleArea(data, width, width - 10, 0, 10, 10),
      ...sampleArea(data, width, 0, height - 10, 10, 10),
      ...sampleArea(data, width, width - 10, height - 10, 10, 10),
    ];

    // Find dominant background color
    const bgColor = findDominantColor(cornerSamples);

    // Remove background pixels
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const diff = colorDistance([r, g, b], bgColor);
      const threshold = calculateAdaptiveThreshold(data, i, width, height);

      if (diff < threshold) {
        data[i + 3] = 0;
      } else {
        const edgeStrength = calculateEdgeStrength(data, i, width, height);
        if (edgeStrength > 0.3) {
          data[i + 3] = 255;
        } else {
          data[i + 3] = Math.max(0, data[i + 3] - (threshold - diff) * 2);
        }
      }
    }

    ctx.putImageData(imageDataObj, 0, 0);
    return canvas.toDataURL('image/png');

  } catch (error) {
    console.error('Background removal failed:', error);
    throw new Error(`Failed to remove background: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Helper function to sample colors from an area
function sampleArea(data: Uint8ClampedArray, width: number, startX: number, startY: number, areaWidth: number, areaHeight: number): [number, number, number][] {
  const colors: [number, number, number][] = [];

  for (let y = startY; y < Math.min(startY + areaHeight, Math.floor(data.length / (width * 4))); y++) {
    for (let x = startX; x < Math.min(startX + areaWidth, width); x++) {
      const i = (y * width + x) * 4;
      if (i < data.length) {
        colors.push([data[i], data[i + 1], data[i + 2]]);
      }
    }
  }

  return colors;
}

// Find the most common color in samples
function findDominantColor(colors: [number, number, number][]): [number, number, number] {
  if (colors.length === 0) return [255, 255, 255]; // Default to white

  // Group similar colors
  const colorGroups: Map<string, { color: [number, number, number], count: number }> = new Map();

  colors.forEach(color => {
    // Round to nearest 10 to group similar colors
    const key = `${Math.round(color[0] / 10) * 10},${Math.round(color[1] / 10) * 10},${Math.round(color[2] / 10) * 10}`;

    if (colorGroups.has(key)) {
      colorGroups.get(key)!.count++;
    } else {
      colorGroups.set(key, { color, count: 1 });
    }
  });

  // Find most common color group
  let maxCount = 0;
  let dominantColor: [number, number, number] = [255, 255, 255];

  colorGroups.forEach(group => {
    if (group.count > maxCount) {
      maxCount = group.count;
      dominantColor = group.color;
    }
  });

  return dominantColor;
}

// Calculate Euclidean distance between two colors
function colorDistance(color1: [number, number, number], color2: [number, number, number]): number {
  return Math.sqrt(
    Math.pow(color1[0] - color2[0], 2) +
    Math.pow(color1[1] - color2[1], 2) +
    Math.pow(color1[2] - color2[2], 2)
  );
}

// Calculate adaptive threshold based on local variance
function calculateAdaptiveThreshold(data: Uint8ClampedArray, pixelIndex: number, width: number, height: number): number {
  const x = (pixelIndex / 4) % width;
  const y = Math.floor((pixelIndex / 4) / width);

  // Sample local area for variance calculation
  let variance = 0;
  let count = 0;
  const radius = 3;

  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const nx = x + dx;
      const ny = y + dy;

      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const ni = (ny * width + nx) * 4;
        if (ni < data.length) {
          const brightness = (data[ni] + data[ni + 1] + data[ni + 2]) / 3;
          variance += Math.pow(brightness, 2);
          count++;
        }
      }
    }
  }

  variance = count > 0 ? variance / count : 0;

  // Higher variance = lower threshold (more selective)
  // Lower variance = higher threshold (more inclusive)
  const baseThreshold = 40;
  const varianceFactor = Math.sqrt(variance) / 255;

  return baseThreshold + (30 * (1 - varianceFactor));
}

// Calculate edge strength at pixel
function calculateEdgeStrength(data: Uint8ClampedArray, pixelIndex: number, width: number, height: number): number {
  const x = (pixelIndex / 4) % width;
  const y = Math.floor((pixelIndex / 4) / width);

  if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
    return 0; // Edges of image
  }

  // Sobel edge detection
  const getPixelBrightness = (px: number, py: number): number => {
    const i = (py * width + px) * 4;
    return (data[i] + data[i + 1] + data[i + 2]) / 3;
  };

  const sobelX = [
    [-1, 0, 1],
    [-2, 0, 2],
    [-1, 0, 1]
  ];

  const sobelY = [
    [-1, -2, -1],
    [0, 0, 0],
    [1, 2, 1]
  ];

  let gx = 0, gy = 0;

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const brightness = getPixelBrightness(x + dx, y + dy);
      gx += brightness * sobelX[dy + 1][dx + 1];
      gy += brightness * sobelY[dy + 1][dx + 1];
    }
  }

  return Math.sqrt(gx * gx + gy * gy) / 255;
}

// Utility to preload the background removal models
export const preloadBackgroundRemovalModel = async (): Promise<void> => {
  try {
    console.log('Testing backend rembg service availability...');

    // Use the simplified test function
    const { testRembgLoad } = await import('./test-rembg');
    const isAvailable = await testRembgLoad();

    if (isAvailable) {
      console.log('✅ Backend rembg service is ready');
    } else {
      console.warn('⚠️ Backend rembg service not available, will use API fallback methods');
    }
  } catch (error) {
    console.warn('Backend service check failed:', error);
  }
};

// Utility to check if background removal is supported
export const isBackgroundRemovalSupported = (): boolean => {
  try {
    return typeof window !== 'undefined' &&
           typeof HTMLCanvasElement !== 'undefined' &&
           typeof Image !== 'undefined';
  } catch {
    return false;
  }
};