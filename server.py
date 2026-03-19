import edge_tts
from fastapi import FastAPI, Query
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/voices")
async def get_voices():
    voices = await edge_tts.list_voices()
    return voices


@app.get("/timing")
async def get_timing(
    text: str = Query(...),
    voice: str = Query("en-US-JennyNeural"),
    rate: str = Query("+0%"),
    pitch: str = Query("+0Hz"),
):
    """Returns word-level timing data so frontend can highlight each word."""
    words = []
    communicate = edge_tts.Communicate(text=text, voice=voice, rate=rate, pitch=pitch)
    async for chunk in communicate.stream():
        if chunk["type"] == "WordBoundary":
            words.append({
                "word": chunk["text"],
                "start": chunk["offset"] / 10_000_000,       # convert to seconds
                "duration": chunk["duration"] / 10_000_000,  # convert to seconds
            })
    return words


@app.get("/speak")
async def speak(
    text: str = Query(...),
    voice: str = Query("en-US-JennyNeural"),
    rate: str = Query("+0%"),
    pitch: str = Query("+0Hz"),
):
    async def generate():
        communicate = edge_tts.Communicate(text=text, voice=voice, rate=rate, pitch=pitch)
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                yield chunk["data"]

    return StreamingResponse(
        generate(),
        media_type="audio/mpeg",
        headers={"Cache-Control": "no-cache"}
    )