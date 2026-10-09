#!/usr/bin/env bash
# Download the large third-party assets that are not committed to git:
#   - Chinese fonts (SIL OFL, google/fonts repository)
#   - Kokoro-82M v1.0 ONNX weights (Apache-2.0, published on npm as shards)
#   - Kokoro Chinese male voice style vectors (from the Kokoro-FastAPI repository)
set -euo pipefail
cd "$(dirname "$0")/.."

FONT_DIR=web/assets/fonts
mkdir -p "$FONT_DIR"
B=https://raw.githubusercontent.com/google/fonts/main/ofl
fetch_font() { # path-in-repo local-name
  [ -s "$FONT_DIR/$2" ] || curl -fsSL --retry 3 -o "$FONT_DIR/$2" "$B/$1"
}
fetch_font "mashanzheng/MaShanZheng-Regular.ttf" "MaShanZheng-Regular.ttf"
fetch_font "zhimangxing/ZhiMangXing-Regular.ttf" "ZhiMangXing-Regular.ttf"
fetch_font "liujianmaocao/LiuJianMaoCao-Regular.ttf" "LiuJianMaoCao-Regular.ttf"
fetch_font "notoserifsc/NotoSerifSC%5Bwght%5D.ttf" "NotoSerifSC[wght].ttf"
fetch_font "notosanssc/NotoSansSC%5Bwght%5D.ttf" "NotoSansSC[wght].ttf"
fetch_font "lxgwwenkaitc/LXGWWenKaiTC-Regular.ttf" "LXGWWenKaiTC-Regular.ttf"
fetch_font "notoseriftc/NotoSerifTC%5Bwght%5D.ttf" "NotoSerifTC[wght].ttf"
echo "fonts ok"

MODEL_DIR=${MODEL_DIR:-models}
mkdir -p "$MODEL_DIR"
if [ ! -s "$MODEL_DIR/kokoro-v1.0-fp32.onnx" ]; then
  for p in kokoro-fp32a-shards kokoro-fp32b-shards kokoro-fp32c-shards; do
    curl -fsSL --retry 3 -o "$MODEL_DIR/$p.tgz" "https://registry.npmjs.org/$p/-/$p-1.0.0.tgz"
    mkdir -p "$MODEL_DIR/$p" && tar xzf "$MODEL_DIR/$p.tgz" -C "$MODEL_DIR/$p"
  done
  (for i in $(seq 0 18); do cat "$MODEL_DIR"/kokoro-fp32*/package/kokoro-fp32.part$i.bin; done) > "$MODEL_DIR/kokoro-v1.0-fp32.onnx"
  echo "8fbea51ea711f2af382e88c833d9e288c6dc82ce5e98421ea61c058ce21a34cb  $MODEL_DIR/kokoro-v1.0-fp32.onnx" | sha256sum -c -
fi
for v in zm_yunjian zm_yunxi; do
  [ -s "$MODEL_DIR/$v.pt" ] || curl -fsSL --retry 3 -o "$MODEL_DIR/$v.pt" "https://raw.githubusercontent.com/remsky/Kokoro-FastAPI/master/api/src/voices/v1_0/$v.pt"
done
[ -s "$MODEL_DIR/kokoro_config.json" ] || {
  python3 -m pip download -q --no-deps kokoro-onnx==0.6.1 -d "$MODEL_DIR/_whl"
  python3 -c "import zipfile,glob,sys; z=zipfile.ZipFile(glob.glob('$MODEL_DIR/_whl/*.whl')[0]); open('$MODEL_DIR/kokoro_config.json','wb').write(z.read('kokoro_onnx/config.json'))"
}
echo "models ok"
