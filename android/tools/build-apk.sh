#!/usr/bin/env bash
# =============================================================================
# 手工打 APK：不需要 Gradle，也不需要 Android Studio。
# 只要有 JDK 17+ 和 Android SDK 的 build-tools + platform 两个包就能出包。
# 整个工程零第三方依赖，所以也没有 AAR 要下载。
#
#   bash tools/build-apk.sh
#
# 产物：build/lucky-wheel.apk
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SDK="${ANDROID_HOME:-/d/Tools/android-sdk}"
BT="${BUILD_TOOLS:-$SDK/build-tools/34.0.0}"
PLATFORM="$SDK/platforms/android-34/android.jar"
WEB="$ROOT/../web"

OUT="$ROOT/build"
RES="$ROOT/app/src/main/res"
MANIFEST="$ROOT/app/src/main/AndroidManifest.xml"
JAVA_SRC="$ROOT/app/src/main/java"

MIN_SDK=26
TARGET_SDK=34

step() { printf "\n\033[1;35m▸ %s\033[0m\n" "$1"; }

for tool in "$BT/aapt2.exe" "$BT/zipalign.exe" "$BT/apksigner.bat"; do
  [ -f "$tool" ] || { echo "缺少 $tool，请先装 Android SDK build-tools 34.0.0"; exit 1; }
done
[ -f "$PLATFORM" ] || { echo "缺少 android.jar：$PLATFORM"; exit 1; }

rm -rf "$OUT"
mkdir -p "$OUT/compiled" "$OUT/gen" "$OUT/classes" "$OUT/dex" "$OUT/assets/www"

# ── 1. 同步网页源码（只维护 ../web 一份）────────────────────────────────────
step "同步网页资源"
shopt -s globstar nullglob
for f in "$WEB"/**/*; do
  [ -f "$f" ] || continue
  case "$f" in
    */preview*.png|*/README.md|*/test/*|*/_*) continue ;;
  esac
  rel="${f#$WEB/}"
  mkdir -p "$(dirname "$OUT/assets/www/$rel")"
  cp "$f" "$OUT/assets/www/$rel"
done
echo "  $(find "$OUT/assets/www" -type f | wc -l) 个文件"

# ── 2. 编译资源 ─────────────────────────────────────────────────────────────
step "aapt2 compile"
"$BT/aapt2.exe" compile --dir "$RES" -o "$OUT/compiled/res.zip"

# ── 3. 链接资源 + 清单 + assets ─────────────────────────────────────────────
step "aapt2 link"
"$BT/aapt2.exe" link \
  -o "$OUT/base.apk" \
  -I "$PLATFORM" \
  --manifest "$MANIFEST" \
  --java "$OUT/gen" \
  --min-sdk-version "$MIN_SDK" \
  --target-sdk-version "$TARGET_SDK" \
  "$OUT/compiled/res.zip"

# ── 4. 编译 Java ────────────────────────────────────────────────────────────
# 注意：javac 是原生 Windows 程序，参数里的 /d/... 会被 msys 转成 D:\...，
# 但写进 @sources.txt 的内容不会。所以这里切到项目根目录，一律用相对路径。
step "javac"
cd "$ROOT"
find app/src/main/java build/gen -name '*.java' > build/sources.txt
# 用 8 作为字节码目标：build-tools 34 里的 d8 对更高版本 class 文件里
# 某些属性解析有 bug（匿名内部类会直接 NPE），降到 52.0 最稳。
javac -encoding UTF-8 -source 8 -target 8 -nowarn \
  -classpath "$PLATFORM" -d build/classes @"build/sources.txt"
echo "  $(wc -l < build/sources.txt) 个源文件"

# ── 5. 转 dex ───────────────────────────────────────────────────────────────
step "d8"
"$BT/d8.bat" --lib "$PLATFORM" --min-api "$MIN_SDK" \
  --output "$OUT/dex" $(find build/classes -name '*.class')

# ── 6. 打 assets 和 classes.dex ─────────────────────────────────────────────
# 不能用 aapt2 的 -A，也不能用 PowerShell 的 ZipArchive：
# 两者在 Windows 上都会把条目名里的 "/" 写成 "\"，而 AssetManager 只认正斜杠 ——
# 结果是 APK 能装能启动、但所有 assets 读不到，网页直接 404。
step "打包 assets + classes.dex"
java "$ROOT/tools/PackAssets.java" "$OUT/base.apk" "$OUT/assets" "$OUT/dex/classes.dex" \
  || { echo "打包 assets 失败"; exit 1; }

# ── 7. 对齐（签名前必须做）──────────────────────────────────────────────────
step "zipalign"
"$BT/zipalign.exe" -f -p 4 "$OUT/base.apk" "$OUT/aligned.apk"

# ── 8. 签名：第一次跑会自动生成一个本地调试证书 ─────────────────────────────
step "apksigner"
# 证书放在 build/ 外面：build 每次都会清空，钥匙必须活得比它久，
# 否则每出一版都是新签名，手机上装不上去（只能先卸载再装）。
KEYSTORE="$ROOT/keystore/lucky-wheel.keystore"
mkdir -p "$ROOT/keystore"
if [ ! -f "$KEYSTORE" ]; then
  keytool -genkeypair -v \
    -keystore "$KEYSTORE" -storepass luckywheel -keypass luckywheel \
    -alias luckywheel -keyalg RSA -keysize 2048 -validity 10000 \
    -dname "CN=Lucky Wheel, OU=Home, O=LittleCodeSauce, C=CN" > /dev/null 2>&1
  echo "  已生成本地签名证书 keystore/lucky-wheel.keystore"
fi

"$BT/apksigner.bat" sign \
  --ks "$KEYSTORE" --ks-pass pass:luckywheel --key-pass pass:luckywheel \
  --ks-key-alias luckywheel \
  --out "$OUT/lucky-wheel.apk" "$OUT/aligned.apk"

"$BT/apksigner.bat" verify --print-certs "$OUT/lucky-wheel.apk" | head -4

step "完成"
ls -lh "$OUT/lucky-wheel.apk"
