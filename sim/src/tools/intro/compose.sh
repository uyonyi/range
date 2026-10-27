#!/bin/sh
# 인트로 영상 합치기: render.js 가 만든 장면 프레임(fr/s1~s4, 24fps) → 짧은 교차 전환 → intro.mp4 (H.264) · intro.webm (VP9, H.264 를 못 트는 브라우저용) · intro.jpg (첫 프레임 = 영상 시작 화면과 같게)
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
ls -l "$O/intro.mp4" "$O/intro.webm" "$O/intro.jpg"
