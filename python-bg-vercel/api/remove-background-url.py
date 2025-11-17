from http.server import BaseHTTPRequestHandler
import json
import base64
import io
import requests
import os

class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        return

    def do_POST(self):
        try:
            # Set CORS headers
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            self.end_headers()

            # Read JSON data
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)

            try:
                json_data = json.loads(post_data.decode())
                image_data = json_data.get('image_data', '')

                if not image_data:
                    raise Exception("No image_data provided")

                if image_data.startswith('data:image/'):
                    # Extract base64 data
                    header, encoded = image_data.split(',', 1)
                    input_data = base64.b64decode(encoded)
                else:
                    # Handle URL (fetch from URL)
                    import urllib.request
                    with urllib.request.urlopen(image_data) as response:
                        input_data = response.read()

            except Exception as e:
                self.wfile.write(json.dumps({
                    "success": False,
                    "error": f"Failed to process image data: {str(e)}"
                }).encode())
                return

            # Process with HuggingFace API (working endpoint)
            headers = {"Authorization": f"Bearer {os.environ.get('NEXT_PUBLIC_HUGGINGFACE_TOKEN', '')}"}

            # Try multiple working models
            api_urls = [
                "https://api-inference.huggingface.co/models/briaai/RMBG-1.4",
                "https://api-inference.huggingface.co/models/ZhengPeng7/BiRefNet_T4P",
                "https://api-inference.huggingface.co/models/Xenova/modnet"
            ]

            output_data = None
            for api_url in api_urls:
                try:
                    response = requests.post(api_url, headers=headers, data=input_data, timeout=30)
                    if response.status_code == 200:
                        output_data = response.content
                        break
                except:
                    continue

            if output_data is None:
                raise Exception("All HuggingFace models failed")

            # Convert to base64
            output_b64 = base64.b64encode(output_data).decode('utf-8')

            response = {
                "success": True,
                "image": f"data:image/png;base64,{output_b64}",
                "message": "Background removed successfully"
            }

            self.wfile.write(json.dumps(response).encode())

        except Exception as e:
            error_response = {
                "success": False,
                "error": str(e)
            }
            self.wfile.write(json.dumps(error_response).encode())

    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()

        response = {
            "message": "Background removal endpoint for URLs and base64 data. Use POST with JSON."
        }
        self.wfile.write(json.dumps(response).encode())