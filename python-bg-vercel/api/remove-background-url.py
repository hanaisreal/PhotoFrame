from http.server import BaseHTTPRequestHandler
import json
import base64
import io
import requests

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

            # Process with HuggingFace API
            api_url = "https://api-inference.huggingface.co/models/briaai/RMBG-1.4"

            response = requests.post(api_url, data=input_data, timeout=30)

            if response.status_code != 200:
                raise Exception(f"HuggingFace API error: {response.status_code}")

            output_data = response.content

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