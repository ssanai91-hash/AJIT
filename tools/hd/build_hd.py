import json, sys
from PIL import Image
A=json.load(open('art-src/work/anchors_pad.json'))
ROT={'arm_rest':0,'arm_toast_pad':float(sys.argv[1]),'arm_sip_pad':float(sys.argv[2])}
OFF={1:{'arm_rest':(18,-28),'arm_toast_pad':(15,0),'arm_sip_pad':(0,0)},
     2:{'arm_rest':(45,-35),'arm_toast_pad':(15,0),'arm_sip_pad':(10,-5)},
     3:{'arm_rest':(20,-25),'arm_toast_pad':(15,0),'arm_sip_pad':(0,0)}}
PAD=480; K=0.54; OUT=sys.argv[3]
def comp(i,p):
    base=Image.open(f'art-src/work/parts/c{i}_base_fix.png'); arm=Image.open(f'art-src/work/parts/c{i}_{p}.png')
    bx,by=A[str(i)]['base']; ax,ay=A[str(i)][p]
    if ROT[p]: arm=arm.rotate(ROT[p],resample=Image.BICUBIC,center=(ax,ay))
    W,H=base.size; can=Image.new('RGBA',(W+PAD*2,H+PAD*2))
    can.alpha_composite(base,(PAD,PAD))
    can.alpha_composite(arm,(PAD+bx-ax+OFF[i][p][0],PAD+by-ay+OFF[i][p][1]))
    return can,base.size
meta={}
for i in (1,2,3):
    ims={}; box=None
    for p in ROT:
        im,(bw,bh)=comp(i,p); ims[p]=im
        b=im.getchannel('A').point(lambda v:255 if v>10 else 0).getbbox()
        box=b if box is None else (min(box[0],b[0]),min(box[1],b[1]),max(box[2],b[2]),max(box[3],b[3]))
    for p,im in ims.items():
        c=im.crop(box); c=c.resize((round(c.width*K),round(c.height*K)),Image.LANCZOS)
        c.save(f'{OUT}/c{i}_{p.split("_")[1]}.webp',quality=86)
    meta[i]={'w':round((box[2]-box[0])*K/2),'h':round((box[3]-box[1])*K/2),'cx':round((PAD+bw/2-box[0])*K/2),'bottom':round((PAD+bh-box[1])*K/2)}
print(json.dumps(meta))
