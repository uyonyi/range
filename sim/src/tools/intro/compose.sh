#!/bin/sh
# 인트로 영상 합치기: render.js 가 만든 장면 프레임(fr/s1~s4, 24fps) → 짧은 교차 전환 → intro.mp4 (H.264) · intro.webm (VP9, H.264 를 못 트는 브라우저용) · intro.jpg (첫 프레임 = 영상 시작 화면과 같게) · music.wav 가 있으면 intro.mp3
# 사용: sh compose.sh <프레임 폴더(fr 의 부모)> <출력 폴더>
set -e
D=${1:-.}; O=${2:-.}
X=0.25   # 장면 사이 교차 시간 (초)
G="eq=contrast=1.04:saturation=1.1:brightness=0.015,vignette=PI/9"   # 색 보정 (영상·포스터 같게)
len() { echo "scale=4; $(ls "$D/fr/$1" | wc -l) / 24" | bc; }
L1=$(len s1); L2=$(len s2); L3=$(len s3)
o1=$(echo "$L1 - $X" | bc); o2=$(echo "$o1 + $L2 - $X" | bc); o3=$(echo "$o2 + $L3 - $X" | bc)
M="$O/_master.mkv"
ffmpeg -y -hide_banner -loglevel error \
  -framerate 24 -i "$D/fr/s1/%04d.jpg" -framerate 24 -i "$D/fr/s2/%04d.jpg" -framerate 24 -i "$D/fr/s3/%04d.jpg" -framerate 24 -i "$D/fr/s4/%04d.jpg" \
  -filter_complex "[0][1]xfade=transition=fade:duration=$X:offset=$o1[a];[a][2]xfade=transition=fade:duration=$X:offset=$o2[b];[b][3]xfade=transition=fade:duration=$X:offset=$o3,$G,format=yuv420p[v]" \
  -map "[v]" -an -c:v libx264 -preset veryfast -crf 12 "$M"
ffmpeg -y -hide_banner -loglevel error -i "$M" -an -c:v libx264 -preset veryfast -crf 32 -profile:v high -pix_fmt yuv420p -movflags +faststart "$O/intro.mp4"
V="-an -c:v libvpx-vp9 -b:v 950k -deadline good -cpu-used 2 -row-mt 1 -pix_fmt yuv420p"   # 2패스 · MP4 와 비슷한 크기
ffmpeg -y -hide_banner -loglevel error -i "$M" $V -pass 1 -passlogfile "$O/_vp9" -f webm /dev/null
ffmpeg -y -hide_banner -loglevel error -i "$M" $V -pass 2 -passlogfile "$O/_vp9" "$O/intro.webm"
rm -f "$O"/_vp9*
ffmpeg -y -hide_banner -loglevel error -i "$D/fr/s1/0000.jpg" -vf "$G" -q:v 7 "$O/intro.jpg"
rm -f "$M"
ffmpeg -y -hide_banner -loglevel error -sseof -0.08 -i "$O/intro.webm" -frames:v 1 -q:v 6 "$O/intro_end.jpg"   # 마지막 장면 (로고 화면 바탕 · 건너뛰어도 같은 그림)
# 음악 (music.js 가 그린 music.wav): 최고 크기를 −1.5 dBFS 로 맞추고 8.6초에서 자름 → intro.mp3 (페이지가 영상과 맞춰 틂)
if [ -f "$D/music.wav" ]; then
  PK=$(ffmpeg -hide_banner -i "$D/music.wav" -af volumedetect -f null - 2>&1 | sed -n 's/.*max_volume: \(-*[0-9.]*\) dB.*/\1/p')
  ffmpeg -y -hide_banner -loglevel error -i "$D/music.wav" -af "volume=$(echo "-1.5 - ($PK)" | bc)dB,afade=t=in:d=0.02,afade=t=out:st=8.3:d=0.3" -t 8.6 -c:a libmp3lame -b:a 112k -ar 44100 "$O/intro.mp3"
  ls -l "$O/intro.mp3"
fi
ls -l "$O/intro.mp4" "$O/intro.webm" "$O/intro.jpg"
