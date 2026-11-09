import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter,useLocation} from 'react-router-dom';
import Sidebar from './Sidebar';
import {useAuth} from '../context/AuthContext';
jest.mock('../context/AuthContext',()=>({useAuth:jest.fn()}));
let container,root,logout;
const button=name=>[...container.querySelectorAll('button')].find(b=>b.textContent.includes(name)||b.getAttribute('aria-label')===name);
function Location(){return <output>{useLocation().pathname}</output>;}
beforeEach(()=>{global.IS_REACT_ACT_ENVIRONMENT=true;logout=jest.fn();useAuth.mockReturnValue({user:{name:'Demo',email:'demo@example.invalid',role:'user'},logout});container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);});
afterEach(()=>{act(()=>root.unmount());container.remove();});
const render=async()=>act(async()=>root.render(<MemoryRouter initialEntries={['/dashboard']} future={{v7_startTransition:true,v7_relativeSplatPath:true}}><Sidebar/><Location/></MemoryRouter>));
test('live navigation reaches insights and account settings',async()=>{await render();await act(async()=>container.querySelector('a[href="/home"]').click());expect(container.querySelector('output').textContent).toBe('/home');await act(async()=>button('Account menu').click());expect(button('Admin panel')).toBeUndefined();await act(async()=>button('Stripe & settings').click());expect(container.querySelector('output').textContent).toBe('/profile');expect(container.querySelector('#workspace-account-actions')).toBeNull();});
test('administrator retains admin access and sign out clears the existing auth session',async()=>{useAuth.mockReturnValue({user:{name:'Admin',role:'admin'},logout});await render();await act(async()=>button('Account menu').click());await act(async()=>button('Admin panel').click());expect(container.querySelector('output').textContent).toBe('/admin');await act(async()=>button('Account menu').click());await act(async()=>button('Sign out').click());expect(logout).toHaveBeenCalledTimes(1);expect(container.querySelector('output').textContent).toBe('/login');});
