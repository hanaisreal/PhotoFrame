# Background Removal Documentation

## Current Implementation (Production Ready ✅)

The PhotoFrame application uses a **multi-tier fallback system** for reliable background removal:

### 1. Primary: Python rembg Backend (Best Quality)
- **Local Development**: `python-bg-service/` - Flask app running on localhost:5001
- **Production**: `python-bg-vercel/` - Vercel serverless functions with HuggingFace API
- **Fallback**: Railway deployment (if `BACKGROUND_REMOVAL_SERVICE_URL` is configured)
- **Model**: Uses RMBG-1.4 via HuggingFace API (overcomes Vercel 250MB size limit)

### 2. Secondary: API Services
- **Remove.bg API**: 50 free images/month with API key
- **PhotoRoom API**: 200 free trial images
- **Demo Mode**: Works without API keys (limited usage)

### 3. Tertiary: Browser-based Fallback
- Canvas-based color sampling and edge detection
- Works offline but lower quality than AI models

## Architecture

### Core Files
- `src/lib/background-removal.ts` - Main entry point with fallback logic
- `src/lib/background-removal-backend.ts` - Python backend client
- `src/lib/background-removal-simple.ts` - API fallbacks and basic methods

### Backend Services
- `python-bg-service/` - Local Flask development server
- `python-bg-vercel/` - Production Vercel deployment

## Environment Variables

```env
# Primary backend (Vercel deployment)
NEXT_PUBLIC_VERCEL_BG_URL=https://python-bg-vercel-7vzswpo2d-hanaisreals-projects.vercel.app

# Fallback backend (Railway or other)
BACKGROUND_REMOVAL_SERVICE_URL=https://your-bg-service.railway.app

# API Keys (Optional - app works without them)
NEXT_PUBLIC_REMOVEBG_API_KEY=your_removebg_key_here
NEXT_PUBLIC_PHOTOROOM_API_KEY=your_photoroom_key_here
```

## API Endpoints

The backend services expose these endpoints:
- `GET /api/health` - Health check
- `GET /api/models` - Available models list
- `POST /api/remove-background` - File upload endpoint
- `POST /api/remove-background-url` - Base64/URL endpoint

## Usage

```typescript
import { removeBackgroundClient } from '@/lib/background-removal';

// Supports File, Blob, or base64 data URL
const result = await removeBackgroundClient(imageFile);
// Returns: data:image/png;base64,...
```

## Deployment Status

### ✅ Production Ready
- Vercel deployment active and working
- Complete fallback chain implemented
- API calls bypass Vercel authentication protection
- Supports both file uploads and base64 data

### Previous Attempts (Archive)
- ❌ Local rembg library: Exceeded Vercel 250MB limit
- ❌ Various browser-based AI libraries: Performance/compatibility issues
- ❌ Multiple API solutions: Quota limits and reliability issues

## Quality Ranking
1. 🥇 **Python rembg (HuggingFace RMBG-1.4)** - Best quality, currently deployed
2. 🥈 **Remove.bg API** - Good quality, requires API key for reliability
3. 🥉 **PhotoRoom API** - Decent quality, limited free usage
4. 🏅 **Browser color-based** - Basic quality, always available offline

The system automatically tries methods in order of quality until one succeeds.