#!/usr/bin/env python3
"""
PhotoFrame Background Removal Service
Python Flask app using rembg library for high-quality background removal
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import base64
import io
from PIL import Image
import rembg
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Initialize rembg session
bg_session = None

def init_rembg():
    """Initialize rembg session"""
    global bg_session
    try:
        logger.info("Initializing rembg session...")
        bg_session = rembg.new_session('u2net')
        logger.info("✅ rembg session initialized successfully")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to initialize rembg: {e}")
        return False

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "service": "background-removal",
        "platform": "local-flask",
        "rembg_ready": bg_session is not None
    })

@app.route('/models', methods=['GET'])
def get_models():
    """Get available models"""
    return jsonify({
        "models": [
            {
                "name": "u2net",
                "description": "General use, best quality",
                "size": "176MB"
            }
        ]
    })

@app.route('/remove-background', methods=['POST'])
def remove_background_file():
    """Remove background from uploaded file"""
    try:
        if bg_session is None:
            return jsonify({
                "success": False,
                "error": "rembg session not initialized"
            }), 500

        # Get uploaded file
        if 'image' not in request.files:
            return jsonify({
                "success": False,
                "error": "No image file provided"
            }), 400

        file = request.files['image']
        if file.filename == '':
            return jsonify({
                "success": False,
                "error": "No file selected"
            }), 400

        # Read image data
        input_data = file.read()

        # Process with rembg
        logger.info("Processing image with rembg...")
        output_data = rembg.remove(input_data, session=bg_session)

        # Convert to base64
        encoded_string = base64.b64encode(output_data).decode('utf-8')
        result_data_url = f"data:image/png;base64,{encoded_string}"

        logger.info("✅ Background removal completed successfully")
        return jsonify({
            "success": True,
            "image": result_data_url,
            "message": "Background removed successfully"
        })

    except Exception as e:
        logger.error(f"❌ Background removal failed: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/remove-background-url', methods=['POST'])
def remove_background_url():
    """Remove background from image data URL or URL"""
    try:
        if bg_session is None:
            return jsonify({
                "success": False,
                "error": "rembg session not initialized"
            }), 500

        data = request.get_json()
        if not data or 'image_data' not in data:
            return jsonify({
                "success": False,
                "error": "No image_data provided"
            }), 400

        image_data = data['image_data']

        # Handle different input types
        if image_data.startswith('data:image/'):
            # Extract base64 data
            header, encoded = image_data.split(',', 1)
            input_data = base64.b64decode(encoded)
        elif image_data.startswith('http'):
            # Handle URL (fetch from URL)
            import requests
            response = requests.get(image_data)
            input_data = response.content
        else:
            return jsonify({
                "success": False,
                "error": "Invalid image_data format"
            }), 400

        # Process with rembg
        logger.info("Processing image with rembg...")
        output_data = rembg.remove(input_data, session=bg_session)

        # Convert to base64
        encoded_string = base64.b64encode(output_data).decode('utf-8')
        result_data_url = f"data:image/png;base64,{encoded_string}"

        logger.info("✅ Background removal completed successfully")
        return jsonify({
            "success": True,
            "image": result_data_url,
            "message": "Background removed successfully"
        })

    except Exception as e:
        logger.error(f"❌ Background removal failed: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

if __name__ == '__main__':
    logger.info("Starting PhotoFrame Background Removal Service...")

    # Initialize rembg
    if init_rembg():
        logger.info("🚀 Starting Flask server on http://localhost:5001")
        app.run(host='0.0.0.0', port=5001, debug=False)
    else:
        logger.error("❌ Failed to start service - rembg initialization failed")
        exit(1)