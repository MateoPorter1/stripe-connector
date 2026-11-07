const { test } = require('node:test');
const assert = require('node:assert/strict');
const { recoverInvoice, eligibility, alternateCards, savedCards } = require('../services/cardFallback');
const now = Date.UTC(2026, 10, 6);
const card = (id, fp = id, changes = {}) => ({ id, type: 'card', customer: 'cus_demo', card: { brand: 'visa', last4: '4242', fingerprint: fp, exp_year: 2030, exp_month: 1, ...changes } });
const invoice = changes => ({ id: 'in_demo', status: 'open', amount_remaining: 1500, amount_paid: 0, currency: 'usd', attempted: true, attempt_count: 1, collection_method: 'charge_automatically', auto_advance: true, subscription: { id: 'sub_demo', status: 'past_due' }, customer: 'cus_demo', payment_intent: { id: 'pi_demo', status: 'requires_payment_method', payment_method: card('pm_default') }, ...changes });
function fixture(pay, options = {}) {
  const entries = options.entries || new Map(); const calls = []; const recorded = [];
  const ledger = {
    rememberFailed: async (accountId, invoiceId, method) => { if(!entries.has(method.id))entries.set(method.id,{accountId,invoiceId,methodId:method.id,fingerprint:method.card.fingerprint,status:'skipped'}); },
    blocked: async () => [...entries.values()].some(row => ['pending','uncertain','processing','action_required','paid'].includes(row.status)),
    seen: async (_, __, method) => [...entries.values()].some(row => row.methodId === method.id || row.fingerprint === method.card.fingerprint),
    claim: async data => { if(entries.has(data.methodId))return false;entries.set(data.methodId,{...data});return true; },
    finish: async (key, data) => entries.set(key.methodId, {...entries.get(key.methodId),...data})
  };
  const stripe = {
    invoices: { retrieve: async () => options.invoice || invoice(), pay: async (...args) => {calls.push(args); return pay(...args);} },
    paymentMethods: { list: async () => ({ data: options.cards || [card('pm_default'),card('pm_second'),card('pm_third')],has_more:false }) }
  };
  return { calls, entries, recorded, args: { stripe, invoiceId:'in_demo',accountId:'acct_demo',ledger,allowed:async()=>true,recordPaid:async record=>recorded.push(record),now:()=>now } };
}
const paid = () => invoice({status:'paid',amount_remaining:0,amount_paid:1500,payment_intent:{id:'pi_demo',status:'succeeded'}});
const decline = () => Object.assign(new Error('decline'), {type:'StripeCardError',code:'card_declined',payment_intent:{id:'pi_demo',status:'requires_payment_method'}});

