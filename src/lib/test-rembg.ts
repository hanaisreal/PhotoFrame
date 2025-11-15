// Simple backend service availability check without dynamic imports
export const testRembgLoad = async (): Promise<boolean> => {
  try {
    console.log('Testing if backend rembg service is available...');

    // Simple health check without importing other modules
    const serviceUrls = [
      'http://localhost:5001',
      process.env.NEXT_PUBLIC_VERCEL_BG_URL || 'https://your-bg-service.vercel.app',
      process.env.BACKGROUND_REMOVAL_SERVICE_URL || 'https://photoframe-production.up.railway.app'
    ];

    for (const baseUrl of serviceUrls) {
      try {
        const healthResponse = await fetch(`${baseUrl}/health`, {
          method: 'GET',
          signal: AbortSignal.timeout(3000)
        });

        if (healthResponse.ok) {
          console.log('✅ Backend rembg service is available at:', baseUrl);
          return true;
        }
      } catch {
        continue;
      }
    }

    console.log('⚠️ Backend rembg service is not available');
    return false;
  } catch (error) {
    console.error('❌ Failed to check backend service:', error);
    return false;
  }
};