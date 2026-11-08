// Short, account-scoped cache avoids re-reading the same customer's cards on every page.
// Failed reads are never represented as zero cards and are never cached.
const cache = new Map();
const TTL = 120000;
async function countCustomerCards(stripe, customerId, now = Date.now()) {
  const methods = []; let cursor;
  do {
    const page = await stripe.paymentMethods.list({customer:customerId,type:'card',limit:100,...(cursor?{starting_after:cursor}:{})},{timeout:10000,maxNetworkRetries:0});
    methods.push(...page.data);
    const next = page.has_more ? page.data.at(-1)?.id : null;
    if(page.has_more && (!next || next===cursor))throw new Error('Card pagination did not advance.');
    cursor=next;
  } while(cursor);
  const cards=methods.filter(method=>(typeof method.customer==='string'?method.customer:method.customer?.id)===customerId&&method.type==='card'&&method.card);
  const date=new Date(now),year=date.getUTCFullYear(),month=date.getUTCMonth()+1;
  const usable=cards.filter(method=>method.card.exp_year>year||(method.card.exp_year===year&&method.card.exp_month>=month));
  return {cardCount:cards.length,eligibleCardCount:new Set(usable.map(method=>method.card.fingerprint||method.id)).size,cardCountError:false};
}
async function enrichCardCounts(stripe,rows,{userId,keyHash}) {
  const customers=[...new Set(rows.map(row=>row.customerId).filter(Boolean))];
  const results=new Map(); let index=0;
  await Promise.all(Array.from({length:Math.min(4,customers.length)},async()=>{
    while(index<customers.length){
      const customer=customers[index++],key=`${userId}:${keyHash}:${customer}`;
      try{
        let entry=cache.get(key);
        if(!entry||entry.expires<Date.now()){
          if(cache.size>=1000){for(const [id,value] of cache){if(value.expires<Date.now())cache.delete(id);}if(cache.size>=1000)cache.delete(cache.keys().next().value);}
          entry={expires:Date.now()+TTL,promise:countCustomerCards(stripe,customer)};
          cache.set(key,entry);
          entry.promise.catch(()=>{if(cache.get(key)===entry)cache.delete(key);});
        }
        results.set(customer,await entry.promise);
      }catch{results.set(customer,{cardCount:null,eligibleCardCount:null,cardCountError:true});}
    }
  }));
  return rows.map(row=>({...row,...(results.get(row.customerId)||{cardCount:null,eligibleCardCount:null,cardCountError:true})}));
}
module.exports={countCustomerCards,enrichCardCounts};
