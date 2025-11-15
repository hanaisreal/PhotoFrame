/**
 * Python rembg Backend Service Client
 *
 * This module connects to Python-based background removal services:
 * - Local: python-bg-service/ (Flask app with rembg library)
 * - Production: python-bg-vercel/ (Vercel serverless functions with HuggingFace API)
 * - Fallback: Railway deployment (if configured)
 *
 * Based on geekyscript/BackgroundRemoverOfObject approach
 * Current deployment: Vercel (using HuggingFace RMBG-1.4 model)
 */

export const removeBackgroundBackend = async (imageData: string | Blob | File): Promise<string> => {
  try {
    console.log('Using Python rembg backend service...');

    // Try local service first, then fallback to deployed services
    const serviceUrls = [
      'http://localhost:5001',  // Local development
      process.env.NEXT_PUBLIC_VERCEL_BG_URL || 'https://your-bg-service.vercel.app',  // Vercel deployment
      process.env.BACKGROUND_REMOVAL_SERVICE_URL || 'https://photoframe-production.up.railway.app'  // Railway fallback
    ];

    let lastError: Error | null = null;

    for (const baseUrl of serviceUrls) {
      try {
        console.log(`Trying backend service at: ${baseUrl}`);

        // Check if service is available
        const healthResponse = await fetch(`${baseUrl}/health`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000) // 5 second timeout
        });

        if (!healthResponse.ok) {
          throw new Error(`Service health check failed: ${healthResponse.status}`);
        }

        console.log('Backend service is healthy, processing image...');

        // Process the image
        let result: string;

        if (typeof imageData === 'string') {
          // Use URL endpoint for data URLs
          result = await removeBackgroundFromDataURL(baseUrl, imageData);
        } else {
          // Use file upload endpoint for Blob/File
          result = await removeBackgroundFromFile(baseUrl, imageData);
        }

        console.log('✅ Backend background removal succeeded!');
        return result;

      } catch (error) {
        console.warn(`Backend service at ${baseUrl} failed:`, error);
        lastError = error as Error;
        continue;
      }
    }

    throw new Error(`All backend services failed. Last error: ${lastError?.message || 'Unknown error'}`);

  } catch (error) {
    console.error('Backend background removal failed:', error);
    throw new Error(`Backend removal failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Remove background from data URL
const removeBackgroundFromDataURL = async (baseUrl: string, dataUrl: string): Promise<string> => {
  const response = await fetch(`${baseUrl}/remove-background-url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image_data: dataUrl
    }),
    signal: AbortSignal.timeout(30000) // 30 second timeout
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Backend API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Backend processing failed');
  }

  return result.image;
};

// Remove background from file
const removeBackgroundFromFile = async (baseUrl: string, file: Blob | File): Promise<string> => {
  const formData = new FormData();
  formData.append('image', file);

  const response = await fetch(`${baseUrl}/remove-background`, {
    method: 'POST',
    body: formData,
    signal: AbortSignal.timeout(30000) // 30 second timeout
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Backend API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Backend processing failed');
  }

  return result.image;
};

// Check if backend service is available
export const isBackendServiceAvailable = async (): Promise<{
  available: boolean;
  url?: string;
  models?: Array<{ name: string; description: string; size: string }>;
}> => {
  const serviceUrls = [
    'http://localhost:5001',  // Local development
    process.env.NEXT_PUBLIC_VERCEL_BG_URL || 'https://your-bg-service.vercel.app',  // Vercel deployment
    process.env.BACKGROUND_REMOVAL_SERVICE_URL || 'https://photoframe-production.up.railway.app'  // Railway fallback
  ];

  for (const baseUrl of serviceUrls) {
    try {
      const healthResponse = await fetch(`${baseUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000)
      });

      if (healthResponse.ok) {
        try {
          // Try to get available models
          const modelsResponse = await fetch(`${baseUrl}/models`, {
            signal: AbortSignal.timeout(3000)
          });

          const models = modelsResponse.ok ? (await modelsResponse.json()).models : [];

          return {
            available: true,
            url: baseUrl,
            models
          };
        } catch {
          return {
            available: true,
            url: baseUrl
          };
        }
      }
    } catch {
      continue;
    }
  }

  return { available: false };
};

// Batch processing with backend
export const removeBackgroundBackendBatch = async (
  images: (string | Blob | File)[],
  onProgress?: (completed: number, total: number) => void
): Promise<string[]> => {
  const results: string[] = [];

  for (let i = 0; i < images.length; i++) {
    try {
      const result = await removeBackgroundBackend(images[i]);
      results.push(result);

      if (onProgress) {
        onProgress(i + 1, images.length);
      }
    } catch (error) {
      console.error(`Failed to process image ${i + 1} with backend:`, error);
      results.push(''); // Empty result for failed images
    }
  }

  return results;
};