test('declined alternate card falls back to next card on the same invoice; stops after success',async()=>{
  const f=fixture(async(_,params)=>{if(params.payment_method==='pm_second')throw decline();return paid();});
  const result=await recoverInvoice(f.args);
  assert.equal(result.state,'paid');assert.equal(f.calls.length,2);
  assert.deepEqual(f.calls.map(call=>call[0]),['in_demo','in_demo']);
  assert.deepEqual(f.calls.map(call=>call[1].payment_method),['pm_second','pm_third']);
  assert.ok(f.calls.every(call=>call[1].off_session===true&&call[2].idempotencyKey));
  assert.equal(f.recorded.length,1);assert.equal(f.recorded[0].amount,1500);
});
test('network uncertainty does not cascade to another card or replay after restart',async()=>{
  const f=fixture(async()=>{throw Object.assign(new Error('timeout'),{type:'StripeConnectionError'});});
  assert.equal((await recoverInvoice(f.args)).state,'uncertain');
  assert.equal((await recoverInvoice(f.args)).state,'blocked');assert.equal(f.calls.length,1);
});
test('authentication and processing stop further cards',async()=>{
  for(const state of ['requires_action','processing']){
    const f=fixture(async()=>invoice({payment_intent:{id:'pi_demo',status:state}}));
    assert.equal((await recoverInvoice(f.args)).state,state==='processing'?'processing':'action_required');assert.equal(f.calls.length,1);
  }
});
test('does not charge already paid, paused, canceled subscriptions, or imminent native retries',async()=>{
  for(const change of [{status:'paid',amount_remaining:0},{auto_advance:false},{subscription:{id:'sub_demo',status:'canceled'}},{next_payment_attempt:now/1000+60}]){
    const f=fixture(paid,{invoice:invoice(change)});assert.equal((await recoverInvoice(f.args)).state,'skipped');assert.equal(f.calls.length,0);
  }
});
test('pause blocks submission and ledger claim failure cannot lead to an unrecorded charge',async()=>{
  const f=fixture(paid);f.args.allowed=async()=>false;
  assert.equal((await recoverInvoice(f.args)).state,'paused');assert.equal(f.calls.length,0);
  const g=fixture(paid);g.args.ledger.claim=async()=>{throw new Error('database unavailable');};
  await assert.rejects(recoverInvoice(g.args));assert.equal(g.calls.length,0);
});
test('rechecks invoice before every charge and stops when Stripe already collected',async()=>{
  const f=fixture(paid);let reads=0;f.args.stripe.invoices.retrieve=async()=>++reads===1?invoice():paid();
  assert.equal((await recoverInvoice(f.args)).state,'stopped');assert.equal(f.calls.length,0);
});
test('retains declined-card history across restarts',async()=>{
  const f=fixture(async()=>{throw decline();});
  assert.equal((await recoverInvoice(f.args)).state,'exhausted');assert.equal(f.calls.length,2);
  await recoverInvoice(f.args);assert.equal(f.calls.length,2);
});
test('deduplicates physical cards including duplicates of the original failed card',()=>{
  const cards=[card('pm_default','original'),card('pm_duplicate','original'),card('pm_new','new'),card('pm_duplicate2','new')];
  const result=alternateCards(invoice({payment_intent:{payment_method:cards[0]}}),cards);
  assert.deepEqual(result.map(method=>method.id),['pm_new']);
});
test('skips expired and foreign-customer methods and paginates saved cards',async()=>{
  let calls=0;const stripe={paymentMethods:{list:async params=>{
    calls++;if(calls===1)return{data:[card('pm_old','old',{exp_year:2025})],has_more:true};
    assert.equal(params.starting_after,'pm_old');return{data:[card('pm_ok'),{...card('pm_foreign'),customer:'cus_other'}],has_more:false};
  }}};
  assert.deepEqual((await savedCards(stripe,'cus_demo',now)).map(method=>method.id),['pm_ok']);
});
test('only explicit confirmed card declines permit a cascade',async()=>{
  const f=fixture(async()=>{throw Object.assign(new Error('server'),{type:'StripeAPIError',code:'card_declined'});});
  assert.equal((await recoverInvoice(f.args)).state,'uncertain');assert.equal(f.calls.length,1);
});
test('missing expanded subscription state never authorizes automatic collection',()=>{
  assert.equal(eligibility(invoice({subscription:'sub_demo'}),now),'subscription_not_active');
});

test('a failed atomic claim never starts a competing card charge',async()=>{
  const f=fixture(paid);f.args.ledger.claim=async()=>false;
  assert.equal((await recoverInvoice(f.args)).state,'blocked');assert.equal(f.calls.length,0);
});
test('original Stripe-failed card is remembered even after the last failed method changes',async()=>{
  let current=invoice();
  const f=fixture(async(_,params)=>{current=invoice({payment_intent:{id:'pi_demo',status:'requires_payment_method',payment_method:card(params.payment_method)}});throw decline();});
  f.args.stripe.invoices.retrieve=async()=>current;
  await recoverInvoice(f.args);assert.equal(f.calls.length,2);
  await recoverInvoice(f.args);assert.equal(f.calls.length,2);
  assert.equal(f.entries.get('pm_default').status,'skipped');
});
