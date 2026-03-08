from io import BytesIO

import cv2
import httpx
import imagehash
import numpy as np
import pdqhash
from fastapi import FastAPI, HTTPException
from PIL import Image
from pydantic import BaseModel, HttpUrl

app = FastAPI()


class ImageUrlRequest(BaseModel):
    url: HttpUrl


class PdqHashResult(BaseModel):
    original: str
    rotated_90: str
    rotated_180: str
    rotated_270: str
    flipped_vertical: str
    flipped_horizontal: str
    rotated_90_flipped: str
    rotated_270_flipped: str
    quality: float


class ImageHashResponse(BaseModel):
    perceptual_hash: str
    pdqhash: PdqHashResult


@app.post("/get-image-hash", response_model=ImageHashResponse)
async def process_image(request: ImageUrlRequest):
    # Download image from URL
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(str(request.url), timeout=30.0)
            response.raise_for_status()
            image_data = response.content
    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=400, detail=f"Failed to download image: {str(e)}"
        )

    try:
        # Perceptual hash using imagehash (phash)
        pil_image = Image.open(BytesIO(image_data))
        phash = str(imagehash.phash(pil_image))

        # PDQ hash with four-towards (dihedral) check
        # Convert PIL image to OpenCV format (numpy array)
        if pil_image.mode != "RGB":
            pil_image = pil_image.convert("RGB")

        cv_image = cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)

        # compute_dihedral returns hashes for original + 7 transformations
        hash_vectors, quality = pdqhash.compute_dihedral(cv_image)

        # Convert hash vectors to hex strings
        hash_hex_list = [hv.tobytes().hex() for hv in hash_vectors]

        pdqhash_result = PdqHashResult(
            original=hash_hex_list[0],
            rotated_90=hash_hex_list[1],
            rotated_180=hash_hex_list[2],
            rotated_270=hash_hex_list[3],
            flipped_vertical=hash_hex_list[4],
            flipped_horizontal=hash_hex_list[5],
            rotated_90_flipped=hash_hex_list[6],
            rotated_270_flipped=hash_hex_list[7],
            quality=float(quality),
        )

        return ImageHashResponse(
            perceptual_hash=phash,
            pdqhash=pdqhash_result,
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to process image: {str(e)}"
        )
