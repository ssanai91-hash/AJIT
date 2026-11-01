import json, sys
from PIL import Image
A=json.load(open('art-src/work/anchors.json'))
def compose(i, pose, off=(0,0), front=True, pad=260):
    base=Image.open(f'art-src/work/parts/c{i}_base.png'); arm=Image.open(f'art-src/work/parts/c{i}_{pose}.png')
    a=A[str(i)]; bx,by=a['base']; ax,ay=a[pose]
    W,H=base.size
    can=Image.new('RGBA',(W+pad*2,H+pad),(0,0,0,0))
    ox,oy=pad+bx-ax+off[0], pad//2+by-ay+off[1]
    if not front: can.alpha_composite(arm,(ox,oy))
    can.alpha_composite(base,(pad,pad//2))
    if front: can.alpha_composite(arm,(ox,oy))
    return can
if __name__=='__main__':
    i=int(sys.argv[1]); offs=json.loads(sys.argv[2]) if len(sys.argv)>2 else {}
    row=[]
    for front in (True,False):
        for pose in ('arm_rest','arm_toast','arm_sip'):
            row.append(compose(i,pose,tuple(offs.get(pose,[0,0])),front))
    w,h=row[0].size
    out=Image.new('RGBA',(w*3,h*2),(55,60,65,255))
    for k,im in enumerate(row): out.alpha_composite(im,((k%3)*w,(k//3)*h))
    out.thumbnail((1800,1400)); out.save(f'art-src/work/test_c{i}.png')
