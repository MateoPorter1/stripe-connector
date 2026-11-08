// Public design preview only. These are fictional records, never live Stripe data.
export const studioDemoRequest = async path => {
  const months=[{month:'Jun 2026',year:2026,monthNumber:6,amount:940,count:12},{month:'Jul 2026',year:2026,monthNumber:7,amount:1240,count:16},{month:'Aug 2026',year:2026,monthNumber:8,amount:1080,count:14},{month:'Sep 2026',year:2026,monthNumber:9,amount:1740,count:21},{month:'Oct 2026',year:2026,monthNumber:10,amount:2120,count:25},{month:'Nov 2026',year:2026,monthNumber:11,amount:890.76,count:11}];
  const params=new URLSearchParams(path.split('?')[1]);
  const visible=months.filter(m=>{const last=`2026-${String(m.monthNumber).padStart(2,'0')}-30`;const first=last.slice(0,8)+'01';return (!params.get('startDate')||last>=params.get('startDate'))&&(!params.get('endDate')||first<=params.get('endDate'));});
  if(path.startsWith('/summary'))return {summary:{totalsByCurrency:{USD:{totalAmount:Math.round(visible.reduce((n,m)=>n+m.amount,0)*100),count:visible.reduce((n,m)=>n+m.count,0)}},lastRecovery:{date:'2026-11-08T15:10:00Z'}}};
  if(path.startsWith('/by-month'))return {data:visible};
  const month=params.get('month')||'2026-11';
  const selected=visible.find(row=>`${row.year}-${String(row.monthNumber).padStart(2,'0')}`===month);
  const count=selected?.count||0,total=Math.round((selected?.amount||0)*100),base=count?Math.floor(total/count):0;
  const recoveries=Array.from({length:count},(_,i)=>({_id:`demo-${month}-${i}`,customerEmail:`customer${i+1}@example.com`,amount:base+(i===count-1?total-base*count:0),currency:'USD',recoveredAt:`${month}-03T15:10:00Z`,paymentMethodDetails:{brand:'visa',last4:'4242'}}));
  return {recoveries,totalCount:count,customerCount:count,totalAmount:total,currency:'USD',hasMore:false};
};

export const studioQueueRows=[
 {id:'demo-1',number:'INV-1042',email:'avery@example.com',currency:'usd',amount:4800,cardCount:3,eligibleCardCount:3,displayStatus:'open',selectionToken:'demo',lastFailure:1793961600,failedPayments:['demo-charge-1'],payments:[{id:'demo-charge-1',state:'failed'}],reason:'Insufficient funds'},
 {id:'demo-2',number:'INV-1041',email:'northline@example.com',currency:'usd',amount:9600,cardCount:2,eligibleCardCount:2,displayStatus:'open',selectionToken:'demo',lastFailure:1793875200,failedPayments:['demo-charge-2'],payments:[{id:'demo-charge-2',state:'failed'}],reason:'Card declined'},
 {id:'demo-3',number:'INV-1039',email:'field@example.com',currency:'usd',amount:0,cardCount:1,eligibleCardCount:1,displayStatus:'paid',selectionToken:null,lastFailure:1793788800,failedPayments:['demo-charge-3'],payments:[{id:'demo-charge-3',state:'failed'}],reason:'Previously declined'},
 {id:'demo-4',number:'INV-1038',email:'morrow@example.com',currency:'usd',amount:1500,cardCount:2,eligibleCardCount:2,displayStatus:'open',selectionToken:'demo',lastFailure:1793702400,failedPayments:['demo-charge-4'],payments:[{id:'demo-charge-4',state:'failed'}],reason:'Card declined'},
 {id:'demo-5',number:'INV-1037',email:'atlas@example.com',currency:'usd',amount:4000,cardCount:1,eligibleCardCount:0,displayStatus:'open',selectionToken:null,lastFailure:1793616000,failedPayments:['demo-charge-5'],payments:[{id:'demo-charge-5',state:'blocked'}],reason:'Expired card',retryNote:'No eligible saved cards'},
];
export const studioQueueRequest=async(path,options)=>{if(options?.method&&options.method!=='GET')throw new Error('Collections are disabled in the design preview.');if(path.startsWith('/failed')){const params=new URLSearchParams(path.split('?')[1]);return {invoices:studioQueueRows.filter(row=>{const date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York'}).format(new Date(row.lastFailure*1000));return date>=params.get('startDate')&&date<=params.get('endDate');}),totalFetched:5,nextCursor:null};}if(path==='/ready')return {ready:true};return {batch:null,attempts:[]};};
