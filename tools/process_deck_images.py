import urllib.request
import io
import base64
import json
from PIL import Image, ImageOps

sources = {
    'ur5': 'https://upload.wikimedia.org/wikipedia/commons/5/57/Cobot.jpg',
    'cnc': 'https://upload.wikimedia.org/wikipedia/commons/6/6c/Small_CNC_Turning_Center.jpg',
    'hydraulic': 'https://upload.wikimedia.org/wikipedia/commons/f/f0/20-ton-shop-press.jpg',
    'conveyor': 'https://images.unsplash.com/photo-1587293852726-70cdb56c2866?w=800&auto=format&fit=crop&q=80'
}

# Backup sources if any fail
alt_sources = {
    'ur5': 'https://images.unsplash.com/photo-1616401784845-180882ba9ba8?w=800&auto=format&fit=crop&q=80',
    'cnc': 'https://upload.wikimedia.org/wikipedia/commons/e/e6/Kent_USA_Compact_Vertical_Turning_Center_KVT-75E.jpg',
    'hydraulic': 'https://upload.wikimedia.org/wikipedia/commons/9/9a/40-ton-shop-press.jpg',
    'conveyor': 'https://upload.wikimedia.org/wikipedia/commons/1/1e/Conveyor_system_in_a_factory.jpg'
}

def fetch_and_process(key, url, alt_url):
    print(f"Fetching {key} from {url}...")
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    data = None
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=12) as r:
            data = r.read()
    except Exception as e:
        print(f"Primary failed for {key}: {e}. Trying alt...")
        try:
            req = urllib.request.Request(alt_url, headers=headers)
            with urllib.request.urlopen(req, timeout=12) as r:
                data = r.read()
        except Exception as e2:
            print(f"Alt also failed for {key}: {e2}")
            return None

    img = Image.open(io.BytesIO(data))
    if img.mode != 'RGB':
        img = img.convert('RGB')
    
    # Crop to 16:10 or center fit ~ 480x300
    target_w, target_h = 480, 280
    img_fit = ImageOps.fit(img, (target_w, target_h), method=Image.Resampling.LANCZOS)
    
    buf = io.BytesIO()
    img_fit.save(buf, format='WEBP', quality=82)
    b64_str = base64.b64encode(buf.getvalue()).decode('utf-8')
    data_uri = f"data:image/webp;base64,{b64_str}"
    print(f"  Processed {key}: {img_fit.size}, {len(buf.getvalue())} bytes")
    return data_uri

def main():
    result = {}
    for k in sources:
        uri = fetch_and_process(k, sources[k], alt_sources[k])
        if uri:
            result[k] = uri
    with open('tools/processed_images.json', 'w') as f:
        json.dump(result, f)
    print("Done. Saved to tools/processed_images.json")

if __name__ == '__main__':
    main()
