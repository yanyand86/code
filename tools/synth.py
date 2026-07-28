#!/usr/bin/env python3
"""Synthesise one module to WAV with Kokoro, recording section offsets so the
   player can still skip by section inside a single MP3.
   Run: python tools/synth.py m1"""
import json, os, sys
import numpy as np
import soundfile as sf
from kokoro import KPipeline

MODULE = sys.argv[1]
VOICE  = os.environ.get("KOKORO_VOICE", "bf_emma")   # bf_alice bf_emma bf_isabella bf_lily bm_george bm_lewis
SPEED  = float(os.environ.get("KOKORO_SPEED", "0.95"))
SR     = 24000
GAP    = 0.55                                        # pause between sections

manifest = json.load(open("narration/manifest.json"))
mod = next(m for m in manifest if m["id"] == MODULE)

pipe = KPipeline(lang_code="b")                      # 'b' = British English
gap = np.zeros(int(SR * GAP), dtype=np.float32)
parts, marks, t = [], [], 0.0

for seg in mod["segments"]:
    marks.append({"label": seg["label"], "t": round(t, 2)})
    pieces = [np.asarray(a, dtype=np.float32).reshape(-1)
              for _, _, a in pipe(seg["text"], voice=VOICE, speed=SPEED)]
    audio = np.concatenate(pieces) if pieces else np.zeros(1, dtype=np.float32)
    parts += [audio, gap]
    t += (len(audio) + len(gap)) / SR
    print(f"  {seg['label'][:52]:<54} {t/60:5.1f} min", flush=True)

full = np.concatenate(parts)
sf.write(f"{MODULE}.wav", full, SR)
json.dump({"id": MODULE, "n": mod["n"], "title": mod["title"], "voice": VOICE,
           "duration": round(len(full) / SR, 2), "marks": marks},
          open(f"{MODULE}.json", "w"), indent=1)
print(f"{MODULE}: {len(full)/SR/60:.1f} min, {len(marks)} sections")
