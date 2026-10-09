# 《戊戌变法——改变中国的103天》

一部约5分钟的中文历史纪录短片，供大学历史课程课堂展示。全片由代码生成：动态地图、毛笔逐笔书写、三维紫禁城与清末城市场景、信息图表、程序化配乐与音效，再用 FFmpeg 合成为 1920×1080 / 30fps / H.264 + AAC 的 MP4，内嵌简体中文字幕。

制作：hqy

> 本目录独立于仓库中的其他项目（自动钓鱼脚本），互不依赖。

## 交付文件（`output/`）

| 文件 | 说明 |
|---|---|
| `wuxu_reform.mp4` | 成片（1920×1080，30fps，H.264 + AAC，内嵌中文字幕） |
| `narration.txt` | 完整中文解说词（带时间码） |
| `subtitles.srt` | 与配音时间轴同步的独立字幕 |
| `voiceover.wav` | 完整中文配音（合成后生成） |
| `sources.md` | 历史参考资料、史实核对表、素材来源与许可 |

## 片子结构

| 章节 | 内容 |
|---|---|
| 第一章 山河危局 | 甲午战争动态地图 → 《马关条约》 → 悬念：“为何只持续了103天？” → 片名 |
| 第二章 救亡图存 | 老北京（老照片“活化”）→ 列强势力范围图 → “救亡图存” → 公车上书（附史学辨析）→ 报刊与学会网络 |
| 第三章 维新登场 | 康有为、梁启超、谭嗣同、光绪帝 → 三维紫禁城 → 《明定国是诏》节录 → 百日时间轴 |
| 第四章 百日新政 | 诏令 → 政治 / 教育（废八股 ≠ 废科举）/ 三维京师大学堂 / 经济 / 军事 |
| 第五章 风暴将至 | 地方观望、利益受损、执行乏力 → 权力结构图 → 夜色中的宫廷长街 |
| 第六章 戊戌政变 | 9月21日 → 三维瀛台 → 流亡路线 → 戊戌六君子 → 狱中题壁 → 新政废止 |
| 第七章 历史回响 | 老照片过渡到当代城市 → 历史影响 → 结语 → 片尾参考资料 |

## 技术路线

```
script/script.json ──► tools/build_timeline.py ──► build/timeline.json + web/timeline.js
     (解说词)              (以真实配音时长或估算语速排定每个镜头、每条字幕)
                                   │
   web/  (Canvas2D + Three.js，所有动画是绝对时间的纯函数)
     ├─ js/engine.js / textures.js / brush.js / mapkit.js / fx.js / ui.js
     ├─ js/three/common.js（渲染器、后期：调色/景深/泛光/暗角）、arch.js（程序化古建）、scenes3d.js
     └─ js/scenes/ch1.js … ch7.js（31 个镜头）
                                   │
   render/render.mjs ── Playwright 多进程逐帧渲染 → 每 5 秒一段直接流式送入 FFmpeg（可断点续渲）
   tools/make_subs.py ── SRT + ASS（libass 烧录）
   tools/make_audio.py ── 程序化配乐 + 音效 + （配音与自动闪避）混音
   tools/mux.py ── 拼接分段 + 烧录字幕 + 混音 → output/wuxu_reform.mp4
```

- **确定性渲染**：任意一帧都能独立渲染（`window.renderFrame(frame)`），所以可以分段、并行、失败重试，不需要把整部视频放进内存。
- **毛笔逐笔书写**：基于 Make Me a Hanzi 的笔画轮廓和中线数据，按真实笔顺逐笔揭示，并叠加墨色纹理和晕染。
- **透视地图**：Natural Earth 1:50m 海岸线投影到 Mercator 平面，再用三维相机做透视（倾斜、推拉），线条在任何缩放下都保持清晰。
- **三维古建**：参数化生成庑殿顶、歇山顶、硬山顶（带举折曲线和翼角起翘）、斗拱带、彩画梁枋、菱花槅扇、须弥座与栏杆。
- **字幕时间轴**：每条字幕对应一段单独合成的配音，起止时间直接取自真实音频时长。

## 运行环境

- Node.js ≥ 18、Python ≥ 3.10、FFmpeg（需要 libx264、libass）
- Chromium（Playwright 自带或系统已安装的版本均可；用 `PLAYWRIGHT_BROWSERS_PATH` 或 `executablePath` 指定）
- 渲染约需 1 小时（4 核 CPU，用 SwiftShader 软件渲染 WebGL）

## 运行步骤

```bash
cd wuxu_reform_documentary
npm install                      # three, d3-geo, world-atlas, hanzi-writer-data, playwright-core, echarts@4 …
bash tools/fetch_assets.sh       # 字体（OFL）+ Kokoro TTS 模型与音色（Apache-2.0）
python3 -m venv .venv && .venv/bin/pip install numpy scipy onnxruntime "misaki[zh]" fonttools

node tools/prepare_assets.mjs              # 地图数据、毛笔笔画数据
.venv/bin/python tools/tts_kokoro.py --check   # 检查多音字拼音
.venv/bin/python tools/tts_kokoro.py           # 逐句合成中文配音 → build/tts/
python3 tools/build_timeline.py            # 依据真实配音时长生成时间轴
.venv/bin/python tools/make_subfont.py     # 字幕用静态字重字体
python3 tools/make_subs.py                 # SRT + ASS
.venv/bin/python tools/make_audio.py       # 配乐 + 音效 + 配音混音 → build/mix.wav、output/voiceover.wav
node render/render.mjs --workers 3         # 逐帧渲染（可中断后重跑，已完成的分段会跳过）
python3 tools/mux.py --bitrate 2250k --maxrate 6M   # 两遍编码合成 output/wuxu_reform.mp4（约 93 MB，低于 GitHub 单文件 100 MB 上限）
python3 tools/export_narration.py          # output/narration.txt
```

调试工具：

```bash
node render/stills.mjs /tmp/stills S12@3 S17@50%   # 渲染指定镜头某一时刻的静帧
node render/debug3d.mjs /tmp/d3 Palace@4 Yingtai@6  # 单独查看三维场景
node render/render.mjs --from 115 --to 125 --out build/test_chunks   # 10 秒测试片段
python3 tools/mux.py --from 115 --to 125 --chunks build/test_chunks --out output/test_clip_10s.mp4
```

## 关于画面真实性的说明

片中宫殿、城市、人物剪影等画面都是**程序化生成的艺术重现**，不是历史照片或现场影像，画面上标注了“艺术重现 · 非历史影像”和“人物剪影为示意，非肖像”。地图是示意图，省界采用今日轮廓。详见 `output/sources.md`。
