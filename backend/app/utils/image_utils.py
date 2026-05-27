import os
from io import BytesIO
from PIL import Image

MAX_DIMENSION = 600
QUALITY = 60

def save_compressed_image(file, save_path):
    if not file or not file.filename:
        return
    img = Image.open(file)
    img = img.convert('RGB')

    if max(img.width, img.height) > MAX_DIMENSION:
        ratio = MAX_DIMENSION / max(img.width, img.height)
        new_size = (int(img.width * ratio), int(img.height * ratio))
        img = img.resize(new_size, Image.LANCZOS)

    buf = BytesIO()
    img.save(buf, format='JPEG', quality=QUALITY, optimize=True)
    buf.seek(0)

    with open(save_path, 'wb') as f:
        f.write(buf.getvalue())
