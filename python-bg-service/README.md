# Background Removal Service

Python backend service using `rembg` for high-quality background removal.

## Setup

1. **Install Python dependencies:**
```bash
cd python-bg-service
pip install -r requirements.txt
```

2. **Run the service:**
```bash
python main.py
```

The service will start on `http://localhost:5000`

## API Endpoints

### Health Check
```
GET /health
```

### Remove Background (File Upload)
```
POST /remove-background
Content-Type: multipart/form-data

Form data:
- image: image file
```

### Remove Background (Data URL)
```
POST /remove-background-url
Content-Type: application/json

{
  "image_data": "data:image/png;base64,..." or "https://example.com/image.jpg"
}
```

### Available Models
```
GET /models
```

## Usage from Frontend

The frontend can call this service to get professional background removal results.