import sys, glob
from PIL import Image, ImageFilter
import numpy as np
from scipy import ndimage as ndi
src=glob.glob('C:/Users/SAEGYAERO/Downloads/*스프라이트 시트*.png')[0]
OUT=sys.argv[1]
im=Image.open(src).convert('RGB'); a=np.asarray(im)
bg=np.load(OUT+'/bg.npy'); fg=ndi.binary_opening(~bg,structure=np.ones((3,3)))
# 튤립·들꽃 경계: 552~761 사이에서 전경이 가장 적은 열
col=fg[363:474,620:680].sum(0); split=620+int(col.argmin()); print('split',split,col.min())
B={'stage-1':(605,166,733,284),'stage-2':(795,127,937,284),'stage-3':(982,90,1182,284),'stage-4':(1201,15,1503,290),
'decor-tulip':(552,363,split,474),'decor-wild':(split,363,761,474),'decor-sunflower':(769,352,870,475),'decor-pot':(872,364,979,481),
'decor-bench':(980,375,1134,478),'decor-butterfly':(1136,382,1241,463),'decor-lantern':(1252,340,1337,491),'decor-fountain':(1342,340,1519,491),
'record-01':(373,611,470,680),'record-10':(493,605,621,682),'record-30':(650,578,742,698),'record-100':(767,576,914,696),
'streak-03':(404,752,463,819),'streak-07':(515,737,596,825),'streak-14':(647,726,750,830),'streak-30':(806,700,891,840),
'goal-01':(401,866,517,977),'goal-04':(570,860,684,983),'goal-12':(736,856,889,988),
'char-m':(18,611,182,907),'char-f':(191,611,347,907),'decor-gift-flower':(946,692,1101,854),'garden-bg':(1116,566,1526,984),'garden-sample':(18,25,532,537)}
res={}
for n,(x0,y0,x1,y1) in B.items():
    m=fg[y0:y1,x0:x1]
    if n=='decor-gift-flower':   # 칸 테두리(가는 회색 줄) 제외: 가장 큰 덩어리만
        l,k=ndi.label(m); m=(l==1+np.argmax(ndi.sum(m,l,range(1,k+1))))
    m=ndi.binary_fill_holes(m)   # 그림 안의 밝은 부분(흰 꽃잎·신발)은 남김
    ys,xs=np.where(m); bx0,bx1,by0,by1=xs.min(),xs.max()+1,ys.min(),ys.max()+1
    c=Image.fromarray(a[y0:y1,x0:x1]).convert('RGBA')
    al=Image.fromarray((m*255).astype('uint8')).filter(ImageFilter.GaussianBlur(0.6))
    c.putalpha(al); c=c.crop((bx0,by0,bx1,by1)); c.save(f'{OUT}/raw-{n}.png'); res[n]=c.size
    print(n,c.size)
