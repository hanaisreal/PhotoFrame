#!/usr/bin/env python3
"""
Background Removal Service using rembg
Based on: https://github.com/geekyscript/BackgroundRemoverOfObject
"""

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import rembg
from PIL import Image
import io
import base64
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend requests

# Initialize rembg session
session = rembg.new_session('u2net')  # Use U2Net model (best quality)

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "healthy", "service": "background-removal"})

@app.route('/remove-background', methods=['POST'])
def remove_background():
    """
    Remove background from uploaded image
    Accepts: multipart/form-data with 'image' file
    Returns: JSON with base64 encoded result
    """
    try:
        # Check if image file is present
        if 'image' not in request.files:
            return jsonify({"error": "No image file provided"}), 400

        file = request.files['image']
        if file.filename == '':
            return jsonify({"error": "No file selected"}), 400

        logger.info(f"Processing image: {file.filename}")

        # Read image data
        input_data = file.read()

        # Remove background using rembg
        logger.info("Removing background with U2Net model...")
        output_data = rembg.remove(input_data, session=session)

        # Convert to base64 for JSON response
        output_b64 = base64.b64encode(output_data).decode('utf-8')

        logger.info("Background removal completed successfully")

        return jsonify({
            "success": True,
            "image": f"data:image/png;base64,{output_b64}",
            "message": "Background removed successfully"
        })

    except Exception as e:
        logger.error(f"Error processing image: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/remove-background-url', methods=['POST'])
def remove_background_url():
    """
    Remove background from image URL or base64 data
    Accepts: JSON with 'image_data' (base64 data URL or URL)
    Returns: JSON with base64 encoded result
    """
    try:
        data = request.get_json()

        if not data or 'image_data' not in data:
            return jsonify({"error": "No image_data provided"}), 400

        image_data = data['image_data']

        # Handle data URL (base64)
        if image_data.startswith('data:image/'):
            # Extract base64 data
            header, encoded = image_data.split(',', 1)
            input_data = base64.b64decode(encoded)
        else:
            # Handle regular URL (fetch from URL)
            import requests
            response = requests.get(image_data)
            response.raise_for_status()
            input_data = response.content

        logger.info("Processing image from data URL/URL")

        # Remove background using rembg
        logger.info("Removing background with U2Net model...")
        output_data = rembg.remove(input_data, session=session)

        # Convert to base64 for JSON response
        output_b64 = base64.b64encode(output_data).decode('utf-8')

        logger.info("Background removal completed successfully")

        return jsonify({
            "success": True,
            "image": f"data:image/png;base64,{output_b64}",
            "message": "Background removed successfully"
        })

    except Exception as e:
        logger.error(f"Error processing image: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/models', methods=['GET'])
def available_models():
    """List available rembg models"""
    return jsonify({
        "models": [
            {
                "name": "u2net",
                "description": "General use, best quality",
                "size": "176MB"
            },
            {
                "name": "u2netp",
                "description": "Lighter version of u2net",
                "size": "4.7MB"
            },
            {
                "name": "u2net_human_seg",
                "description": "Human segmentation",
                "size": "176MB"
            },
            {
                "name": "isnet-general-use",
                "description": "General purpose ISNet",
                "size": "43MB"
            }
        ]
    })

if __name__ == '__main__':
    import os
    port = int(os.getenv('PORT', 5001))
    logger.info(f"Starting Background Removal Service on port {port}...")
    logger.info("Using rembg with U2Net model")
    app.run(host='0.0.0.0', port=port, debug=False)