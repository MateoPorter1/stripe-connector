import * as THREE from 'three';
const root=document.querySelector('[data-card-wheel]'),canvas=document.querySelector('[data-wheel-canvas]');
if(root&&canvas){try{init()}catch(error){root.dataset.renderState='fallback';console.warn('Showing the static recovery illustration because 3D is unavailable.');}}
function init(){
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.VSMShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NoToneMapping;renderer.toneMappingExposure=1.05;
 const scene=new THREE.Scene();scene.background=new THREE.Color('#b5e0ee');scene.fog=new THREE.Fog('#d7ede8',26,55);
 const camera=new THREE.OrthographicCamera(-15,15,5.5,-5.5,.1,100);camera.position.set(1.1,1.35,24);camera.lookAt(0,-.45,0);
 scene.add(new THREE.HemisphereLight('#f1faff','#719989',1.1));
 const key=new THREE.DirectionalLight('#fff5df',2.1);key.position.set(-8,12,10);key.castShadow=true;key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-13,right:13,top:12,bottom:-10,near:1,far:38});key.shadow.bias=-.0005;key.shadow.normalBias=.035;key.shadow.radius=7;key.shadow.blurSamples=16;scene.add(key);
 const fill=new THREE.DirectionalLight('#c6ecff',.4);fill.position.set(9,3,6);scene.add(fill);
 let seed=493;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
 function texture(){const c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d'),image=ctx.createImageData(512,512);for(let i=0;i<image.data.length;i+=4){const n=105+random()*120;image.data[i]=image.data[i+1]=image.data[i+2]=n;image.data[i+3]=255}ctx.putImageData(image,0,0);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(3,3);t.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());return t;}
 const grain=texture();
 function clay(color,scale=.045){const material=new THREE.MeshStandardMaterial({color,roughness:.8,metalness:0,bumpMap:grain,bumpScale:scale});material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <dithering_fragment>',`#include <dithering_fragment>
float tactileGrain=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);
gl_FragColor.rgb*=.935+tactileGrain*.13;`)};return material;}
 const orange=clay('#f36f14'),orangeDark=clay('#cd5b17'),ivory=clay('#f3e8cb'),cream=clay('#fff2ce'),sage=clay('#91b78a'),gold=clay('#e7c572',.012),green=clay('#568b61'),coral=clay('#df8a70');
 function mesh(geometry,material,parent=scene){const m=new THREE.Mesh(geometry,material);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
 function rounded(w,h,d,r=.16){const s=new THREE.Shape();s.moveTo(-w/2+r,-h/2);s.lineTo(w/2-r,-h/2);s.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);s.lineTo(w/2,h/2-r);s.quadraticCurveTo(w/2,h/2,w/2-r,h/2);s.lineTo(-w/2+r,h/2);s.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);s.lineTo(-w/2,-h/2+r);s.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);const g=new THREE.ExtrudeGeometry(s,{depth:d,bevelEnabled:true,bevelSegments:5,steps:1,bevelSize:Math.min(.07,w*.08,h*.08),bevelThickness:Math.min(.06,d*.4+.005),curveSegments:10});g.translate(0,0,-d/2);return g;}
 function pill(a,b,r,mat,parent){const delta=new THREE.Vector3().subVectors(b,a),m=mesh(new THREE.CapsuleGeometry(r,Math.max(.01,delta.length()-2*r),6,12),mat,parent);m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return m;}
 const ground=mesh(new THREE.PlaneGeometry(160,160),clay('#a9ccbb',.04));ground.rotation.x=-Math.PI/2;ground.position.y=-4.42;
 function hill(x,y,z,sx,sy,sz,color){const m=mesh(new THREE.SphereGeometry(1,56,32),clay(color,.04));m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.receiveShadow=false;return m;}
 hill(-10,-5.4,-7,12,6,7,'#91bcad');hill(11,-5.6,-10,12,6.6,8,'#a4cdb4');hill(-2,-6,-17,15,7,9,'#b7d6c7');hill(-15,-4.5,1,8,2.5,6,'#99bda8');hill(16,-5,0,10,3.5,7,'#8bb69f');
 function cloud(x,y,z,scale){const g=new THREE.Group();scene.add(g);const mat=clay('#f0f8f5',.012);for(const [dx,dy,sx,sy] of [[-1,0,1,.42],[0,.25,1.05,.77],[.8,0,1.1,.47]]){const m=mesh(new THREE.SphereGeometry(1,32,24),mat,g);m.position.set(dx,dy,0);m.scale.set(sx,sy,.5);m.castShadow=false;}g.position.set(x,y,z);g.scale.setScalar(scale);return g;}
 cloud(-8,3,-12,1.1);cloud(9,3.2,-14,.8);
 const assembly=new THREE.Group();scene.add(assembly);assembly.position.set(0,-.35,0);assembly.rotation.y=-.48;assembly.rotation.x=.10;
 const stand=new THREE.Group();assembly.add(stand);
 pill(new THREE.Vector3(-.7,-1.9,-.4),new THREE.Vector3(-1.2,-3.85,-.25),.19,cream,stand);pill(new THREE.Vector3(.7,-1.9,-.4),new THREE.Vector3(1.2,-3.85,-.25),.19,cream,stand);
 const foot=mesh(new THREE.CapsuleGeometry(.2,2.65,10,24),cream,stand);foot.rotation.z=Math.PI/2;foot.scale.z=1.8;foot.position.set(0,-3.85,-.12);
 const rotor=new THREE.Group();assembly.add(rotor);
 const back=mesh(new THREE.CylinderGeometry(3.17,3.17,.42,128),orangeDark,rotor);back.rotation.x=Math.PI/2;back.position.z=-.18;
 const face=mesh(new THREE.CylinderGeometry(2.98,2.98,.24,128),ivory,rotor);face.rotation.x=Math.PI/2;face.position.z=.08;
 const rim=mesh(new THREE.TorusGeometry(3.04,.18,32,128),orange,rotor);rim.position.z=.25;
 const rimInner=mesh(new THREE.TorusGeometry(2.87,.045,12,128),cream,rotor);rimInner.position.z=.23;
 const cards=[],cardColors=['#e17656','#4ba9d4','#aa8dc9','#dfc36f','#83ad74','#dda576'];
 for(let i=0;i<6;i++){const group=new THREE.Group(),a=i*Math.PI/3;group.position.set(Math.sin(a)*2.01,Math.cos(a)*2.01,.38);rotor.add(group);const body=mesh(rounded(1.5,1.0,.24,.15),clay(cardColors[i],.032),group);body.rotation.y=-.025;
  const chipBase=mesh(rounded(.41,.29,.015,.04),clay('#c7a45a',.01),group);chipBase.position.set(-.36,.15,.22);
  for(let col=0;col<2;col++)for(let row=0;row<2;row++){const tile=mesh(rounded(.145,.095,.02,.014),gold,group);tile.position.set(-.36+(col-.5)*.19,.15+(row-.5)*.145,.25);}
  for(let j=0;j<4;j++){const dot=mesh(new THREE.SphereGeometry(.025,10,8),clay(cardColors[i]).clone(),group);dot.position.set(-.5+j*.12,-.21,.22);dot.scale.z=.4;}
  cards.push(group);
 }
 const hub=mesh(new THREE.CylinderGeometry(.8,.83,.37,64),cream,assembly);hub.rotation.x=Math.PI/2;hub.position.z=.43;
 const hubEdge=mesh(new THREE.TorusGeometry(.76,.055,12,64),ivory,assembly);hubEdge.position.z=.64;
 const logoMat=clay('#d58b46',.015);for(let j=0;j<3;j++){const y=.19-j*.17;const points=j===0?[new THREE.Vector3(-.28,y,.66),new THREE.Vector3(0,y+.14,.66),new THREE.Vector3(.28,y,.66),new THREE.Vector3(0,y-.14,.66),new THREE.Vector3(-.28,y,.66)]:[new THREE.Vector3(-.28,y,.66),new THREE.Vector3(0,y-.14,.66),new THREE.Vector3(.28,y,.66)];for(let k=1;k<points.length;k++)pill(points[k-1],points[k],.025,logoMat,assembly);}
 const pointer=new THREE.Group();assembly.add(pointer);const pointerShape=new THREE.Shape();pointerShape.moveTo(-.22,3.35);pointerShape.lineTo(.22,3.35);pointerShape.lineTo(0,2.93);pointerShape.closePath();const pointerMesh=mesh(new THREE.ExtrudeGeometry(pointerShape,{depth:.18,bevelEnabled:true,bevelSize:.06,bevelThickness:.06,bevelSegments:5}),cream,pointer);pointerMesh.position.z=.54;
 const invoice=new THREE.Group();scene.add(invoice);invoice.position.set(-5.5,-1.2,1.3);invoice.rotation.set(.08,-.12,-.13);
 const paper=mesh(rounded(1.65,2.35,.17,.12),cream,invoice);for(let j=0;j<3;j++){const line=mesh(rounded(j===2?.65:1.05,.09,.04,.035),clay('#d4af77'),invoice);line.position.set(j===2?-.2:0,.35-j*.27,.16);}
 const tag=mesh(rounded(.85,.34,.04,.07),coral,invoice);tag.position.set(-.15,-.7,.18);
 const successTray=new THREE.Group();scene.add(successTray);successTray.position.set(5.5,-4.24,.1);successTray.rotation.x=-.16;
 const tray=mesh(new THREE.CylinderGeometry(1.25,1.18,.24,64),cream,successTray);const trayRim=mesh(new THREE.TorusGeometry(1.15,.13,16,64),ivory,successTray);trayRim.rotation.x=Math.PI/2;trayRim.position.y=.15;
 const check=new THREE.Group();successTray.add(check);pill(new THREE.Vector3(-.47,.19,.07),new THREE.Vector3(-.12,.19,.39),.085,green,check);pill(new THREE.Vector3(-.12,.19,.39),new THREE.Vector3(.5,.19,-.38),.085,green,check);
 const ball=mesh(new THREE.SphereGeometry(.4,36,24),orange,successTray);ball.position.set(.15,.6,-.45);ball.visible=false;
 let angle=0,last=performance.now(),lastState='',lastAngle=NaN,needsRender=true,contextLost=false;
 function resize(){const w=root.clientWidth,h=root.clientHeight,mobile=w<700;renderer.setSize(w,h,false);const half=mobile?5.25:5.25;camera.left=-half*w/h;camera.right=half*w/h;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();assembly.position.x=0;assembly.position.y=mobile?-.05:-.35;assembly.scale.setScalar(mobile?.92:1);invoice.position.set(mobile?-2.6:-5.5,mobile?-2.8:-1.2,mobile?2:1.3);invoice.scale.setScalar(mobile?.58:1);successTray.visible=!mobile;needsRender=true;}
 new ResizeObserver(resize).observe(root);resize();
 function render(now){requestAnimationFrame(render);if(contextLost)return;const dt=Math.min(.05,(now-last)/1000);last=now;const paused=root.dataset.wheelPaused==='true';const target=-parseFloat(root.style.getPropertyValue('--wheel-angle')||'0')*Math.PI/180;if(!paused)angle=THREE.MathUtils.damp(angle,target,4.2,dt);const state=root.dataset.wheelState||'trying';if(Math.abs(angle-lastAngle)>.00015||lastState!==state||needsRender||!Number.isFinite(lastAngle)){rotor.rotation.z=angle;cards.forEach(card=>card.rotation.z=-angle);tag.material=state==='paid'?sage:coral;ball.visible=state==='paid';renderer.render(scene,camera);lastAngle=angle;lastState=state;needsRender=false;root.dataset.renderState='ready';}}
 requestAnimationFrame(render);
 canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();contextLost=true;root.dataset.renderState='fallback'});
 canvas.addEventListener('webglcontextrestored',()=>{contextLost=false;needsRender=true;last=performance.now()});
}
