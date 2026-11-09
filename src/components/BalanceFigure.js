import React from 'react';
// Keep the amount exact; only its typographic hierarchy changes.
export default function BalanceFigure({amount,currency}){
 const parts=new Intl.NumberFormat('en-US',{style:'currency',currency:currency.toUpperCase()}).formatToParts(amount/100);
 return <span className="balance-figure">{parts.map((part,index)=><span key={index} className={part.type==='decimal'||part.type==='fraction'?'balance-fraction':part.type==='currency'?'balance-symbol':'balance-integer'}>{part.value}</span>)}</span>;
}
