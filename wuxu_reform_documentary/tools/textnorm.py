"""Shared text helpers: subtitle segmentation and TTS-reading normalisation.

Display text keeps Arabic numerals (e.g. "1898年"), while the TTS text spells
them out the way a Mandarin narrator reads them ("一八九八年", "一百零三天").
"""
import re

DIGITS = "零一二三四五六七八九"

# Words whose default pinyin from the G2P dictionary may be wrong; mapped to an
# unambiguous spelling that only changes pronunciation, not meaning (TTS only).
TTS_REPLACE = [
    ("——", "，"),
    ("—", "，"),
]

STRONG = "。？！"
WEAK = "，、；："
QUOTES = "“”‘’《》「」『』\"'"


def int_to_cn(n: int) -> str:
    """Integer (0..9999) to Chinese reading, e.g. 103 -> 一百零三, 11 -> 十一."""
    if n == 0:
        return "零"
    units = [(1000, "千"), (100, "百"), (10, "十")]
    out = ""
    rest = n
    zero_pending = False
    for val, name in units:
        d = rest // val
        rest %= val
        if d:
            if zero_pending:
                out += "零"
                zero_pending = False
            if not (val == 10 and d == 1 and out == ""):
                out += DIGITS[d]
            out += name
        elif out:
            zero_pending = True
    if rest:
        if zero_pending:
            out += "零"
        out += DIGITS[rest]
    return out


def tts_text(text: str) -> str:
    """Convert display text into the text actually sent to the TTS engine."""
    s = text
    for a, b in TTS_REPLACE:
        s = s.replace(a, b)
    # years: 1898年 -> 一八九八年
    s = re.sub(r"(\d{4})(?=年)", lambda m: "".join(DIGITS[int(c)] for c in m.group(1)), s)
    # remaining integers: 103 -> 一百零三, 6月11日 -> 六月十一日
    s = re.sub(r"\d+", lambda m: int_to_cn(int(m.group(0))), s)
    for q in QUOTES:
        s = s.replace(q, "")
    return s


def syllables(text: str) -> int:
    """Number of spoken syllables (Han characters after normalisation)."""
    return len(re.findall(r"[一-鿿]", tts_text(text)))


def split_subtitle_segments(line: str, max_len: int = 24, min_len: int = 7):
    """Split a narration line into subtitle-sized segments at punctuation.

    Each segment is shown as one subtitle event (one screen line where possible)
    and is also synthesised as one TTS clip, so subtitle timing is exact.
    Splits happen after ，；：。？！ and before a dash; never at 、.
    """
    pieces = []
    buf = ""
    i = 0
    while i < len(line):
        ch = line[i]
        if line.startswith("——", i) and buf:
            pieces.append(buf)
            buf = ""
        buf += ch
        if ch in STRONG + "，；：":
            # keep closing quotes with the clause they close
            while i + 1 < len(line) and line[i + 1] in "”’》」』":
                i += 1
                buf += line[i]
            pieces.append(buf)
            buf = ""
        i += 1
    if buf:
        if pieces and all(c in QUOTES for c in buf):
            pieces[-1] += buf
        else:
            pieces.append(buf)

    segs = []
    cur = ""
    for p in pieces:
        if not cur:
            cur = p
        elif (vis_len(cur) < min_len or vis_len(p) < min_len) and vis_len(cur) + vis_len(p) <= max_len:
            cur += p
        else:
            segs.append(cur)
            cur = p
    if cur:
        segs.append(cur)
    return segs


def vis_len(s: str) -> int:
    return len([c for c in s if c not in QUOTES and c not in STRONG + WEAK + "—"])


def display_sub(seg: str) -> str:
    """Subtitle display text: drop trailing comma-type punctuation, keep ？！ and quotes."""
    s = seg.strip()
    while s and s[-1] in "，、；：。":
        s = s[:-1]
    return s


if __name__ == "__main__":
    for t in ["1894年，中日甲午战争爆发。", "为何只持续了103天？", "1898年6月11日，光绪帝颁布《明定国是诏》，宣布变法。",
              "需要强调的是，这并不是废除科举——科举制度直到1905年才被正式废止。"]:
        print(t, "->", tts_text(t), syllables(t), split_subtitle_segments(t))
