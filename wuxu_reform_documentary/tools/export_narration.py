"""Write output/narration.txt (full narration grouped by chapter, with timecodes)."""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def tc(t):
    m, s = divmod(t, 60)
    return f"{int(m):02d}:{s:04.1f}"


def main():
    script = json.load(open(os.path.join(ROOT, "script", "script.json"), encoding="utf-8"))
    tl = json.load(open(os.path.join(ROOT, "build", "timeline.json"), encoding="utf-8"))
    starts = {s["id"]: s for s in tl["scenes"]}
    out = [f"《{script['title']}》 中文解说词", f"制作：{script['producer']}", ""]
    total_chars = 0
    for ch in script["chapters"]:
        scenes = [s for s in script["scenes"] if s["chapter"] == ch["id"]]
        st = starts[scenes[0]["id"]]["start"]
        out.append(f"【{ch['name']} · {ch['title']}】（{tc(st)} 起）")
        for s in scenes:
            for line in s["lines"]:
                cues = [c for c in starts[s["id"]]["cues"] if c["line"] == s["lines"].index(line)]
                t0 = starts[s["id"]]["start"] + (cues[0]["start"] if cues else 0)
                out.append(f"  [{tc(t0)}] {line}")
                total_chars += len([c for c in line if "一" <= c <= "鿿" or c.isdigit()])
        out.append("")
    out.append(f"（解说词约 {total_chars} 字；时间码依据{'实际合成配音' if tl['audio'] == 'measured' else '估算语速'}计算，全片 {tl['total']:.1f} 秒）")
    os.makedirs(os.path.join(ROOT, "output"), exist_ok=True)
    open(os.path.join(ROOT, "output", "narration.txt"), "w", encoding="utf-8").write("\n".join(out) + "\n")
    print("\n".join(out[-2:]))


if __name__ == "__main__":
    main()
