#!/usr/bin/env python3

import subprocess
import sys
import os

def install_packages():
    """Install required packages"""
    packages = [
        "rembg==2.0.57",
        "fastapi==0.104.1",
        "uvicorn==0.24.0",
        "python-multipart==0.0.6",
        "pillow==10.1.0",
        "numpy==1.24.3"
    ]

    for package in packages:
        try:
            print(f"Installing {package}...")
            subprocess.check_call([sys.executable, "-m", "pip", "install", package])
        except subprocess.CalledProcessError as e:
            print(f"Failed to install {package}: {e}")
            return False
    return True

def main():
    print("Setting up background removal service...")

    # Install packages
    if not install_packages():
        print("Failed to install required packages")
        return 1

    # Start the service
    print("Starting background removal service on port 8000...")
    try:
        subprocess.run([sys.executable, "app.py"])
    except KeyboardInterrupt:
        print("\nShutting down background removal service...")
        return 0

    return 0

if __name__ == "__main__":
    sys.exit(main())