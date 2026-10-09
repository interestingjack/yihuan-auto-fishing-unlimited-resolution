"""Concatenate rendered chunks, burn in ASS subtitles, add the mixed audio, export MP4.

usage: python3 tools/mux.py [--from 0] [--to END] [--out output/wuxu_reform.mp4] [--crf 20 | --bitrate 2300k]

--bitrate runs a two-pass encode so the file size is predictable (GitHub rejects files > 100 MB).
"""
import argparse
import json
import os
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main():
    tl = json.load(open(os.path.join(ROOT, "build", "timeline.json"), encoding="utf-8"))
    ap = argparse.ArgumentParser()
    ap.add_argument("--from", dest="t0", type=float, default=0.0)
    ap.add_argument("--to", dest="t1", type=float, default=tl["total"])
    ap.add_argument("--out", default=os.path.join(ROOT, "output", "wuxu_reform.mp4"))
    ap.add_argument("--crf", type=int, default=20)
    ap.add_argument("--maxrate", default="")
    ap.add_argument("--bitrate", default="", help="two-pass target video bitrate, e.g. 2300k")
    ap.add_argument("--chunks", default=os.path.join(ROOT, "build", "chunks"))
    a = ap.parse_args()
    fps = tl["fps"]
    f0, f1 = round(a.t0 * fps), round(a.t1 * fps)
    lst = os.path.join(a.chunks, f"list_{f0}_{f1}.txt")
    if not os.path.exists(lst):
        raise SystemExit(f"missing {lst} - run render/render.mjs --from {a.t0} --to {a.t1} first")
    ass = os.path.join(ROOT, "build", "subtitles.ass")
    fontsdir = os.path.join(ROOT, "build", "subfont")
    # shift timestamps so the ASS (absolute film time) lines up, then reset to 0
    vf = (f"setpts=PTS+{a.t0}/TB,ass='{ass}':fontsdir='{fontsdir}',setpts=PTS-STARTPTS,format=yuv420p")
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    inputs = ["ffmpeg", "-y", "-loglevel", "error", "-stats",
              "-f", "concat", "-safe", "0", "-i", lst,
              "-ss", f"{a.t0}", "-t", f"{a.t1 - a.t0}", "-i", os.path.join(ROOT, "build", "mix.wav")]
    venc = ["-vf", vf, "-r", str(fps),
            "-c:v", "libx264", "-preset", "slow", "-profile:v", "high", "-pix_fmt", "yuv420p",
            "-tune", "film", "-x264-params", "aq-mode=3"]
    aenc = ["-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
            "-map", "0:v:0", "-map", "1:a:0", "-shortest", "-movflags", "+faststart", a.out]
    if a.bitrate:
        log = os.path.join(ROOT, "build", "x264_2pass")
        venc += ["-b:v", a.bitrate, "-passlogfile", log]
        if a.maxrate:
            venc += ["-maxrate", a.maxrate, "-bufsize", "12M"]
        p1 = inputs + venc + ["-pass", "1", "-an", "-map", "0:v:0", "-f", "null", os.devnull]
        print(" ".join(p1))
        subprocess.run(p1, check=True)
        cmd = inputs + venc + ["-pass", "2"] + aenc
    else:
        venc += ["-crf", str(a.crf)]
        if a.maxrate:
            venc += ["-maxrate", a.maxrate, "-bufsize", "12M"]
        cmd = inputs + venc + aenc
    print(" ".join(cmd))
    subprocess.run(cmd, check=True)
    print("wrote", a.out)


if __name__ == "__main__":
    main()
