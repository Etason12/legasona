import base64
import logging
from io import BytesIO
from PIL import Image

logger = logging.getLogger(__name__)

MAX_DIMENSION = 600
QUALITY = 60

def compress_to_base64(file):
    if not file or not file.filename:
        return None
    try:
        img = Image.open(file)
        img = img.convert('RGB')

        if max(img.width, img.height) > MAX_DIMENSION:
            ratio = MAX_DIMENSION / max(img.width, img.height)
            new_size = (int(img.width * ratio), int(img.height * ratio))
            img = img.resize(new_size, Image.LANCZOS)

        buf = BytesIO()
        img.save(buf, format='JPEG', quality=QUALITY, optimize=True)
        buf.seek(0)

        b64 = base64.b64encode(buf.getvalue()).decode('utf-8')
        return f'data:image/jpeg;base64,{b64}'
    except Exception as e:
        logger.warning(f"Failed to compress image {getattr(file, 'filename', 'unknown')}: {e}")
        return None
