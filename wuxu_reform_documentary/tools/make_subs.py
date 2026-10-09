"""Generate subtitles from the measured timeline: SRT (deliverable) + styled ASS (burn-in)."""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def ts_srt(t):
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def ts_ass(t):
    cs = int(round(t * 100))
    h, cs = divmod(cs, 360000)
    m, cs = divmod(cs, 6000)
    s, cs = divmod(cs, 100)
    return f"{h:d}:{m:02d}:{s:02d}.{cs:02d}"


def main():
    tl = json.load(open(os.path.join(ROOT, "build", "timeline.json"), encoding="utf-8"))
    cues = tl["cues"]
    # extend each cue slightly into the following pause (readability) without overlapping
    events = []
    for i, c in enumerate(cues):
        start = c["start"]
        end = c["end"] + 0.25
        if i + 1 < len(cues):
            end = min(end, cues[i + 1]["start"] - 0.04)
        events.append((start, end, c["text"]))

    os.makedirs(os.path.join(ROOT, "output"), exist_ok=True)
    with open(os.path.join(ROOT, "output", "subtitles.srt"), "w", encoding="utf-8") as f:
        for i, (a, b, txt) in enumerate(events, 1):
            f.write(f"{i}\n{ts_srt(a)} --> {ts_srt(b)}\n{txt}\n\n")

    header = """[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Narr,Noto Sans SC Sub,48,&H00F4F1EC,&H000000FF,&H8C0A0806,&H96000000,0,0,0,0,100,100,1.5,0,1,2.6,1.4,2,160,160,58,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    with open(os.path.join(ROOT, "build", "subtitles.ass"), "w", encoding="utf-8") as f:
        f.write(header)
        for a, b, txt in events:
            f.write(f"Dialogue: 0,{ts_ass(a)},{ts_ass(b)},Narr,,0,0,0,,{{\\fad(120,120)}}{txt}\n")
    print(f"subtitles: {len(events)} events -> output/subtitles.srt, build/subtitles.ass")


if __name__ == "__main__":
    main()
