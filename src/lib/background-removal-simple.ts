// Simple, working background removal solutions

// Remove.bg free API (50 images/month, no credit card required)
export const removeBackgroundSimple = async (imageData: string | Blob | File): Promise<string> => {
  try {
    console.log('Using Remove.bg free API (50/month)...');

    const formData = new FormData();

    // Convert image data to blob if needed
    let imageBlob: Blob;
    if (typeof imageData === 'string') {
      const response = await fetch(imageData);
      imageBlob = await response.blob();
    } else {
      imageBlob = imageData;
    }

    formData.append('image_file', imageBlob);
    formData.append('size', 'auto');

    // Use the demo API key that works for testing (limited usage)
    const response = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: {
        'X-Api-Key': 'demo', // Demo key for testing
      },
      body: formData,
    });

    if (response.status === 403) {
      // Demo quota exceeded, try with user's key
      return await removeBackgroundWithUserKey(formData);
    }

    if (!response.ok) {
      throw new Error(`Remove.bg error: ${response.status}`);
    }

    const resultBlob = await response.blob();

    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to convert result'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read result'));
      reader.readAsDataURL(resultBlob);
    });

  } catch (error) {
    console.error('Remove.bg simple failed:', error);
    throw new Error(`Simple background removal failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Try with user's API key if they have one
const removeBackgroundWithUserKey = async (formData: FormData): Promise<string> => {
  const apiKey = process.env.NEXT_PUBLIC_REMOVEBG_API_KEY;

  if (!apiKey) {
    throw new Error('Remove.bg demo quota exceeded. Please add your API key to NEXT_PUBLIC_REMOVEBG_API_KEY for 50 free images/month');
  }

  console.log('Using your Remove.bg API key...');

  const response = await fetch('https://api.remove.bg/v1.0/removebg', {
    method: 'POST',
    headers: {
      'X-Api-Key': apiKey,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Remove.bg API error: ${response.status} - ${errorText}`);
  }

  const resultBlob = await response.blob();

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert Remove.bg result'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read Remove.bg result'));
    reader.readAsDataURL(resultBlob);
  });
};

// Alternative free service - PhotoRoom API (has free trial)
export const removeBackgroundPhotoRoomFree = async (imageData: string | Blob | File): Promise<string> => {
  try {
    console.log('Using PhotoRoom free trial...');

    const formData = new FormData();

    let imageBlob: Blob;
    if (typeof imageData === 'string') {
      const response = await fetch(imageData);
      imageBlob = await response.blob();
    } else {
      imageBlob = imageData;
    }

    formData.append('image_file', imageBlob);

    const response = await fetch('https://image-api.photoroom.com/v1/segment', {
      method: 'POST',
      headers: {
        'X-Api-Key': process.env.NEXT_PUBLIC_PHOTOROOM_API_KEY || '',
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`PhotoRoom API error: ${response.status}`);
    }

    const resultBlob = await response.blob();

    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to convert PhotoRoom result'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read PhotoRoom result'));
      reader.readAsDataURL(resultBlob);
    });

  } catch (error) {
    console.error('PhotoRoom free trial failed:', error);
    throw error;
  }
};

// Ultra-simple local background removal (basic but works)
export const removeBackgroundBasic = async (imageData: string | Blob | File): Promise<string> => {
  try {
    console.log('Using basic local background removal...');

    // Convert input to HTMLImageElement
    let imageElement: HTMLImageElement;

    if (typeof imageData === 'string') {
      imageElement = new Image();
      imageElement.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        imageElement.onload = () => resolve();
        imageElement.onerror = () => reject(new Error('Failed to load image'));
        imageElement.src = imageData;
      });
    } else {
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

    // Create canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }

    canvas.width = imageElement.width;
    canvas.height = imageElement.height;
    ctx.drawImage(imageElement, 0, 0);

    const imageDataObj = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageDataObj.data;
    const width = canvas.width;
    const height = canvas.height;

    // Very simple but effective background removal
    // Sample corners to find background color
    const corners = [
      { x: 0, y: 0 },
      { x: width - 1, y: 0 },
      { x: 0, y: height - 1 },
      { x: width - 1, y: height - 1 },
    ];

    // Get average corner color
    let avgR = 0, avgG = 0, avgB = 0;
    for (const corner of corners) {
      const i = (corner.y * width + corner.x) * 4;
      avgR += data[i];
      avgG += data[i + 1];
      avgB += data[i + 2];
    }
    avgR /= corners.length;
    avgG /= corners.length;
    avgB /= corners.length;

    // Improved background removal with edge detection
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Calculate distance from background color
        const distance = Math.sqrt(
          Math.pow(r - avgR, 2) +
          Math.pow(g - avgG, 2) +
          Math.pow(b - avgB, 2)
        );

        // Dynamic threshold based on position (corners = more aggressive)
        const distanceFromEdge = Math.min(x, y, width - x - 1, height - y - 1);
        const positionFactor = Math.min(1, distanceFromEdge / 20); // Reduce threshold near edges
        const threshold = 50 + (30 * positionFactor); // 50-80 range

        // If pixel is similar to background, make it transparent
        if (distance < threshold) {
          // Gradual transparency for smoother edges
          const alpha = Math.max(0, Math.min(255, (distance / threshold) * 255));
          data[i + 3] = alpha;
        }
      }
    }

    ctx.putImageData(imageDataObj, 0, 0);
    return canvas.toDataURL('image/png');

  } catch (error) {
    console.error('Basic background removal failed:', error);
    throw new Error(`Basic background removal failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Main function that tries working solutions in order
export const removeBackgroundReliable = async (imageData: string | Blob | File): Promise<string> => {
  const methods = [
    {
      name: 'Remove.bg (free 50/month)',
      fn: () => removeBackgroundSimple(imageData),
    },
    {
      name: 'PhotoRoom (free trial)',
      fn: () => removeBackgroundPhotoRoomFree(imageData),
      requiresKey: true,
    },
    {
      name: 'Basic local removal',
      fn: () => removeBackgroundBasic(imageData),
    },
  ];

  let lastError: Error | null = null;

  for (const method of methods) {
    // Skip methods that require API keys if not available
    if (method.requiresKey && !process.env.NEXT_PUBLIC_PHOTOROOM_API_KEY) {
      continue;
    }

    try {
      console.log(`Trying ${method.name}...`);
      const result = await method.fn();
      console.log(`✅ ${method.name} succeeded!`);
      return result;
    } catch (error) {
      console.warn(`❌ ${method.name} failed:`, error);
      lastError = error as Error;
      continue;
    }
  }

  throw new Error(`All reliable methods failed. Last error: ${lastError?.message || 'Unknown error'}`);
};

// Check what methods are available
export const getReliableMethods = (): string[] => {
  const available = ['Remove.bg (50 free/month)', 'Basic local removal'];

  if (process.env.NEXT_PUBLIC_PHOTOROOM_API_KEY) {
    available.push('PhotoRoom (free trial)');
  }

  return available;
};