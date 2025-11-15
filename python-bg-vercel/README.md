# Background Removal API - Vercel Deployment

Python-based background removal service using `rembg` library, deployed as Vercel serverless functions.

## 🚀 Quick Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/your-repo/tree/main/python-bg-vercel)

## 📁 Project Structure

```
python-bg-vercel/
├── api/
│   ├── health.py              # Health check endpoint
│   ├── models.py              # Available models list
│   ├── remove-background.py   # File upload endpoint
│   └── remove-background-url.py # URL/base64 endpoint
├── requirements.txt           # Python dependencies
├── vercel.json               # Vercel configuration
└── README.md                 # This file
```

## 🛠️ Local Development

1. **Install Vercel CLI:**
```bash
npm i -g vercel
```

2. **Run locally:**
```bash
vercel dev
```

## 📡 API Endpoints

### Health Check
```
GET /api/health
```

**Response:**
```json
{
  "status": "healthy",
  "service": "background-removal",
  "platform": "vercel"
}
```

### Available Models
```
GET /api/models
```

**Response:**
```json
{
  "models": [
    {
      "name": "u2net",
      "description": "General use, best quality",
      "size": "176MB"
    }
  ]
}
```

### Remove Background (File Upload)
```
POST /api/remove-background
Content-Type: multipart/form-data
```

**Body:**
- `image`: Image file

### Remove Background (URL/Base64)
```
POST /api/remove-background-url
Content-Type: application/json
```

**Body:**
```json
{
  "image_data": "data:image/png;base64,..." or "https://example.com/image.jpg"
}
```

**Response:**
```json
{
  "success": true,
  "image": "data:image/png;base64,..long_base64_string..",
  "message": "Background removed successfully"
}
```

## 🔧 Environment Variables

No environment variables required. The service works out of the box.

## 📝 Notes

- **Cold Start**: First request may take 10-30 seconds to download the U2Net model
- **Timeout**: Functions have a 30-second timeout limit
- **Model**: Uses U2Net model (~176MB) for best quality
- **CORS**: Enabled for all origins

## 🔗 Frontend Integration

Update your frontend to use the Vercel deployment URL:

```javascript
// Replace localhost with your Vercel URL
const VERCEL_URL = 'https://your-deployment.vercel.app';

const response = await fetch(`${VERCEL_URL}/api/remove-background-url`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ image_data: imageDataUrl })
});
```

## 🚀 Deployment Steps

1. **Fork/Clone this repository**
2. **Push to GitHub**
3. **Import to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Vercel will automatically detect the `vercel.json` config
4. **Deploy!** ✅

The deployment will be available at: `https://your-project.vercel.app`