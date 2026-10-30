#!/bin/sh
# 인트로 영상 합치기: render.js 가 만든 장면 프레임(fr/s1~s6, 24fps · 1280x720) → 0.25초 교차 전환 →
#   intro.mp4 (H.264) · intro.webm (VP9) — 720p · 빠른 망용
#   intro_lo.mp4 · intro_lo.webm — 480p 가벼운 판 (느린 망·데이터 절약)
#   intro_k2~k5.webp — 장면 2~5 사진 (영상이 아직 안 왔을 때 사진 + 움직임으로 바로 시작 · 1·6 장면은 intro.jpg · intro_end.jpg 를 씀)
#   intro.jpg (첫 장면) · intro_end.jpg (마지막 장면) · music.wav 가 있으면 intro.mp3
#   모든 영상은 2초마다 키프레임 (-g 48): 사진으로 시작한 뒤 도착한 영상을 중간 시점으로 바로 이어 붙일 수 있게
# 사용: sh compose.sh <프레임 폴더(fr 의 부모)> <출력 폴더>
set -e
D=${1:-.}; O=${2:-.}
X=0.25   # 장면 사이 교차 시간 (초)
G="eq=contrast=1.04:saturation=1.1:brightness=0.015,vignette=PI/9"   # 색 보정 (영상·포스터 같게)
SHOTS=$(ls -d "$D"/fr/s* | xargs -n1 basename | sort)
N=$(echo "$SHOTS" | wc -l)
IN=""; FC=""; i=0; off=0; prev=""
for s in $SHOTS; do
  IN="$IN -framerate 24 -i $D/fr/$s/%04d.jpg"
  L=$(echo "scale=4; $(ls "$D/fr/$s" | wc -l) / 24" | bc)
  if [ $i -gt 0 ]; then
    cur="x$i"; [ $i -eq $((N-1)) ] && cur="v0"
    FC="$FC[$prev][$i]xfade=transition=fade:duration=$X:offset=$off[$cur];"
    prev=$cur
  else prev=0; fi
  off=$(echo "$off + $L - $X" | bc)
  i=$((i+1))
done
M="$O/_master.mkv"
ffmpeg -y -hide_banner -loglevel error $IN -filter_complex "${FC}[v0]$G,format=yuv420p[v]" -map "[v]" -an -c:v libx264 -preset veryfast -crf 10 "$M"
# H.264: High 3.1 (720p24) · 2패스 1.9 Mbps (숲이 많아 crf 로는 10 MB 가 넘음) · 모든 브라우저(사파리 포함)가 트는 형식
h264() {   # $1 출력 · $2 크기 필터 · $3 목표 비트레이트 · $4 최대 · $5 버퍼 · $6 프로필 · $7 레벨
  H="-an -vf $2 -c:v libx264 -preset slow -b:v $3 -maxrate $4 -bufsize $5 -profile:v $6 -level $7 -g 48 -keyint_min 24 -pix_fmt yuv420p"
  ffmpeg -y -hide_banner -loglevel error -i "$M" $H -pass 1 -passlogfile "$O/_h264" -f mp4 /dev/null
  ffmpeg -y -hide_banner -loglevel error -i "$M" $H -pass 2 -passlogfile "$O/_h264" -movflags +faststart "$1"
  rm -f "$O"/_h264*
}
vp9() {   # $1 출력 · $2 크기 필터 · $3 목표 비트레이트 (2패스)
  V="-an -vf $2 -c:v libvpx-vp9 -b:v $3 -g 48 -deadline good -cpu-used 2 -row-mt 1 -pix_fmt yuv420p"
  ffmpeg -y -hide_banner -loglevel error -i "$M" $V -pass 1 -passlogfile "$O/_vp9" -f webm /dev/null
  ffmpeg -y -hide_banner -loglevel error -i "$M" $V -pass 2 -passlogfile "$O/_vp9" "$1"
  rm -f "$O"/_vp9*
}
# 720p: H.264 High 3.1 · 2패스 1.9 Mbps (숲이 많아 crf 로는 10 MB 가 넘음) · 모든 브라우저(사파리 포함)가 트는 형식 · VP9 1.8 Mbps
h264 "$O/intro.mp4" null 1900k 2800k 4500k high 3.1
vp9 "$O/intro.webm" null 1800k
# 480p 가벼운 판: H.264 Main 3.0 0.42 Mbps · VP9 0.38 Mbps (각 0.6~0.7 MB)
h264 "$O/intro_lo.mp4" scale=854:480:flags=lanczos 420k 650k 900k main 3.0
vp9 "$O/intro_lo.webm" scale=854:480:flags=lanczos 380k
# 장면 2~5 사진 (960x540 WebP): 각 장면이 시작하고 0.35초 뒤 (교차가 끝난 그림)
k=2; for t in 2.27 3.68 5.6 7.02; do
  ffmpeg -y -hide_banner -loglevel error -ss $t -i "$M" -frames:v 1 -vf scale=960:540:flags=lanczos -c:v libwebp -quality 70 -compression_level 6 "$O/intro_k$k.webp"; k=$((k+1))
done
ffmpeg -y -hide_banner -loglevel error -i "$D/fr/s1/0000.jpg" -vf "$G" -q:v 6 "$O/intro.jpg"
ffmpeg -y -hide_banner -loglevel error -sseof -0.08 -i "$M" -frames:v 1 -q:v 5 "$O/intro_end.jpg"   # 마지막 장면 (로고 화면 바탕 · 건너뛰어도 같은 그림)
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$M")
rm -f "$M"
# 음악 (music.js 가 그린 music.wav): 최고 크기를 −1.5 dBFS 로 맞추고 영상 길이 + 0.4초에서 자름 → intro.mp3
if [ -f "$D/music.wav" ]; then
  PK=$(ffmpeg -hide_banner -i "$D/music.wav" -af volumedetect -f null - 2>&1 | sed -n 's/.*max_volume: \(-*[0-9.]*\) dB.*/\1/p')
  T=$(echo "$DUR + 0.4" | bc); FO=$(echo "$T - 0.5" | bc)
  ffmpeg -y -hide_banner -loglevel error -i "$D/music.wav" -af "volume=$(echo "-1.5 - ($PK)" | bc)dB,afade=t=in:d=0.02,afade=t=out:st=$FO:d=0.5" -t "$T" -c:a libmp3lame -b:a 128k -ar 44100 "$O/intro.mp3"
  ls -l "$O/intro.mp3"
fi
echo "video ${DUR}s"; ls -l "$O"/intro.mp4 "$O"/intro.webm "$O"/intro_lo.mp4 "$O"/intro_lo.webm "$O"/intro_k*.webp "$O"/intro.jpg "$O"/intro_end.jpg
