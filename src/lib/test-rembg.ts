// Test function for backend rembg service
export const testRembg = async (): Promise<void> => {
  try {
    console.log('Testing backend rembg service...');

    // Create a simple test image (red square on white background)
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Could not create test canvas');
    }

    // Draw white background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 100, 100);

    // Draw red square in center
    ctx.fillStyle = 'red';
    ctx.fillRect(25, 25, 50, 50);

    // Convert to data URL
    const testImageDataURL = canvas.toDataURL('image/png');

    console.log('Created test image, testing backend service...');

    // Test the backend service
    const { removeBackgroundBackend } = await import('./background-removal-backend');

    const result = await removeBackgroundBackend(testImageDataURL);

    console.log('✅ Backend rembg test successful!');
    console.log('Result length:', result.length);
    console.log('Result preview:', result.substring(0, 100) + '...');

    return;

  } catch (error) {
    console.error('❌ Backend rembg test failed:', error);
    throw error;
  }
};

// Simple test to check if backend service is available
export const testRembgLoad = async (): Promise<boolean> => {
  try {
    console.log('Testing if backend rembg service is available...');

    const { isBackendServiceAvailable } = await import('./background-removal-backend');

    const status = await isBackendServiceAvailable();

    if (status.available) {
      console.log('✅ Backend rembg service is available at:', status.url);
      return true;
    } else {
      console.log('⚠️ Backend rembg service is not available');
      return false;
    }
  } catch (error) {
    console.error('❌ Failed to check backend service:', error);
    return false;
  }
};