"""Procedural score + sound design + final mix.

Everything is synthesised (no external samples): string pads, a guzheng-like
plucked string, bronze bells, taiko/timpani, a cello-like lead, drones and
ambiences, plus SFX (cannon, seal stamps, paper, gong).  Musical sections and
hit points follow build/timeline.json so the score stays in sync with picture.

If narration clips exist (build/tts/manifest.json) they are placed on the
timeline, the music is ducked under the voice, and output/voiceover.wav is
written as well.

Outputs: build/music.wav, build/sfx.wav, build/mix.wav (48 kHz stereo)
"""
import json
import os
import wave

import numpy as np
from scipy.signal import fftconvolve, butter, sosfilt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 48000
RNG = np.random.default_rng(1898)


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


NOTE = {n: i for i, n in enumerate(["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"])}


def nm(s):
    """'D3' -> midi number; supports sharps 'C#4' and flats 'Bb2'."""
    name, octv = s[:-1], int(s[-1])
    if len(name) == 2 and name[1] == "b":
        v = NOTE[name[0]] - 1
    else:
        v = NOTE[name]
    return 12 * (octv + 1) + v


class Bus:
    def __init__(self, dur):
        self.n = int(dur * SR) + SR
        self.buf = np.zeros((self.n, 2), dtype=np.float64)

    def add(self, t, sig, gain=1.0, pan=0.0):
        i = int(t * SR)
        if i >= self.n or i + len(sig) <= 0:
            return
        if sig.ndim == 1:
            l = np.cos((pan + 1) * np.pi / 4)
            r = np.sin((pan + 1) * np.pi / 4)
            sig = np.stack([sig * l, sig * r], axis=1)
        a = max(0, i)
        b = min(self.n, i + len(sig))
        self.buf[a:b] += sig[a - i:b - i] * gain


def env(n, a=0.01, r=0.1, curve=1.0):
    e = np.ones(n)
    na = max(1, int(a * SR))
    nr = max(1, int(r * SR))
    e[:na] = np.linspace(0, 1, na) ** curve
    if nr < n:
        e[-nr:] *= np.linspace(1, 0, nr) ** curve
    return e


