/**
 * PhotoFrame Background Removal System
 *
 * Uses Railway-deployed Python rembg backend service for high-quality background removal.
 * Railway service at: https://photoframe-production.up.railway.app
 * Uses u2netp model (4.7MB) for optimal performance and reliability.
 */

import { removeBackgroundBackend, isBackendServiceAvailable } from './background-removal-backend';

export const removeBackgroundClient = async (imageData: string | Blob | File): Promise<string> => {
  try {
    console.log('Using Railway rembg backend service...');
    return await removeBackgroundBackend(imageData);
  } catch (error) {
    console.error('Railway background removal failed:', error);
    throw new Error(`Background removal failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Export backend methods for direct usage
export {
  removeBackgroundBackend,
  removeBackgroundBackendBatch,
  isBackendServiceAvailable
} from './background-removal-backend';


// Utility to preload the background removal models
export const preloadBackgroundRemovalModel = async (): Promise<void> => {
  try {
    console.log('Testing Railway rembg service availability...');
    const status = await isBackendServiceAvailable();

    if (status.available) {
      console.log('✅ Railway rembg service is ready');
    } else {
      console.warn('⚠️ Railway rembg service not available');
    }
  } catch (error) {
    console.warn('Railway service check failed:', error);
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