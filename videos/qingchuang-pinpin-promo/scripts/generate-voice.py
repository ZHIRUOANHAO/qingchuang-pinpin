"""Use the installed Chinese Edge TTS provider; preserve real word boundaries."""
import asyncio
import json
from pathlib import Path
import edge_tts

ROOT = Path(__file__).resolve().parent.parent
PLAN = json.loads((ROOT / "story.json").read_text(encoding="utf-8"))
OUT = ROOT / "assets" / "voice"

async def generate(scene, sem):
    async with sem:
        target = OUT / (scene["id"] + ".mp3")
        words = []
        request = edge_tts.Communicate(scene["text"], PLAN["voice"], rate=scene["rate"],
                                       pitch=scene["pitch"], volume=scene["volume"], boundary="WordBoundary")
        with target.open("wb") as audio:
            async for chunk in request.stream():
                if chunk["type"] == "audio":
                    audio.write(chunk["data"])
                elif chunk["type"] == "WordBoundary":
                    words.append({"id": str(len(words)), "text": chunk["text"],
                                  "start": chunk["offset"] / 10_000_000,
                                  "end": (chunk["offset"] + chunk["duration"]) / 10_000_000})
        if not words or target.stat().st_size < 1000:
            raise RuntimeError("Missing voice or timings: " + scene["id"])
        result = {"frame": scene["frame"], "path": "assets/voice/" + target.name,
                  "duration_s": round(words[-1]["end"] + 0.6, 3), "words": words,
                  "provider": "edge-tts", "voice": PLAN["voice"]}
        (OUT / (scene["id"] + ".words.json")).write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        print(scene["id"], round(words[-1]["end"], 3), "seconds", flush=True)
        return result

async def main():
    OUT.mkdir(parents=True, exist_ok=True)
    voices = await asyncio.gather(*(generate(scene, asyncio.Semaphore(3)) for scene in PLAN["scenes"]))
    meta = {"version": "0.1", "last_updated": "2026-10-08", "voices": voices, "bgm": None, "sfx": []}
    (ROOT / "audio_meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")

if __name__ == "__main__":
    asyncio.run(main())
