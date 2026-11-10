const menu=document.querySelector('.menu-toggle'),nav=document.querySelector('.nav');
menu?.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));nav.dataset.open=String(open)});
nav?.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{nav.dataset.open='false';menu?.setAttribute('aria-expanded','false')}));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&nav?.dataset.open==='true'){nav.dataset.open='false';menu.setAttribute('aria-expanded','false');menu.focus()}});
const filters=[...document.querySelectorAll('[data-filter]')],guideSearch=document.querySelector('#guide-search');
function filterGuides(){const active=filters.find(b=>b.getAttribute('aria-pressed')==='true')?.dataset.filter||'All';const query=(guideSearch?.value||'').trim().toLowerCase();let count=0;document.querySelectorAll('.resource-browser [data-topic]').forEach(card=>{card.hidden=(active!=='All'&&card.dataset.topic!==active)||(query&&!card.dataset.search.toLowerCase().includes(query));if(!card.hidden)count++});const status=document.querySelector('#filter-status');if(status)status.textContent=`${count} guides shown`;const empty=document.querySelector('#search-empty');if(empty)empty.hidden=count!==0;}
filters.forEach(button=>button.addEventListener('click',()=>{filters.forEach(b=>b.setAttribute('aria-pressed',String(b===button)));filterGuides()}));guideSearch?.addEventListener('input',filterGuides);
const calculator=document.querySelector('#churn-calculator');
if(calculator){const currency=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});const update=()=>{const inputs=[...calculator.querySelectorAll('input')],valid=inputs.every(input=>input.value.trim()!==''&&input.checkValidity());document.querySelector('#calc-error').textContent=valid?'':'Enter a valid number in every field. Percentages must be between 0 and 100.';if(!valid){document.querySelector('#at-risk').textContent='—';document.querySelector('#recover-month').textContent='—';document.querySelector('#recover-year').textContent='—';return;}const [mrr,fail,recover]=inputs.map(i=>Number(i.value));const monthly=mrr*fail/100*recover/100;document.querySelector('#recover-month').textContent=currency.format(monthly);document.querySelector('#recover-year').textContent=currency.format(monthly*12);document.querySelector('#at-risk').textContent=currency.format(mrr*fail/100);};calculator.addEventListener('input',update);calculator.addEventListener('submit',e=>e.preventDefault());update();}
const example=document.querySelector('.recovery-theatre'),playExample=document.querySelector('[data-play-example]');
playExample?.addEventListener('click',()=>{const paid=example.dataset.exampleStep!=='1';example.dataset.exampleStep=paid?'1':'0';document.querySelector('[data-invoice-status]').textContent=paid?'Paid':'Unpaid';document.querySelector('[data-second-card]').textContent=paid?'✓ Paid':'Ready to try';document.querySelector('[data-third-card]').textContent=paid?'Not needed':'Waiting';document.querySelector('[data-example-title]').textContent=paid?'The second card worked. The original invoice is paid.':'The first card failed. The invoice is still unpaid.';document.querySelector('[data-example-description]').textContent=paid?'Rebound stops here. The third card is not charged.':'There are two more saved cards. Rebound can try the next eligible one.';playExample.textContent=paid?'Replay example ↺':'Try the next card ↗';});

// A continuously moving illustration of the saved-card pool, never a payment request.
const cardWheel=document.querySelector('[data-card-wheel]');
if(cardWheel){
 const cards=[...cardWheel.querySelectorAll('[data-wheel-card]')],dots=[...cardWheel.querySelectorAll('[data-wheel-dot]')];
 const title=cardWheel.querySelector('[data-wheel-title]'),message=cardWheel.querySelector('[data-wheel-message]'),toggle=cardWheel.querySelector('[data-wheel-toggle]');
 const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
 let userPaused=reducedMotion.matches,visible=true,last=performance.now(),elapsed=0,selected=-1;
 function reconcile(){cardWheel.dataset.wheelPaused=String(userPaused||document.hidden||!visible);toggle.textContent=userPaused?'Play animation ▷':'Pause animation Ⅱ';toggle.setAttribute('aria-label',userPaused?'Play card wheel animation':'Pause card wheel animation');}
 toggle.addEventListener('click',()=>{userPaused=!userPaused;reconcile()});document.addEventListener('visibilitychange',reconcile);
 reducedMotion.addEventListener('change',e=>{if(e.matches)userPaused=true;reconcile()});
 if('IntersectionObserver' in window)new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;reconcile()},{threshold:.03}).observe(cardWheel);
 function animate(now){requestAnimationFrame(animate);const dt=Math.min(.05,(now-last)/1000);last=now;if(cardWheel.dataset.wheelPaused!=='true')elapsed+=dt;const degrees=elapsed*12;cardWheel.style.setProperty('--wheel-angle',`${-degrees}deg`);cardWheel.dataset.motionTime=elapsed.toFixed(2);const index=Math.round(degrees/60)%6;if(index!==selected){selected=index;cards.forEach((card,i)=>{card.dataset.active=String(i===index);dots[i].dataset.active=String(i===index)});title.textContent=`Saved card ${index+1}`;message.textContent='Every eligible card gets a chance. Stop when paid.';}}
 cardWheel.dataset.wheelState='pool';reconcile();requestAnimationFrame(animate);
}

// Keep the selected billing interval visible through signup and Checkout.
const pricingIntervals=[...document.querySelectorAll('[data-pricing-interval]')];
pricingIntervals.forEach(button=>button.addEventListener('click',()=>{
 const annual=button.dataset.pricingInterval==='year';
 pricingIntervals.forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
 document.querySelector('[data-pricing-amount]').textContent=annual?'$500':'$50';
 document.querySelector('[data-pricing-period]').textContent=annual?'USD / year':'USD / month';
 document.querySelector('[data-pricing-equivalent]').textContent=annual?'$41.67/month equivalent. Billed $500 once a year.':'Pay monthly. Same features, no annual commitment.';
 document.querySelector('[data-pricing-terms]').textContent=annual?'Payment method required. Then $500 USD/year.':'Payment method required. Then $50 USD/month.';
 document.querySelectorAll('a[href*="app.reboundmrr.com/signup"]').forEach(a=>{const url=new URL(a.href);url.searchParams.set('interval',annual?'year':'month');a.href=url.href;});
}));
