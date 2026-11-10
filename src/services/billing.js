const base=(process.env.REACT_APP_API_URL||'http://localhost:5000/api').trim().replace(/\/$/,'');
export async function billingRequest(path='',body){
 const response=await fetch(`${base}/billing${path}`,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Authorization:`Bearer ${localStorage.getItem('token')||''}`},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(25000)});
 const result=await response.json();if(!response.ok||!result.success)throw Error(result.error||'Billing could not load. Please try again.');return result;
}
export function billingDestination(url){
 const target=new URL(url);if(target.protocol!=='https:'||!['checkout.stripe.com','billing.stripe.com'].includes(target.hostname))throw Error('The billing destination could not be verified.');return target.href;
}
