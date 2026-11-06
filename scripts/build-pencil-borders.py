"""Build fine, nearly straight wax-pencil edges with softly rounded corners."""
from pathlib import Path
from urllib.parse import quote
import math, random, re

def border(color):
    rng = random.Random(17)
    paths=[]
    for offset, weight, opacity in [(0,4.5,1),(.85,.85,.7)]:
        for side in range(4):
            length=520 if side % 2 == 0 else 320
            points=[]
            for i in range(0,length+1,4):
                v=12+offset+rng.uniform(-.65,.65)+.65*math.sin(i/39+side)
                if side==0: x,y=40+i,v
                elif side==1: x,y=600-v,40+i
                elif side==2: x,y=560-i,400-v
                else: x,y=v,360-i
                points.append(f'{x:.2f},{y:.2f}')
            paths.append(f'<polyline points="{" ".join(points)}" stroke-width="{weight}" opacity="{opacity}"/>')
        e=12+offset
        paths.append(f'<path d="M40 {e} Q{e} {e} {e} 40 M{600-e} 40 Q{600-e} {e} 560 {e} M560 {400-e} Q{600-e} {400-e} {600-e} 360 M{e} 360 Q{e} {400-e} 40 {400-e}" stroke-width="{weight}" opacity="{opacity}"/>')
    svg=f'''<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><defs><filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="3" seed="4" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncR type="discrete" tableValues="0 0 1 1 1"/><feFuncG type="discrete" tableValues="0 0 1 1 1"/><feFuncB type="discrete" tableValues="0 0 1 1 1"/></feComponentTransfer></filter><mask id="wax"><path fill="white" filter="url(#grain)" d="M0 0h600v400H0z"/></mask></defs><g fill="none" stroke="{color}" stroke-linecap="round" stroke-linejoin="round" mask="url(#wax)">{''.join(paths)}<path d="M44 7l30-1 12 1m-35-3 38 1" stroke-width="1.1" opacity=".8"/></g></svg>'''
    return 'url("data:image/svg+xml,'+quote(svg,safe='')+'")'
p=Path(__file__).resolve().parents[1]/'src/atelier.css'
s=p.read_text().split('\n/* Wide margins preserve three separate, wavy pencil passes at every size. */')[0]
s=s.split('\n/* Fine crayon grain with restrained, nearly straight edges. */')[0]
for name,color in [('blue','#2878ed'),('red','#e6533c'),('gold','#d89c19'),('green','#339765'),('pink','#d24f91'),('gray','#8b897d')]:
    s=re.sub(r'--pencil-'+name+r':url\("[^\n]+"\);',lambda _: '--pencil-'+name+':'+border(color)+';',s)
s+='''\n/* Fine crayon grain with restrained, nearly straight edges. */
#root button,#root input,#root select{border-image-slice:44;border-image-width:22px;border-image-outset:3px}
.auth-box,.filter-section,.date-filter-section,.table-container,.scorecard,.stat-card,.chart-section,.profile-section,.users-section{border-image-slice:44;border-image-width:34px;border-image-outset:4px}
.info-item,.stripe-info-box,.stripe-status,.user-info-sidebar,.workspace-tag,.badge,.plan-badge-profile,.role-badge,.user-plan,.warning-box,.error-message,.success-message,.message{border-image-slice:44;border-image-width:22px;border-image-outset:2px}
.recovery-banner{border-image-slice:44;border-image-width:30px;border-image-outset:3px}
'''
p.write_text(s)
