import sys
from PIL import Image, ImageDraw, ImageFilter, ImageChops
import numpy as np
I='C:/Users/SAEGYA~1/AppData/Local/Temp/claude/7be4b8b77034ae5d/bdb839ac-a7dc-4afd-82d4-78a4816ed487/images/'
OUT=sys.argv[1]
def cut(f):
    im=Image.open(I+f).convert('RGB')
    # 바깥 배경(거의 흰색)만 모서리에서 번져 가며 지움 → 신발·양말의 흰색은 남음
    m=im.copy()
    KEY=(255,0,255)
    for xy in ((0,0),(im.width-1,0),(0,im.height-1),(im.width-1,im.height-1),(im.width//2,0),(0,im.height//2),(im.width-1,im.height//2)):
        if m.getpixel(xy)!=KEY: ImageDraw.floodfill(m,xy,KEY,thresh=60)
    a=np.asarray(m); bg=(a[:,:,0]==255)&(a[:,:,1]==0)&(a[:,:,2]==255)
    alpha=Image.fromarray((~bg*255).astype('uint8'))
    alpha=alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    out=im.convert('RGBA'); out.putalpha(alpha)
    return out
def dark_bbox(im, x_max=None):
    a=np.asarray(im); d=(a[:,:,3]>128)&(a[:,:,:3].max(2)<90)
    if x_max: d[:,x_max:]=False
    cols=np.where(d.sum(0)>6)[0]; rows=np.where(d.sum(1)>6)[0]
    return cols.min(),rows.min(),cols.max()+1,rows.max()+1
m=cut('8.webp'); f=cut('9.webp')
f=f.resize((round(f.width*50/52),round(f.height*50/52)),Image.LANCZOS)   # 눈 크기 기준으로 두 그림의 칸 크기를 맞춤
mb=dark_bbox(m); fb=dark_bbox(f); fbody=dark_bbox(f,x_max=int(800*50/52))
print('male',mb,'female',fb,'female body',fbody)
H=mb[3]-mb[1]+40; W=round(H*2/3)
def place(im,body,full):
    c=Image.new('RGBA',(W,H),(0,0,0,0))
    cx=(body[0]+body[2])//2
    c.alpha_composite(im,(W//2-cx, H-12-full[3]))
    return c
cm=place(m,mb,mb); cf=place(f,fbody,fb)
for n,c in (('char-m',cm),('char-f',cf)):
    bb=c.getbbox(); print(n,'canvas',c.size,'content',bb)
    c.resize((256,384),Image.LANCZOS).save(f'{OUT}/{n}.png')
# 확인 시트
s=Image.new('RGBA',(700,420),'#F6F4EE'); x=10
for sc in (128,64,32):
    for n in ('char-m','char-f'):
        t=Image.open(f'{OUT}/{n}.png').resize((sc,sc*3//2),Image.LANCZOS); s.alpha_composite(t,(x,400-t.height)); x+=sc+16
g=Image.new('RGBA',(160,210),'#D8F36A'); 
for i,n in enumerate(('char-m','char-f')): g.alpha_composite(Image.open(f'{OUT}/{n}.png').resize((64,96),Image.LANCZOS),(10+i*76,100))
s.alpha_composite(g,(530,200)); s.convert('RGB').save(f'{OUT}/char-check.png')
