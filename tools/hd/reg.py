import numpy as np, cv2, json
NAMES=['neutral','smile','laugh','surprised','sad','worried','annoyed','tipsy','sleepy']
N={'chansu':1,'jungin':2,'sungyeol':3}
def headonly(img):
    a=img[...,3]>128; H=a.shape[0]
    widths=np.array([ (np.ptp(np.nonzero(r)[0]) if r.any() else 0) for r in a])
    lo,hi=int(H*0.5),int(H*0.88)
    neck=lo+int(np.argmin(widths[lo:hi]))
    cut=min(H,neck+10)
    out=img.copy(); out[cut:,:,3]=0
    for k in range(14):
        y=cut-14+k
        if 0<=y<H: out[y,:,3]=(out[y,:,3].astype(float)*(1-k/14)).astype(np.uint8)
    return out,neck
res={}
for who,n in N.items():
    comp=cv2.imread(f'demo/img/c{n}_rest.webp',cv2.IMREAD_UNCHANGED)
    cg=cv2.cvtColor(comp[...,:3],cv2.COLOR_BGR2GRAY).astype(np.float32)
    neu=cv2.imread(f'art-src/work/cells/{who}_neutral.png',cv2.IMREAD_UNCHANGED)
    neuh,neck=headonly(neu)
    t=neuh[:int(neck*0.92)]
    best=(-1,)
    for s in np.arange(0.30,0.80,0.01):
        tt=cv2.resize(t,None,fx=s,fy=s,interpolation=cv2.INTER_AREA)
        if tt.shape[0]>=cg.shape[0] or tt.shape[1]>=cg.shape[1]: break
        tg=cv2.cvtColor(tt[...,:3],cv2.COLOR_BGR2GRAY).astype(np.float32); m=(tt[...,3]>200).astype(np.float32)
        r=np.nan_to_num(cv2.matchTemplate(cg,tg,cv2.TM_CCORR_NORMED,mask=m),nan=-1,posinf=-1,neginf=-1)
        _,mx,_,loc=cv2.minMaxLoc(r)
        if mx>best[0]: best=(mx,s,loc)
    sc,(x0,y0)=best[1],best[2]
    print(who,'score %.3f scale %.2f at'%(best[0],sc),(x0,y0), 'neck',neck)
    res[who]={'scale':float(sc),'x':int(x0),'y':int(y0)}
    ng=cv2.cvtColor(neuh[...,:3],cv2.COLOR_BGR2GRAY).astype(np.float32)
    for name in NAMES:
        e=cv2.imread(f'art-src/work/cells/{who}_{name}.png',cv2.IMREAD_UNCHANGED)
        eh,_=headonly(e)
        top=eh[:int(e.shape[0]*0.42)]
        tg=cv2.cvtColor(top[...,:3],cv2.COLOR_BGR2GRAY).astype(np.float32); m=(top[...,3]>200).astype(np.float32)
        pad=40; big=cv2.copyMakeBorder(ng,pad,pad,pad,pad,cv2.BORDER_REPLICATE)
        r=np.nan_to_num(cv2.matchTemplate(big,tg,cv2.TM_CCORR_NORMED,mask=m),nan=-1,posinf=-1,neginf=-1); _,_,_,loc=cv2.minMaxLoc(r)
        dx,dy=loc[0]-pad,loc[1]-pad
        hs=cv2.resize(eh,None,fx=sc,fy=sc,interpolation=cv2.INTER_AREA)
        canvas=np.zeros_like(comp)
        px,py=int(round(x0+dx*sc)),int(round(y0+dy*sc))
        hh,ww=hs.shape[:2]
        ys0,xs0=max(0,py),max(0,px); ys1,xs1=min(canvas.shape[0],py+hh),min(canvas.shape[1],px+ww)
        canvas[ys0:ys1,xs0:xs1]=hs[ys0-py:ys1-py, xs0-px:xs1-px]
        cv2.imwrite(f'art-src/work/heads/c{n}_face_{name}.png',canvas)
json.dump(res,open('art-src/work/reg.json','w'))

# 결과를 시연판 이미지로 변환
from PIL import Image
for who,n in N.items():
    for name in NAMES:
        Image.open(f'art-src/work/heads/c{n}_face_{name}.png').save(f'demo/img/c{n}_face_{name}.webp',quality=86)
