"""
Test script for Qwen 2.5 VL Caption Service
"""

import requests
import base64
import sys
from PIL import Image
import io

def test_caption_service(image_path: str, service_url: str = "http://localhost:11435"):
    """Test the caption service with a sample image"""
    
    print(f"Testing caption service at {service_url}")
    print(f"Using image: {image_path}")
    print("-" * 50)
    
    # Check health
    try:
        health_response = requests.get(f"{service_url}/health")
        print(f"✓ Health check: {health_response.json()}")
    except Exception as e:
        print(f"✗ Health check failed: {e}")
        return False
    
    # Load and encode image
    try:
        with Image.open(image_path) as img:
            img = img.convert('RGB')
            buffer = io.BytesIO()
            img.save(buffer, format='JPEG')
            image_b64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
        print(f"✓ Image loaded and encoded")
    except Exception as e:
        print(f"✗ Failed to load image: {e}")
        return False
    
    # Generate caption
    try:
        print("\nGenerating caption using Qwen 2.5 VL...")
        response = requests.post(
            f"{service_url}/caption",
            json={
                "image": image_b64,
                "temperature": 0.7
            },
            timeout=120
        )
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                caption = result.get('caption', '')
                print(f"\n✓ Caption generated successfully!")
                print("\n" + "=" * 50)
                print("CAPTION:")
                print("=" * 50)
                print(caption)
                print("=" * 50)
                return True
            else:
                print(f"✗ Caption generation failed: {result.get('error', 'Unknown error')}")
                return False
        else:
            print(f"✗ Caption generation failed: {response.status_code}")
            print(response.text)
            return False
            
    except Exception as e:
        print(f"✗ Error during caption generation: {e}")
        return False


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python test_caption_service.py <image_path>")
        print("Example: python test_caption_service.py test_image.jpg")
        sys.exit(1)
    
    image_path = sys.argv[1]
    success = test_caption_service(image_path)
    
    if success:
        print("\n✓ All tests passed!")
        sys.exit(0)
    else:
        print("\n✗ Tests failed")
        sys.exit(1)

