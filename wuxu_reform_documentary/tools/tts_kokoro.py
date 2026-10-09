"""Offline neural Mandarin narration with Kokoro-82M (ONNX) + misaki zh G2P.

Each subtitle segment is synthesised as its own clip, so subtitle timing equals the
real audio timing.  Polyphonic characters / names are fixed through pypinyin phrase
overrides before G2P.

usage:
  python tools/tts_kokoro.py --check            # print pinyin of every segment for review
  python tools/tts_kokoro.py --test "文本"      # synthesise one test sentence -> build/tts/test.wav
  python tools/tts_kokoro.py                    # synthesise all segments -> build/tts/*.wav + manifest.json
env: MODEL_DIR (default ../models or /home/user/models)
"""
import argparse
import json
import os
import sys
import wave
import zipfile

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from textnorm import split_subtitle_segments, tts_text, display_sub  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_DIR = os.environ.get("MODEL_DIR") or next(
    (p for p in [os.path.join(ROOT, "models"), "/home/user/models"] if os.path.exists(p)), os.path.join(ROOT, "models"))
VOICE = os.environ.get("VOICE", "zm_yunjian")
SR_MODEL = 24000
SR_OUT = 48000

# chapter-level pacing: slower and weightier for the coup / ending
CHAPTER_SPEED = {1: 1.0, 2: 1.0, 3: 1.0, 4: 1.03, 5: 0.98, 6: 0.9, 7: 0.9}

# pinyin overrides (TONE3 with neutral tone 5) for words the dictionary may misread
PHRASES = {
    "戊戌": [["wu4"], ["xu1"]],
    "康有为": [["kang1"], ["you3"], ["wei2"]],
    "为变法": [["wei4"], ["bian4"], ["fa3"]],
    "为何": [["wei4"], ["he2"]],
    "成为": [["cheng2"], ["wei2"]],
    "改为": [["gai3"], ["wei2"]],
    "作为": [["zuo4"], ["wei2"]],
    "发展为": [["fa1"], ["zhan3"], ["wei2"]],
    "任命": [["ren4"], ["ming4"]],
    "谭嗣同": [["tan2"], ["si4"], ["tong2"]],
    "光绪": [["guang1"], ["xu4"]],
    "慈禧": [["ci2"], ["xi3"]],
    "翁同龢": [["weng1"], ["tong2"], ["he2"]],
    "荣禄": [["rong2"], ["lu4"]],
    "覆没": [["fu4"], ["mo4"]],
    "朝野": [["chao2"], ["ye3"]],
    "朝堂": [["chao2"], ["tang2"]],
    "王朝": [["wang2"], ["chao2"]],
    "天朝": [["tian1"], ["chao2"]],
    "切身": [["qie4"], ["shen1"]],
    "切于": [["qie4"], ["yu2"]],
    "冗员": [["rong3"], ["yuan2"]],
    "京畿": [["jing1"], ["ji1"]],
    "公车": [["gong1"], ["che1"]],
    "会试": [["hui4"], ["shi4"]],
    "乡试": [["xiang1"], ["shi4"]],
    "强租": [["qiang2"], ["zu1"]],
    "强占": [["qiang2"], ["zhan4"]],
    "主笔": [["zhu3"], ["bi3"]],
    "横刀": [["heng2"], ["dao1"]],
    "肝胆": [["gan1"], ["dan3"]],
    "昆仑": [["kun1"], ["lun2"]],
    "题壁": [["ti2"], ["bi4"]],
    "瀛台": [["ying2"], ["tai2"]],
    "训政": [["xun4"], ["zheng4"]],
    "督抚": [["du1"], ["fu3"]],
    "堂官": [["tang2"], ["guan1"]],
    "章京": [["zhang1"], ["jing1"]],
    "开缺": [["kai1"], ["que1"]],
    "回籍": [["hui2"], ["ji2"]],
    "种子": [["zhong3"], ["zi5"]],
    "泱泱": [["yang1"], ["yang1"]],
    "参与": [["can1"], ["yu4"]],
    "名教": [["ming2"], ["jiao4"]],
    "纲常": [["gang1"], ["chang2"]],
    "束缚": [["shu4"], ["fu4"]],
    "史称": [["shi3"], ["cheng1"]],
    "帝后": [["di4"], ["hou4"]],
    "重新": [["chong2"], ["xin1"]],
    "得以": [["de2"], ["yi3"]],
    "执行": [["zhi2"], ["xing2"]],
    "推行": [["tui1"], ["xing2"]],
    "行政": [["xing2"], ["zheng4"]],
    "几项": [["ji3"], ["xiang4"]],
    "少数": [["shao3"], ["shu4"]],
    "记述": [["ji4"], ["shu4"]],
    "阻挠": [["zu3"], ["nao2"]],
    "菜市口": [["cai4"], ["shi4"], ["kou3"]],
    "梁启超": [["liang2"], ["qi3"], ["chao1"]],
    "严复": [["yan2"], ["fu4"]],
    "裁汰": [["cai2"], ["tai4"]],
    "裁撤": [["cai2"], ["che4"]],
    "詹事府": [["zhan1"], ["shi4"], ["fu3"]],
    "通政司": [["tong1"], ["zheng4"], ["si1"]],
    "洋操": [["yang2"], ["cao1"]],
    "胶州湾": [["jiao1"], ["zhou1"], ["wan1"]],
    "势力": [["shi4"], ["li4"]],
    "了序幕": [["le5"], ["xu4"], ["mu4"]],
    "传遍": [["chuan2"], ["bian4"]],
    "只持续": [["zhi3"], ["chi2"], ["xu4"]],
    "孔子": [["kong3"], ["zi3"]],
    "一场": [["yi4"], ["chang3"]],
}


