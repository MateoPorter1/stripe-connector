import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import CardFallback from './CardFallback';
import { fallbackRequest } from '../services/api';
jest.mock('../services/api',()=>({...jest.requireActual('../services/api'),fallbackRequest:jest.fn()}));
let root,container;
beforeEach(()=>{global.IS_REACT_ACT_ENVIRONMENT=true;fallbackRequest.mockReset();container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);});
afterEach(()=>{act(()=>root.unmount());container.remove();});
const button=text=>[...container.querySelectorAll('button')].find(item=>item.textContent.includes(text));
test('preview is read-only and live activation requires explicit account authorization',async()=>{
  fallbackRequest.mockResolvedValueOnce({settings:{enabled:false},attempts:[]})
    .mockResolvedValueOnce({account:{id:'acct_demo',name:'Demo account'},invoices:[]})
    .mockResolvedValueOnce({success:true,enabled:true})
    .mockResolvedValueOnce({settings:{enabled:true},attempts:[]});
  await act(async()=>{root.render(<CardFallback/>);});
  expect(fallbackRequest.mock.calls.some(call=>call[1]?.method==='PUT')).toBe(false);
  await act(async()=>{button('Preview eligible').click();});
  expect(button('Enable automatic').disabled).toBe(true);
  expect(fallbackRequest.mock.calls.some(call=>call[1]?.method==='PUT')).toBe(false);
  await act(async()=>{container.querySelector('input[type="checkbox"]').click();});
  await act(async()=>{button('Enable automatic').click();});
  const mutation=fallbackRequest.mock.calls.find(call=>call[1]?.method==='PUT');
  expect(JSON.parse(mutation[1].body)).toEqual({enabled:true,authorizeSavedCards:true,accountId:'acct_demo'});
  expect(container.textContent).toContain('Pause automatic card fallback');
});
test('status loading never enables collection by itself',async()=>{
  fallbackRequest.mockResolvedValue({settings:{enabled:false},attempts:[]});
  await act(async()=>{root.render(<CardFallback/>);});
  expect(fallbackRequest).toHaveBeenCalledTimes(1);
  expect(fallbackRequest.mock.calls[0]).toEqual([]);
  expect(container.textContent).toContain('Paused');
});
