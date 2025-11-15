from http.server import BaseHTTPRequestHandler
import json

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

        models = {
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
        }

        self.wfile.write(json.dumps(models).encode())
        return