def setup_g2p():
    import jieba
    from pypinyin import load_phrases_dict
    jieba.setLogLevel(60)
    load_phrases_dict({k: v for k, v in PHRASES.items()})
    for w in PHRASES:
        jieba.add_word(w, freq=200000)
    from misaki import zh
    return zh.ZHG2P()


def check():
    from pypinyin import lazy_pinyin, Style
    import jieba
    setup_g2p()
    script = json.load(open(os.path.join(ROOT, "script", "script.json"), encoding="utf-8"))
    for s in script["scenes"]:
        for line in s["lines"]:
            for seg in split_subtitle_segments(line):
                t = tts_text(seg)
                words = jieba.lcut(t)
                py = " ".join("".join(lazy_pinyin(w, style=Style.TONE3, neutral_tone_with_five=True)) for w in words if w.strip())
                print(f"{t}\n    {py}")


class Kokoro:
    def __init__(self, voice=VOICE):
        import onnxruntime as ort
        cfg = json.load(open(os.path.join(MODEL_DIR, "kokoro_config.json"), encoding="utf-8"))
        self.vocab = cfg["vocab"]
        so = ort.SessionOptions()
        so.intra_op_num_threads = int(os.environ.get("TTS_THREADS", "4"))
        self.sess = ort.InferenceSession(os.path.join(MODEL_DIR, "kokoro-v1.0-fp32.onnx"), so, providers=["CPUExecutionProvider"])
        z = zipfile.ZipFile(os.path.join(MODEL_DIR, f"{voice}.pt"))
        data = z.read([n for n in z.namelist() if n.endswith("data/0")][0])
        self.voice = np.frombuffer(data, dtype=np.float32).reshape(-1, 1, 256)
        self.g2p = setup_g2p()

    def phonemes(self, text):
        ph = self.g2p(text)
        return ph[0] if isinstance(ph, tuple) else ph

    def synth(self, text, speed=1.0):
        ph = self.phonemes(text)
        ids = [self.vocab[p] for p in ph if p in self.vocab][:508]
        style = self.voice[len(ids)]
        out = self.sess.run(None, {"input_ids": np.array([[0, *ids, 0]], dtype=np.int64), "style": style.astype(np.float32), "speed": np.array([speed], dtype=np.float32)})[0]
        return np.asarray(out).reshape(-1), ph


def post(wav):
    """trim silence, resample 24k->48k, short fades, normalise peak."""
    from scipy.signal import resample_poly
    a = np.abs(wav)
    thr = max(0.008, a.max() * 0.02)
    idx = np.where(a > thr)[0]
    if len(idx):
        s = max(0, idx[0] - int(0.03 * SR_MODEL))
        e = min(len(wav), idx[-1] + int(0.08 * SR_MODEL))
        wav = wav[s:e]
    y = resample_poly(wav, 2, 1)
    n = len(y)
    f = int(0.01 * SR_OUT)
    if n > 2 * f:
        y[:f] *= np.linspace(0, 1, f)
        y[-f * 3:] *= np.linspace(1, 0, f * 3)
    y = y / (np.max(np.abs(y)) + 1e-9) * 0.89
    return y


def write_wav(path, y):
    data = (np.clip(y, -1, 1) * 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR_OUT)
        w.writeframes(data.tobytes())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--test")
    ap.add_argument("--speed", type=float, default=1.0)
    a = ap.parse_args()
    if a.check:
        check()
        return
    out_dir = os.path.join(ROOT, "build", "tts")
    os.makedirs(out_dir, exist_ok=True)
    k = Kokoro()
    if a.test:
        wav, ph = k.synth(tts_text(a.test), a.speed)
        y = post(wav)
        write_wav(os.path.join(out_dir, "test.wav"), y)
        print(ph, f"{len(y) / SR_OUT:.2f}s")
        return
    script = json.load(open(os.path.join(ROOT, "script", "script.json"), encoding="utf-8"))
    clips = []
    idx = 0
    for s in script["scenes"]:
        sp = CHAPTER_SPEED.get(s["chapter"], 1.0) * a.speed
        for line in s["lines"]:
            for seg in split_subtitle_segments(line):
                key = f"{idx:03d}"
                text = tts_text(seg)
                wav, ph = k.synth(text, sp)
                y = post(wav)
                fn = f"seg_{key}.wav"
                write_wav(os.path.join(out_dir, fn), y)
                clips.append({"key": key, "file": fn, "text": display_sub(seg), "tts": text, "phonemes": ph, "dur": round(len(y) / SR_OUT, 3), "speed": sp})
                print(f"{key} {len(y) / SR_OUT:5.2f}s  {text}")
                idx += 1
    json.dump({"voice": VOICE, "model": "Kokoro-82M v1.0 (ONNX fp32)", "clips": clips}, open(os.path.join(out_dir, "manifest.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    tot = sum(c["dur"] for c in clips)
    print(f"{len(clips)} clips, speech total {tot:.1f}s")


if __name__ == "__main__":
    main()
