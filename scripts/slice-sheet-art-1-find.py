import sys, glob
from PIL import Image, ImageDraw
import numpy as np
from scipy import ndimage as ndi
src=glob.glob('C:/Users/SAEGYAERO/Downloads/*스프라이트 시트*.png')[0]
OUT=sys.argv[1]
im=Image.open(src).convert('RGB'); print(im.size)
a=np.asarray(im).astype(int)
# 배경 후보: 흰 바탕 + 배지 뒤 옅은 판(파랑·분홍·크림) + 선물 꽃 칸. 채도가 낮고 아주 밝은 색
mx=a.max(2); mn=a.min(2)
light=(mn>=222)            # 거의 흰색·옅은 판 색
# 바깥에서 이어진 light 만 배경으로(그림 안의 흰색은 남김): light 영역을 라벨링해 큰 덩어리만 배경
lab,n=ndi.label(light)
sizes=ndi.sum(light,lab,range(1,n+1))
bg=np.isin(lab,[i+1 for i,s in enumerate(sizes) if s>6000])
fg=~bg
# 가는 구분선(회색 줄) 제거: 열림 연산
fg2=ndi.binary_opening(fg,structure=np.ones((5,5)))
# 반짝이 등 떨어진 조각을 본체에 붙이려고 조금 부풀려 라벨링
lab2,n2=ndi.label(ndi.binary_dilation(fg2,structure=np.ones((13,13))))
objs=ndi.find_objects(lab2)
boxes=[]
for i,sl in enumerate(objs):
    y0,y1,x0,x1=sl[0].start,sl[0].stop,sl[1].start,sl[1].stop
    if (x1-x0)*(y1-y0)<2500: continue
    boxes.append((x0,y0,x1,y1,i+1))
dbg=im.copy(); d=ImageDraw.Draw(dbg)
for k,(x0,y0,x1,y1,i) in enumerate(sorted(boxes,key=lambda b:(b[1]//150,b[0]))):
    d.rectangle((x0,y0,x1,y1),outline=(255,0,0),width=2); d.text((x0+3,y0+3),str(k),fill=(255,0,0))
    print(k,x0,y0,x1,y1)
dbg.save(OUT+'/debug.png')
np.save(OUT+'/bg.npy',bg)
