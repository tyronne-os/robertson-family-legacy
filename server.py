"""
Robertson Family Photo Lab — FastAPI backend
Runs on GCP Compute Engine with NVIDIA T4/L4 GPU (Spot VM).
Loads DeepSeek Janus-Pro-7B in 4-bit quantization to stay under 6 GB VRAM.

Start:
    uvicorn server:app --host 0.0.0.0 --port 8000 --workers 1
"""

import io
import base64
import logging
import os
import subprocess
import threading
import time
from contextlib import asynccontextmanager

import torch
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image
from transformers import AutoModelForCausalLM, AutoProcessor, BitsAndBytesConfig

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("photo-lab")

MODEL_ID = "deepseek-ai/Janus-Pro-7B"
_processor = None
_model = None


def load_model():
    global _processor, _model
    log.info("Loading %s in 4-bit …", MODEL_ID)
    bnb_cfg = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_compute_dtype=torch.float16,
        bnb_4bit_use_double_quant=True,
        bnb_4bit_quant_type="nf4",
    )
    _processor = AutoProcessor.from_pretrained(MODEL_ID, trust_remote_code=True)
    _model = AutoModelForCausalLM.from_pretrained(
        MODEL_ID,
        quantization_config=bnb_cfg,
        device_map="auto",
        trust_remote_code=True,
    )
    _model.eval()
    log.info("Model ready.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_model()
    yield


app = FastAPI(title="Robertson Photo Lab", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


# ── helpers ──────────────────────────────────────────────────────────────────

def decode_image(b64: str) -> Image.Image:
    data = base64.b64decode(b64.split(",", 1)[-1])  # strip optional data-URI prefix
    return Image.open(io.BytesIO(data)).convert("RGB")


def encode_image(img: Image.Image, fmt: str = "JPEG") -> str:
    buf = io.BytesIO()
    img.save(buf, format=fmt, quality=90)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def run_janus(image: Image.Image, prompt: str) -> Image.Image:
    conversation = [
        {
            "role": "User",
            "content": [
                {"type": "image"},
                {"type": "text", "text": prompt},
            ],
        }
    ]
    inputs = _processor(
        conversations=conversation,
        images=[image],
        force_batchify=True,
    ).to(_model.device)

    with torch.inference_mode():
        outputs = _model.generate(
            **inputs,
            max_new_tokens=512,
            do_sample=False,
        )

    # Janus returns the modified image tensor alongside text; extract it.
    # The processor's decode_image utility handles this.
    result = _processor.decode_image(outputs[0])
    return result if isinstance(result, Image.Image) else image


# ── routes ───────────────────────────────────────────────────────────────────

class RestoreRequest(BaseModel):
    image: str        # base64 or data-URI
    prompt: str = (
        "Restore this vintage family photograph: remove scratches, repair tears, "
        "reduce noise, sharpen faces, and enhance tonal range while preserving the "
        "authentic 1950s–1970s film look."
    )


class RefineRequest(BaseModel):
    image: str
    prompt: str


@app.get("/api/health")
def health():
    return {"status": "ok", "model": MODEL_ID, "device": str(next(_model.parameters()).device)}


@app.post("/api/restore")
def restore(req: RestoreRequest):
    try:
        img = decode_image(req.image)
        result = run_janus(img, req.prompt)
        return {"image": encode_image(result)}
    except Exception as exc:
        log.exception("restore failed")
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/api/chat-refine")
def chat_refine(req: RefineRequest):
    try:
        img = decode_image(req.image)
        result = run_janus(img, req.prompt)
        return {"image": encode_image(result)}
    except Exception as exc:
        log.exception("refine failed")
        raise HTTPException(status_code=500, detail=str(exc))