# ------------------------------------------------------------------ instruments
def pad(freqs, dur, a=2.0, r=2.5, bright=4.0, detune=0.004, trem=0.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros((n, 2))
    for fi, f in enumerate(freqs):
        for v, (dt, pan) in enumerate([(-detune, -0.6), (0.0, 0.0), (detune, 0.6)]):
            ff = f * (1 + dt)
            vib = 1 + 0.0025 * np.sin(2 * np.pi * (4.6 + 0.3 * v) * t + fi + v)
            phase = 2 * np.pi * ff * np.cumsum(vib) / SR
            s = np.zeros(n)
            for k in range(1, 13):
                if ff * k > 9000:
                    break
                s += np.sin(k * phase + RNG.uniform(0, 6.28)) * (1 / k) * np.exp(-k / bright)
            l = np.cos((pan + 1) * np.pi / 4)
            rr = np.sin((pan + 1) * np.pi / 4)
            out[:, 0] += s * l
            out[:, 1] += s * rr
    e = env(n, a, r, 1.6)
    if trem:
        e = e * (1 - 0.35 * (0.5 + 0.5 * np.sin(2 * np.pi * trem * t)))
    out *= e[:, None] / (len(freqs) * 3)
    return out


def pluck(f, dur=2.5, bright=1.0, bend=0.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.zeros(n)
    B = 0.00015
    fb = f * (1 + bend * np.exp(-t * 6))  # slight pitch bend (按音 feel)
    phase = 2 * np.pi * np.cumsum(fb) / SR
    for k in range(1, 18):
        if f * k > 12000:
            break
        fk = k * np.sqrt(1 + B * k * k)
        dec = 1.6 + 0.9 * k / bright
        s += np.sin(fk * phase + RNG.uniform(0, 6.28)) * (1 / k ** 1.1) * np.exp(-dec * t)
    click = RNG.normal(0, 1, n) * np.exp(-t * 300) * 0.3
    s = (s + click) * env(n, 0.002, 0.05)
    return s * 0.5


def bell(f, dur=5.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.zeros(n)
    for ratio, amp, dec in [(1, 1, 0.9), (2.0, 0.5, 1.4), (2.76, 0.6, 1.8), (5.4, 0.35, 3.0), (8.93, 0.2, 4.5), (0.5, 0.4, 0.6)]:
        s += amp * np.sin(2 * np.pi * f * ratio * t + RNG.uniform(0, 6)) * np.exp(-dec * t)
    s *= env(n, 0.003, 0.3)
    return s * 0.3


def taiko(dur=1.8, f0=110, f1=48, noise=0.25):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t * 18)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.6)
    s += RNG.normal(0, 1, n) * np.exp(-t * 40) * noise
    return s * env(n, 0.001, 0.2) * 0.9


def gong(f=92, dur=7.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.zeros(n)
    for ratio, amp, dec in [(1, 1, 0.45), (1.47, 0.6, 0.6), (2.09, 0.5, 0.8), (2.56, 0.4, 1.0), (3.2, 0.3, 1.3), (4.1, 0.25, 1.8), (5.3, 0.2, 2.4)]:
        wob = 1 + 0.004 * np.sin(2 * np.pi * 0.7 * t)
        s += amp * np.sin(2 * np.pi * f * ratio * np.cumsum(wob) / SR) * np.exp(-dec * t)
    swell = 1 - np.exp(-t * 6)
    return s * swell * env(n, 0.005, 1.0) * 0.35


def cello(f, dur, a=0.35, r=0.6, vib=0.006):
    n = int(dur * SR)
    t = np.arange(n) / SR
    v = 1 + vib * np.sin(2 * np.pi * 5.2 * t) * np.clip(t / 0.6, 0, 1)
    phase = 2 * np.pi * f * np.cumsum(v) / SR
    s = np.zeros(n)
    for k in range(1, 16):
        if f * k > 8000:
            break
        s += np.sin(k * phase) * (1 / k) * np.exp(-k / 5.0)
    bow = 1 + 0.03 * RNG.normal(0, 1, n).cumsum() / np.sqrt(np.arange(1, n + 1))
    return s * env(n, a, r, 1.4) * bow * 0.35


def lowpass(x, fc, order=2):
    sos = butter(order, fc / (SR / 2), btype="low", output="sos")
    return sosfilt(sos, x, axis=0)


def highpass(x, fc, order=2):
    sos = butter(order, fc / (SR / 2), btype="high", output="sos")
    return sosfilt(sos, x, axis=0)


def bandpass(x, lo, hi, order=2):
    sos = butter(order, [lo / (SR / 2), hi / (SR / 2)], btype="band", output="sos")
    return sosfilt(sos, x, axis=0)


def noise(dur):
    return RNG.normal(0, 1, int(dur * SR))


def wind(dur, gain=1.0):
    n = noise(dur)
    s = bandpass(n, 120, 900)
    t = np.arange(len(s)) / SR
    lfo = 0.6 + 0.4 * np.sin(2 * np.pi * 0.07 * t) * np.sin(2 * np.pi * 0.031 * t + 1)
    return s * lfo * gain * 0.15


def reverb_ir(dur=2.8, decay=2.4):
    n = int(dur * SR)
    t = np.arange(n) / SR
    ir = np.stack([RNG.normal(0, 1, n), RNG.normal(0, 1, n)], axis=1) * np.exp(-decay * t)[:, None]
    ir = lowpass(ir, 6000)
    ir[: int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))[:, None]
    return ir / np.sqrt((ir ** 2).sum(axis=0))


# ------------------------------------------------------------------ score
def chord_tones(spec):
    return [midi(nm(s)) for s in spec.split()]


def main():
    tl = json.load(open(os.path.join(ROOT, "build", "timeline.json"), encoding="utf-8"))
    total = tl["total"]
    S = {s["id"]: s for s in tl["scenes"]}
    ch = {c["id"]: c["start"] for c in tl["chapters"]}
    ch[8] = total

    def sc(id_):
        return next(v for k, v in S.items() if k.startswith(id_))

    def cue(id_, i):
        s = sc(id_)
        cs = s["cues"]
        if not cs:
            return {"start": 0, "end": s["dur"]}
        return cs[min(i, len(cs) - 1)]

    def line(id_, l):
        s = sc(id_)
        cs = [c for c in s["cues"] if c["line"] == l]
        return cs[0] if cs else cue(id_, 0)

    music = Bus(total + 4)
    sfx = Bus(total + 4)

    def pad_seq(t0, t1, chords, gain, bright=4.0, a=2.0, r=2.5, trem=0.0):
        if t1 <= t0:
            return
        step = (t1 - t0) / len(chords)
        for i, c in enumerate(chords):
            music.add(t0 + i * step - 0.6, pad(chord_tones(c), step + 2.2, a=a, r=r, bright=bright, trem=trem), gain)

    def pent_melody(t0, t1, scale, bpm, density, gain, seed, octave_shift=0, bright=1.0, pan_spread=0.5):
        rng = np.random.default_rng(seed)
        beat = 60 / bpm
        t = t0
        idx = len(scale) // 2
        while t < t1 - 0.5:
            if rng.random() < density:
                idx = int(np.clip(idx + rng.choice([-2, -1, -1, 1, 1, 2]), 0, len(scale) - 1))
                f = midi(nm(scale[idx]) + octave_shift)
                music.add(t, pluck(f, 2.8, bright, bend=0.004 if rng.random() < 0.3 else 0), gain * (0.7 + 0.3 * rng.random()), pan=rng.uniform(-pan_spread, pan_spread))
            t += beat / 2

    # ---------- Ch1 山河危局: dark drone, war drums, title swell
    c1, c2 = ch[1], ch[2]
    music.add(0, pad(chord_tones("D1 A1 D2"), c2 + 1, a=3.0, r=3.0, bright=3.0), 0.4)
    s01 = sc("S01")
    pad_seq(0.5, sc("S04")["start"], ["D2 A2 D3 F3", "Bb1 F2 D3 F3", "G1 D2 Bb2 D3", "A1 E2 C#3 E3", "D2 A2 D3 F3", "Bb1 F2 D3 F3"], 0.5, bright=3.2)
    # war: taiko rolls with the map flashes
    c0 = cue("S01", 0)
    for k in range(7):
        tt = s01["start"] + c0["start"] + 1.3 + k * 0.33
        sfx.add(tt, cannon(), 0.55 + 0.1 * (k % 2), pan=RNG.uniform(-0.5, 0.5))
    c1c = cue("S01", 1)
    for k in range(6):
        tt = s01["start"] + c1c["start"] + 0.5 + k * 0.28
        sfx.add(tt, cannon(), 0.5, pan=RNG.uniform(-0.5, 0.5))
    for k in range(8):
        music.add(s01["start"] + c0["start"] - 0.4 + k * 0.85, taiko(1.6, 95, 45), 0.45 if k % 2 == 0 else 0.3)
    # treaty: paper + low hit
    s02 = sc("S02")
    sfx.add(s02["start"] + 0.05, paper_rustle(1.2), 0.35)
    music.add(s02["start"] + cue("S02", 0)["start"] + 1.3, taiko(2.0, 70, 38, 0.1), 0.6)
    # hook: ticking calendar
    s03 = sc("S03")
    ccal = cue("S03", len(s03["cues"]) - 1)
    for k in range(int((ccal["end"] - ccal["start"]) / 0.12)):
        sfx.add(s03["start"] + ccal["start"] + 0.2 + k * 0.12, tick(), 0.18)
    music.add(s03["start"] + 0.2, taiko(2.5, 80, 40, 0.15), 0.7)
    # title: swell + gong + seal
    s04 = sc("S04")
    music.add(s04["start"] - 1.0, pad(chord_tones("D2 A2 D3 E3 A3 D4"), 8.5, a=1.5, r=3.5, bright=5.0), 0.9)
    music.add(s04["start"] + 1.1, gong(88, 8), 0.9)
    sfx.add(s04["start"] + 0.0, paper_rustle(1.4), 0.45)
    sfx.add(s04["start"] + 4.5, seal_thud(), 0.8)

    # ---------- Ch2 救亡图存: minor strings, sparse zheng, hope rising
    s05, s09 = sc("S05"), sc("S09")
    music.add(c2, wind(sc("S06")["start"] - c2 + 2, 1.0), 0.8)
    pad_seq(c2, sc("S07")["start"], ["A1 E2 A2 C3", "F1 C2 A2 C3", "D2 A2 D3 F3", "E2 B2 E3 G3"], 0.55, bright=3.5)
    pad_seq(sc("S07")["start"], ch[3], ["A1 E2 C3 E3", "F1 C2 A2 C3", "C2 G2 C3 E3", "G1 D2 B2 D3", "A1 E2 C3 E3", "F1 C2 A2 C3", "C2 G2 C3 G3", "G1 D2 G2 D3"], 0.5, bright=4.0)
    pent_melody(sc("S07")["start"], sc("S08")["start"] + 6, ["A3", "C4", "D4", "E4", "G4", "A4", "C5"], 66, 0.35, 0.55, 3)
    pent_melody(s09["start"], ch[3], ["A3", "C4", "D4", "E4", "G4", "A4", "C5", "D5"], 76, 0.6, 0.55, 4)
    sfx.add(sc("S07")["start"] + 3.8, seal_thud(), 0.5)
    sfx.add(sc("S08")["start"] + 0.2, paper_rustle(2.4), 0.35)
    for i in range(4):
        sfx.add(sc("S08")["start"] + line("S08", 1)["start"] + 0.5 + i * 0.42, brush_swish(), 0.25)

    # ---------- Ch3 维新登场: brighter, F major pentatonic, palace bells
    c3 = ch[3]
    pad_seq(c3, sc("S12")["start"], ["F1 C2 A2 C3", "D2 A2 D3 F3", "Bb1 F2 D3 F3", "C2 G2 C3 E3", "F1 C2 A2 C3", "D2 A2 D3 F3"], 0.5, bright=4.5)
    pent_melody(c3 + 1, sc("S12")["start"], ["F3", "G3", "A3", "C4", "D4", "F4", "G4", "A4"], 78, 0.55, 0.5, 5)
    s12 = sc("S12")
    music.add(s12["start"] - 1, pad(chord_tones("F1 C2 F2 A2 C3 F3 A3"), s12["dur"] + 3, a=1.6, r=3.0, bright=6), 0.75)
    for k, n_ in enumerate(["F4", "C5", "A4", "F5"]):
        music.add(s12["start"] + 0.6 + k * 1.6, bell(midi(nm(n_)), 6), 0.6, pan=(k - 1.5) * 0.3)
    music.add(s12["start"] + 0.2, taiko(2.4, 70, 40, 0.1), 0.6)
    s13 = sc("S13")
    sfx.add(s13["start"] + 0.1, paper_rustle(1.8), 0.4)
    pad_seq(s13["start"], ch[4], ["Bb1 F2 D3 F3", "C2 G2 E3 G3", "F1 C2 A2 C3", "D2 A2 F3 A3", "Bb1 F2 D3 F3", "C2 G2 C3 E3"], 0.5, bright=5)
    pent_melody(s13["start"], ch[4], ["F3", "G3", "A3", "C4", "D4", "F4", "G4", "A4", "C5"], 84, 0.6, 0.5, 6)

    # ---------- Ch4 百日新政: determined pulse at 88 BPM
    c4, c5 = ch[4], ch[5]
    bpm = 88
    beat = 60 / bpm
    nb = int((c5 - c4) / beat)
    for b in range(nb):
        tt = c4 + b * beat
        if b % 4 == 0:
            music.add(tt, taiko(1.2, 90, 50, 0.15), 0.38)
        elif b % 4 == 2:
            music.add(tt, taiko(0.8, 140, 80, 0.2), 0.18)
    prog4 = ["G1 D2 B2 D3", "E2 B2 E3 G3", "C2 G2 C3 E3", "D2 A2 D3 F#3"]
    bars = int((c5 - c4) / (beat * 4))
    for b in range(bars):
        music.add(c4 + b * beat * 4 - 0.3, pad(chord_tones(prog4[b % 4]), beat * 4 + 1.6, a=0.6, r=1.4, bright=5), 0.42)
        # arpeggio ostinato (plucked)
        tones = chord_tones(prog4[b % 4])[1:] + [chord_tones(prog4[b % 4])[1] * 2]
        for k in range(8):
            f = tones[k % len(tones)] * 2
            music.add(c4 + b * beat * 4 + k * beat / 2, pluck(f, 1.4, 1.2), 0.22 + 0.06 * (k % 2 == 0), pan=-0.4 + 0.8 * (k % 4) / 3)
    pent_melody(c4 + 2, c5 - 1, ["G4", "A4", "B4", "D5", "E5", "G5"], bpm, 0.35, 0.35, 7)
    for id_ in ["S15", "S16", "S17", "S19", "S20"]:
        sfx.add(sc(id_)["start"] + 0.05, seal_thud(), 0.45)
    s16 = sc("S16")
    for i in range(7):
        sfx.add(s16["start"] + line("S16", 0)["start"] + 0.8 + i * 0.25, brush_swish(), 0.22)
    s18 = sc("S18")
    for k, n_ in enumerate(["G4", "D5", "B4"]):
        music.add(s18["start"] + 0.5 + k * 2.2, bell(midi(nm(n_)), 6), 0.4, pan=(k - 1) * 0.4)
    sfx.add(sc("S15")["start"], paper_rustle(3.5), 0.35)

    # ---------- Ch5 风暴将至: tension
    c6 = ch[6]
    music.add(c5 - 0.5, pad(chord_tones("D2 A2 D3"), c6 - c5 + 1.5, a=2.5, r=1.5, bright=2.5), 0.5)
    music.add(c5 + 2, pad(chord_tones("D3 D#3 A3"), c6 - c5 - 1, a=4, r=1.5, bright=3, trem=7.5), 0.35)
    music.add(sc("S23")["start"], pad(chord_tones("G2 C#3 G3 A#3"), c6 - sc("S23")["start"] + 0.5, a=3, r=1.2, bright=3.5, trem=9), 0.3)
    # heartbeat accelerating
    t = c5 + 1.5
    while t < c6 - 1.2:
        k = (t - c5) / (c6 - c5)
        period = 1.1 - 0.45 * k
        music.add(t, taiko(0.5, 70, 40, 0.0), 0.35 + 0.25 * k)
        music.add(t + 0.22, taiko(0.5, 65, 38, 0.0), 0.22 + 0.15 * k)
        t += period
    music.add(c5, wind(c6 - c5 + 1, 1.3), 0.9)
    for k in range(int((sc("S24")["start"] + sc("S24")["dur"] - sc("S22")["start"]) / 1.0)):
        sfx.add(sc("S22")["start"] + 0.5 + k * 1.0, tick(), 0.08)
    sfx.add(sc("S23")["start"] + line("S23", 1)["start"], seal_thud(), 0.5)

    # ---------- Ch6 戊戌政变: hit, silence, lament
    c7 = ch[7]
    s25 = sc("S25")
    hit = s25["start"] + cue("S25", 0)["start"]
    music.add(hit - 0.05, taiko(3.0, 85, 36, 0.3), 1.0)
    music.add(hit, gong(70, 9), 1.0)
    music.add(hit + 2.0, pad(chord_tones("D2 A2 D3 F3"), 6, a=3, r=3, bright=2.8), 0.45)
    lament = ["A3 1.5", "D4 1.0", "F4 1.0", "E4 2.0", "D4 1.0", "C4 1.0", "A3 2.5", "G3 1.0", "A3 1.0", "C4 1.0", "D4 3.0"]
    t = hit + 3.0
    for item in lament:
        n_, d = item.split()
        music.add(t, cello(midi(nm(n_)), float(d) + 0.6), 0.55, pan=-0.1)
        t += float(d)
    pad_seq(hit + 3.0, sc("S27")["start"] + 1, ["D2 A2 D3 F3", "G1 D2 Bb2 D3", "Bb1 F2 D3 F3", "A1 E2 C#3 E3"], 0.42, bright=3)
    s27 = sc("S27")
    music.add(s27["start"], pad(chord_tones("D2 A2 D3"), s27["dur"] + 1, a=2, r=2, bright=2.5), 0.35)
    c27a, c27b = cue("S27", 0), cue("S27", 1)
    starts = [c27a["start"] + 0.6 + i * ((c27a["end"] - c27a["start"] - 0.6) / 5) for i in range(5)] + [c27b["start"] + 0.1]
    for i, st in enumerate(starts):
        music.add(s27["start"] + st, bell(midi(nm("D4")) * (1 if i % 2 == 0 else 0.749), 6), 0.45, pan=-0.5 + i * 0.2)
    s28 = sc("S28")
    pad_seq(s28["start"], c7, ["D2 A2 D3 F3", "Bb1 F2 D3 F3", "G1 D2 Bb2 D3", "A1 E2 C#3 E3"], 0.4, bright=3)
    poem = ["D4 1.2", "F4 1.2", "A4 2.0", "G4 1.0", "F4 1.0", "E4 2.4", "D4 3.0"]
    t = s28["start"] + line("S28", 1)["start"] - 0.5
    for item in poem:
        n_, d = item.split()
        music.add(t, cello(midi(nm(n_)), float(d) + 0.6), 0.5, pan=0.1)
        t += float(d)
    music.add(c6, wind(c7 - c6, 0.8), 0.6)

    # ---------- Ch7 历史回响: reflective resolution
    end = total
    pad_seq(c7, sc("S31")["start"], ["Bb1 F2 D3 F3", "F1 C2 A2 C3", "C2 G2 E3 G3", "D2 A2 F3 A3"], 0.5, bright=5)
    pent_melody(c7 + 1, sc("S31")["start"] + 2, ["F3", "G3", "A3", "C4", "D4", "F4", "G4", "A4"], 70, 0.5, 0.45, 9)
    s31 = sc("S31")
    music.add(s31["start"] - 0.5, pad(chord_tones("Bb1 F2 D3 F3 A3"), 5.5, a=2, r=2.5, bright=5), 0.5)
    music.add(s31["start"] + 4.5, pad(chord_tones("F1 C2 F2 A2 C3 F3 A3"), end - s31["start"] - 3.0, a=2.5, r=5.0, bright=5.5), 0.6)
    music.add(s31["start"] + 4.6, bell(midi(nm("F4")), 7), 0.5)
    music.add(sc("S32")["start"] + 0.3, bell(midi(nm("C5")), 7), 0.35, pan=0.3)
    music.add(sc("S32")["start"] + 2.2, bell(midi(nm("A4")), 7), 0.3, pan=-0.3)
    sfx.add(sc("S31")["start"] + 0.3, paper_rustle(1.6), 0.3)

    # ---------- process & mix
    ir = reverb_ir(3.0, 2.0)
    m = music.buf
    wet = np.stack([fftconvolve(m[:, 0], ir[:, 0])[: len(m)], fftconvolve(m[:, 1], ir[:, 1])[: len(m)]], axis=1)
    m = m * 0.78 + wet * 0.42
    m = lowpass(m, 11000, 2)
    # tame the low end: high-pass 45 Hz + ~-5 dB low shelf below ~140 Hz (keeps narration clear)
    m = highpass(m, 45, 2)
    m = m - 0.45 * lowpass(m, 140, 2)
    fx = sfx.buf
    fwet = np.stack([fftconvolve(fx[:, 0], ir[:, 0])[: len(fx)], fftconvolve(fx[:, 1], ir[:, 1])[: len(fx)]], axis=1)
    fx = fx * 0.85 + fwet * 0.2

    def norm_rms(x, target_db):
        rms = np.sqrt(np.mean(x[: int(total * SR)] ** 2) + 1e-12)
        return x * (10 ** (target_db / 20) / rms)

    m = norm_rms(m, -22.0)
    fx = norm_rms(fx, -30.0)

    # fades at film start / end
    n_total = int((total + 0.5) * SR)
    fade = np.ones(len(m))
    fade[: int(1.0 * SR)] = np.linspace(0, 1, int(1.0 * SR))
    fo = int(2.5 * SR)
    fade[n_total - fo:n_total] = np.linspace(1, 0, fo)
    fade[n_total:] = 0
    m *= fade[:, None]
    fx *= fade[:, None]

    # narration (if synthesised)
    voice = np.zeros_like(m)
    man = os.path.join(ROOT, "build", "tts", "manifest.json")
    has_voice = os.path.exists(man)
    if has_voice:
        cues = {c["key"]: c for c in tl["cues"]}
        for clip in json.load(open(man, encoding="utf-8"))["clips"]:
            c = cues.get(clip["key"])
            if not c:
                continue
            v = read_wav(os.path.join(ROOT, "build", "tts", clip["file"]))
            i = int(c["start"] * SR)
            j = min(len(voice), i + len(v))
            voice[i:j, 0] += v[: j - i]
            voice[i:j, 1] += v[: j - i]
        voice = norm_rms_active(voice, -17.5)
        # duck music under voice (smoothed envelope)
        act = np.abs(voice[:, 0])
        k = int(0.05 * SR)
        act = np.convolve(act, np.ones(k) / k, mode="same")
        gate = (act > 0.003).astype(float)
        sm = int(0.35 * SR)
        gate = np.convolve(gate, np.ones(sm) / sm, mode="same")
        duck = 1 - 0.55 * np.clip(gate, 0, 1)
        m *= duck[:, None]
        fx *= (1 - 0.3 * np.clip(gate, 0, 1))[:, None]

    mix = m + fx + voice
    peak = np.max(np.abs(mix))
    if peak > 0.97:
        mix *= 0.97 / peak
    out = mix[: int((total + 0.2) * SR)]
    write_wav(os.path.join(ROOT, "build", "mix.wav"), out)
    write_wav(os.path.join(ROOT, "build", "music.wav"), m[: len(out)])
    if has_voice:
        os.makedirs(os.path.join(ROOT, "output"), exist_ok=True)
        write_wav(os.path.join(ROOT, "output", "voiceover.wav"), voice[: len(out)])
    print(f"audio: {len(out) / SR:.2f}s, voice={'yes' if has_voice else 'no'}, peak={peak:.3f}")


def norm_rms_active(x, target_db):
    a = np.abs(x[:, 0])
    act = a > 1e-4
    rms = np.sqrt(np.mean(x[act] ** 2) + 1e-12) if act.any() else 1
    return x * (10 ** (target_db / 20) / rms)


# ------------------------------------------------------------------ SFX
def cannon():
    d = 2.2
    n = int(d * SR)
    t = np.arange(n) / SR
    body = lowpass(noise(d), 400, 2) * np.exp(-t * 3.5) * 2.0
    thump = np.sin(2 * np.pi * (38 + 40 * np.exp(-t * 10)) * t) * np.exp(-t * 2.5)
    crack = bandpass(noise(d), 1500, 5000) * np.exp(-t * 35) * 0.5
    return (body + thump + crack) * 0.5


def seal_thud():
    d = 0.6
    t = np.arange(int(d * SR)) / SR
    s = np.sin(2 * np.pi * (90 + 60 * np.exp(-t * 30)) * t) * np.exp(-t * 14)
    s += bandpass(noise(d), 800, 3000) * np.exp(-t * 60) * 0.4
    return s * 0.8


def paper_rustle(d):
    n = noise(d)
    s = bandpass(n, 1500, 7000)
    t = np.arange(len(s)) / SR
    gr = np.zeros(len(s))
    for k in range(int(d * 14)):
        c = RNG.uniform(0, d)
        gr += np.exp(-((t - c) ** 2) / (2 * 0.02 ** 2)) * RNG.uniform(0.3, 1)
    return s * gr * env(len(s), 0.05, 0.2) * 0.35


def brush_swish():
    d = 0.35
    s = bandpass(noise(d), 2000, 8000)
    t = np.arange(len(s)) / SR
    return s * np.sin(np.pi * t / d) ** 2 * 0.25


def tick():
    d = 0.05
    t = np.arange(int(d * SR)) / SR
    return (np.sin(2 * np.pi * 2400 * t) * np.exp(-t * 180) + bandpass(noise(d), 3000, 8000) * np.exp(-t * 300) * 0.4) * 0.6


# ------------------------------------------------------------------ io
def write_wav(path, x):
    x = np.clip(x, -1, 1)
    data = (x * 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(2 if x.ndim == 2 else 1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())


def read_wav(path):
    with wave.open(path, "rb") as w:
        sr = w.getframerate()
        ch = w.getnchannels()
        raw = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(np.float64) / 32768
    if ch == 2:
        raw = raw.reshape(-1, 2).mean(axis=1)
    if sr != SR:
        idx = np.arange(0, len(raw), sr / SR)
        raw = np.interp(idx, np.arange(len(raw)), raw)
    return raw


if __name__ == "__main__":
    main()
