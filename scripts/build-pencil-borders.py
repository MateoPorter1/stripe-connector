"""Generate reusable, deliberately uneven crayon borders for the shared theme."""
from pathlib import Path
from urllib.parse import quote
import math, random, re

def border(color):
    rng = random.Random(17)
    paths = []
    for layer, offset, weight, opacity in [(0,0,3.6,1),(1,2.1,1.8,.8),(2,-1.7,1.2,.65)]:
        points=[]
        # Independently drawn sides: waviness stays visible after nine-slice scaling.
        for side in range(4):
            side_points=[]
            length = 548 if side % 2 == 0 else 348
            for i in range(0,length+1,5):
                t=min(i,length)
                wobble=1.4*math.sin(t/17+layer*1.9)+1.1*math.sin(t/6.9+side)+rng.uniform(-2.2,2.2)
                v=12+offset+wobble
                if side==0: x,y=26+t,v
                elif side==1: x,y=600-v,26+t
                elif side==2: x,y=574-t,400-v
                else: x,y=v,374-t
                side_points.append(f'{x:.1f},{y:.1f}')
            paths.append(f'<polyline points="{" ".join(side_points)}" stroke-width="{weight}" opacity="{opacity}" stroke-dasharray="3 .5 7 .4 2 .7"/>')
        # Loose rounded corners, drawn separately rather than perfect geometric joins.
        paths.append(f'<path d="M26 {12+offset} Q{10+offset} {8+offset} {12+offset} 26 M{588-offset} 26 Q{592-offset} {9+offset} 574 {12+offset} M574 {388-offset} Q{590-offset} {392-offset} {588-offset} 374 M{12+offset} 374 Q{8+offset} {390-offset} 26 {388-offset}" stroke-width="{weight}" opacity="{opacity}" stroke-dasharray="3 .5 7 .4 2 .7"/>')
    svg=f'''<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><defs><filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="3" seed="4"/><feColorMatrix type="luminanceToAlpha"/><feComponentTransfer><feFuncA type="discrete" tableValues="0 .35 .8 1 1"/></feComponentTransfer></filter><mask id="wax"><path fill="white" d="M0 0h600v400H0z"/><path filter="url(#grain)" opacity=".55" d="M0 0h600v400H0z"/></mask></defs><g fill="none" stroke="{color}" stroke-linecap="round" stroke-linejoin="round" mask="url(#wax)">{''.join(paths)}<path d="M35 6l33 2m-22-4 42 2M526 394l28-2m-20 5 30-2" stroke-width="1.3" opacity=".8"/></g></svg>'''
    return 'url("data:image/svg+xml,'+quote(svg,safe='')+'")'
p=Path(__file__).resolve().parents[1]/'src/atelier.css'
s=p.read_text().split('\n/* Wide margins preserve three separate, wavy pencil passes at every size. */')[0]
for name,color in [('blue','#315de4'),('red','#e6533c'),('gold','#d89c19'),('green','#339765'),('pink','#d24f91'),('gray','#8b897d')]:
    s=re.sub(r'--pencil-'+name+r':url\("[^\n]+"\);',lambda _: '--pencil-'+name+':'+border(color)+';',s)
s+='''\n/* Wide margins preserve three separate, wavy pencil passes at every size. */
#root button,#root input,#root select{border-image-slice:28;border-image-width:17px;border-image-outset:4px}
.auth-box,.filter-section,.date-filter-section,.table-container,.scorecard,.stat-card,.chart-section,.profile-section,.users-section{border-image-slice:28;border-image-width:23px;border-image-outset:5px}
.info-item,.stripe-info-box,.stripe-status,.user-info-sidebar,.workspace-tag,.badge,.plan-badge-profile,.role-badge,.user-plan,.warning-box,.error-message,.success-message,.message{border-image-slice:28;border-image-width:16px;border-image-outset:3px}
.recovery-banner{border-image-slice:28;border-image-width:20px;border-image-outset:3px}
'''
p.write_text(s)
