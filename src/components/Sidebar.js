import RecoveryLogo from './RecoveryLogo';
import React,{useEffect,useRef,useState} from 'react';
import {Link,useLocation,useNavigate} from 'react-router-dom';
import {useAuth} from '../context/AuthContext';
import {LuChevronDown,LuUser,LuShield,LuLogOut} from 'react-icons/lu';
import './Sidebar.css';

// The live workspace uses the same horizontal navigation as the approved preview.
export default function Sidebar(){
 const {user,logout}=useAuth(),{pathname}=useLocation(),navigate=useNavigate();
 const [open,setOpen]=useState(false);const menu=useRef(null),trigger=useRef(null);
 useEffect(()=>{
  if(!open)return;
  const outside=event=>{if(!menu.current?.contains(event.target))setOpen(false);};
  const key=event=>{if(event.key==='Escape'){setOpen(false);trigger.current?.focus();}};
  document.addEventListener('mousedown',outside);document.addEventListener('keydown',key);
  return()=>{document.removeEventListener('mousedown',outside);document.removeEventListener('keydown',key);};
 },[open]);
 const go=path=>{setOpen(false);navigate(path);};
 return <header className="desk-navigation live-navigation">
  <Link to="/dashboard" className="desk-brand" aria-label="Rebound home"><RecoveryLogo/><span> / </span></Link>
  <nav aria-label="Workspace navigation"><Link to="/dashboard" aria-current={pathname==='/dashboard'?'page':undefined}>Collections</Link><Link to="/home" aria-current={pathname==='/home'?'page':undefined}>Insights</Link></nav>
  <div className="live-account-menu" ref={menu}>
   <button ref={trigger} className="live-account-trigger" aria-label="Account menu" aria-expanded={open} aria-controls="workspace-account-actions" onClick={()=>setOpen(value=>!value)}><span className="desk-account">{(user?.name||user?.email||'W').slice(0,1).toUpperCase()}</span><span className="account-display-name">{user?.name||'My workspace'}</span><LuChevronDown/></button>
   {open&&<div className="live-account-actions" id="workspace-account-actions"><div className="live-account-identity"><strong>{user?.name||'My workspace'}</strong><small>{user?.email}</small></div><button onClick={()=>go('/profile')}><LuUser/>Stripe & settings</button><button onClick={()=>go('/billing')}>Subscription & billing</button>{user?.role==='admin'&&<button onClick={()=>go('/admin')}><LuShield/>Admin panel</button>}<button className="account-sign-out" onClick={()=>{logout();go('/login');}}><LuLogOut/>Sign out</button></div>}
  </div>
 </header>;
}
