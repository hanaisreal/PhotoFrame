from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
import rembg
from PIL import Image
import io
import uvicorn

app = FastAPI(title="Background Removal API", version="1.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],  # Next.js dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "background-removal"}

@app.post("/remove-background")
async def remove_background(file: UploadFile = File(...)):
    try:
        # Validate file type
        if not file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="File must be an image")

        # Read the uploaded image
        image_data = await file.read()

        # Remove background using rembg
        output_data = rembg.remove(image_data)

        # Return the processed image
        return Response(
            content=output_data,
            media_type="image/png",
            headers={
                "Content-Disposition": "attachment; filename=removed_bg.png"
            }
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing image: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)