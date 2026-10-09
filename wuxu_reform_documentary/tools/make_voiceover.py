"""Place the synthesised narration clips on the film timeline -> output/voiceover.wav (mono, 48 kHz).

Light-weight voice-only pass (make_audio.py writes the same file as part of the full mix).
"""
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from make_audio import ROOT, SR, read_wav, write_wav, norm_rms_active  # noqa: E402


def main():
    tl = json.load(open(os.path.join(ROOT, "build", "timeline.json"), encoding="utf-8"))
    cues = {c["key"]: c for c in tl["cues"]}
    n = int((tl["total"] + 0.2) * SR)
    voice = np.zeros((n, 2))
    for clip in json.load(open(os.path.join(ROOT, "build", "tts", "manifest.json"), encoding="utf-8"))["clips"]:
        c = cues[clip["key"]]
        v = read_wav(os.path.join(ROOT, "build", "tts", clip["file"]))
        i = int(c["start"] * SR)
        j = min(n, i + len(v))
        voice[i:j, 0] += v[: j - i]
        voice[i:j, 1] += v[: j - i]
    voice = norm_rms_active(voice, -17.5)
    write_wav(os.path.join(ROOT, "output", "voiceover.wav"), voice[:, 0])
    print(f"voiceover: {n / SR:.2f}s mono")


if __name__ == "__main__":
    main()
