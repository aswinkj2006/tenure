import urllib.request
import urllib.parse
import json
import os
import base64
import io
from PIL import Image

def get_wikimedia_images(query, limit=10):
    encoded = urllib.parse.quote(query)
    url = f"https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch={encoded}&gsrlimit={limit}&prop=imageinfo&iiprop=url|size|mime|extmetadata&format=json"
    req = urllib.request.Request(url, headers={'User-Agent': 'TenurePitchDeck/1.0 (contact@tenure.io)'})
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            pages = data.get('query', {}).get('pages', {})
            results = []
            for pid, page in pages.items():
                info = page.get('imageinfo', [{}])[0]
                if info.get('mime') in ['image/jpeg', 'image/png', 'image/webp']:
                    results.append({
                        'title': page.get('title'),
                        'url': info.get('url'),
                        'width': info.get('width'),
                        'height': info.get('height')
                    })
            return results
    except Exception as e:
        print('Error searching:', e)
        return []

def main():
    queries = {
        'ur5': ['Universal Robots UR5', 'Universal Robots UR3', 'UR5 cobot', 'collaborative robot arm'],
        'cnc': ['CNC lathe machine', 'CNC turning center', 'CNC milling machine'],
        'hydraulic': ['hydraulic press metal', 'hydraulic shop press', 'hydraulic stamping press'],
        'conveyor': ['industrial conveyor roller', 'factory conveyor belt', 'conveyor system industrial']
    }
    for cat, qs in queries.items():
        print(f"=== Category: {cat} ===")
        for q in qs:
            res = get_wikimedia_images(q, 3)
            for r in res:
                print(f"  {r['title']} -> {r['url']}")

if __name__ == '__main__':
    main()
