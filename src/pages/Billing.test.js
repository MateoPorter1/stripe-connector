import React from 'react';
import {createRoot} from 'react-dom/client';
import {act} from 'react';
import {MemoryRouter} from 'react-router-dom';
import Billing from './Billing';
import {billingRequest,billingDestination} from '../services/billing';
jest.mock('../services/billing',()=>({billingRequest:jest.fn(),billingDestination:jest.fn()}));
jest.mock('../components/Sidebar',()=>()=>null);
let host,root;
beforeEach(()=>{global.IS_REACT_ACT_ENVIRONMENT=true;host=document.createElement('div');document.body.appendChild(host);root=createRoot(host);jest.clearAllMocks();});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
const render=async(path='/billing',props={})=>{await act(async()=>root.render(<MemoryRouter initialEntries={[path]} future={{v7_startTransition:true,v7_relativeSplatPath:true}}><Billing {...props}/></MemoryRouter>));};
test('preview shows the launch plan with no checkout requests',async()=>{await render('/billing',{preview:true});expect(host.textContent).toContain('$50.00');expect(host.textContent).toContain('14 days free');expect([...host.querySelectorAll('button')].find(b=>b.textContent.includes('Start 14-day')).disabled).toBe(true);expect(billingRequest).not.toHaveBeenCalled();});
test('return confirms session with server and does not claim payment success from redirect',async()=>{billingRequest.mockResolvedValue({configured:true,plan:{amount:100,currency:'usd'},billing:{status:'incomplete',hasCustomer:true}});await render('/billing?checkout=success&session_id=cs_test_ABC');expect(billingRequest).toHaveBeenCalledWith('/confirm',{sessionId:'cs_test_ABC'});expect(host.textContent).toContain('Payment incomplete');expect(host.textContent).toContain('A return to this page alone does not confirm payment');expect(host.textContent).toContain('Manage subscription');expect(host.textContent).not.toContain('Start 14-day free trial');});
test('unconfigured billing offers no payment button',async()=>{billingRequest.mockResolvedValue({configured:false});await render();expect(host.textContent).toContain('being prepared');expect(host.textContent).not.toContain('Start 14-day free trial');expect(billingDestination).not.toHaveBeenCalled();});

test('annual selection shows yearly total and actual billing terms',async()=>{await render('/billing?interval=year',{preview:true});expect(host.textContent).toContain('$500.00');expect(host.textContent).toContain('Billed $500 once a year');expect(host.textContent).toContain('Save $100');const monthly=[...host.querySelectorAll('button')].find(b=>b.textContent.includes('Monthly'));await act(async()=>monthly.click());expect(host.textContent).toContain('$50.00');expect(host.textContent).not.toContain('$500.00');});
test('checkout submits the selected annual interval, not a client price',async()=>{
 billingRequest.mockResolvedValue({configured:true,plan:{amount:5000,currency:'usd',interval:'month'},plans:[{amount:5000,currency:'usd',interval:'month'},{amount:50000,currency:'usd',interval:'year'}],billing:{status:'none',hasCustomer:false}});
 await render('/billing?interval=year');billingRequest.mockResolvedValueOnce({url:'https://checkout.stripe.com/fixture'});billingDestination.mockImplementation(()=>{throw Error('Navigation paused by test');});await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent.includes('Start 14-day')).click());expect(billingRequest).toHaveBeenLastCalledWith('/checkout',{interval:'year'});
});
