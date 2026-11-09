// Layered artwork keeps the tactile rendered materials while the rotor moves independently.
const root=document.querySelector('[data-card-wheel]');
if(root){
 const images=[...root.querySelectorAll('img')];
 Promise.all(images.map(image=>image.decode().catch(()=>{}))).then(()=>{root.dataset.renderState=images.every(image=>image.naturalWidth>0)?'ready':'fallback'});
 let x=0,y=0,tx=0,ty=0,lastX=0,lastY=0;
 root.addEventListener('pointermove',event=>{const rect=root.getBoundingClientRect();tx=(event.clientX-rect.left)/rect.width-.5;ty=(event.clientY-rect.top)/rect.height-.5});
 root.addEventListener('pointerleave',()=>{tx=0;ty=0});
 function frame(){requestAnimationFrame(frame);if(root.dataset.wheelPaused==='true')return;x+=(tx-x)*.035;y+=(ty-y)*.035;if(Math.abs(x-lastX)+Math.abs(y-lastY)<.0002)return;root.style.setProperty('--art-x',`${x*10}px`);root.style.setProperty('--art-y',`${y*6}px`);root.style.setProperty('--art-tilt',`${x*3}deg`);lastX=x;lastY=y;}
 requestAnimationFrame(frame);
}
