// Creates only sandbox catalog objects. Keys enter through environment, never CLI args.
const fs=require('fs');const crypto=require('crypto');const Stripe=require('stripe-billing');
(async()=>{
 const key=process.env.REBOUND_BILLING_KEY;
 if(!/^(rkcs|rk|sk)_test_/.test(key||''))throw Error('A test billing key is required.');
 const stripe=new Stripe(key),account=await stripe.accounts.retrieve();
 const product=await stripe.products.create({name:'Rebound — monthly subscription TEST',description:'Sandbox only. $1 per month is a test amount, not launch pricing.'},{idempotencyKey:'rebound-billing-test-product-v1'});
 const price=await stripe.prices.create({product:product.id,unit_amount:100,currency:'usd',recurring:{interval:'month'}},{idempotencyKey:'rebound-billing-test-monthly-v1'});
 const portal=await stripe.billingPortal.configurations.create({business_profile:{headline:'Rebound subscription testing'},features:{invoice_history:{enabled:true},payment_method_update:{enabled:true},subscription_cancel:{enabled:true,mode:'at_period_end'}}},{idempotencyKey:'rebound-billing-test-portal-v1'});
 const file=require('path').resolve(__dirname,'../.env.test.local');
 if(fs.existsSync(file))throw Error('Test environment file exists; refusing to overwrite it.');
 const values={BILLING_ENABLED:'true',BILLING_MODE:'test',REBOUND_BILLING_KEY:key,REBOUND_BILLING_ACCOUNT:account.id,REBOUND_BILLING_PRICE:price.id,REBOUND_BILLING_PORTAL:portal.id,REBOUND_BILLING_WEBHOOK_SECRET:`whsec_${crypto.randomBytes(32).toString('hex')}`,BILLING_APP_ORIGIN:'http://localhost:3000'};
 fs.writeFileSync(file,Object.entries(values).map(([k,v])=>`${k}=${v}`).join('\n')+'\n',{mode:0o600});
 console.log(JSON.stringify({account:account.id,product:product.id,price:price.id,portal:portal.id,currency:'usd',testMonthlyAmount:100,envFile:file,live:false}));
})().catch(e=>{console.error('Sandbox catalog setup failed:',e.code||e.type||e.name);process.exit(1);});
