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
