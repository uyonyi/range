# 무전 음성 묶음 (radio_voice.bin / radio_voice.json)

CONTROL(남)·EAGLE ONE(여) 영어 무전을 미리 읽어 둔 조각입니다. 게임은 말할 문장을 가장 긴 조각부터 맞춰 이어 붙여 재생합니다 (`game5.js` 의 `rvPlan`).
조각이 없는 말이 섞이면 기기 음성(Web Speech)이나 내장 합성기로 대신 읽습니다.

- 음성 모델: [Kokoro-82M](https://github.com/thewh1teagle/kokoro-onnx) (Apache-2.0) · 목소리 `am_michael`(CONTROL) · `af_heart`(EAGLE ONE)
- 모델 파일: kokoro-onnx 릴리스의 `kokoro-v1.0.int8.onnx`, `voices-v1.0.bin`

## 다시 만들기 (무전 문장을 바꾸거나 더했을 때)

```bash
pip install kokoro-onnx soundfile          # ffmpeg 도 필요
cd sim/src
python3 tools/voice/phrases.py . tools/voice/labels.json > /tmp/phrases.json   # 소스의 comm(...) 문장 + 코스 과제 이름 + 숫자·음성 문자
python3 tools/voice/gen.py /tmp/phrases.json <kokoro 모델 폴더> /tmp/rv        # → /tmp/rv/radio_voice.bin · .json (같은 문장은 캐시에서)
cp /tmp/rv/radio_voice.* .
```

- `labels.json`: 코스 과제 이름 안내("Next, Window Gate 1." 등). `labels.js` 로 페이지에서 뽑습니다.
- 한국어 무전은 묶음을 쓰지 않고, 설정에서 "한국어"를 고르면 기기의 한국어 음성이 자막을 읽습니다.
