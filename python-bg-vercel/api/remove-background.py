from http.server import BaseHTTPRequestHandler
import json
import base64
import io
import urllib.parse
try:
    import rembg
except ImportError:
    rembg = None

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

            # Get content length
            content_length = int(self.headers.get('Content-Length', 0))

            if content_length == 0:
                self.wfile.write(json.dumps({
                    "success": False,
                    "error": "No data provided"
                }).encode())
                return

            # Read the request body
            post_data = self.rfile.read(content_length)

            # Handle different content types
            content_type = self.headers.get('Content-Type', '')

            if 'multipart/form-data' in content_type:
                # Handle file upload
                input_data = self.parse_multipart(post_data, content_type)
            elif 'application/json' in content_type:
                # Handle JSON with base64 data
                try:
                    json_data = json.loads(post_data.decode())
                    image_data = json_data.get('image_data', '')

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
                        "error": f"Failed to parse JSON: {str(e)}"
                    }).encode())
                    return
            else:
                # Assume raw image data
                input_data = post_data

            # Process with rembg library
            if rembg is None:
                raise Exception("rembg library not available")

            # Use rembg to remove background
            output_data = rembg.remove(input_data)

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

    def parse_multipart(self, data, content_type):
        """Simple multipart parser for file uploads"""
        try:
            # Extract boundary
            boundary = content_type.split('boundary=')[1]
            if boundary.startswith('"') and boundary.endswith('"'):
                boundary = boundary[1:-1]

            # Split by boundary
            parts = data.split(f'--{boundary}'.encode())

            for part in parts:
                if b'filename=' in part and b'Content-Type: image/' in part:
                    # Find the start of file data (after double newline)
                    header_end = part.find(b'\r\n\r\n')
                    if header_end != -1:
                        file_data = part[header_end + 4:]
                        # Remove trailing boundary markers
                        if file_data.endswith(b'\r\n'):
                            file_data = file_data[:-2]
                        return file_data

            raise Exception("No image file found in multipart data")

        except Exception as e:
            raise Exception(f"Failed to parse multipart data: {str(e)}")

    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()

        response = {
            "message": "Background removal endpoint. Use POST with image data."
        }
        self.wfile.write(json.dumps(response).encode())