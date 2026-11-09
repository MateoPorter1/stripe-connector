import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {LuCalendar,LuChevronDown,LuChevronLeft,LuChevronRight,LuX} from 'react-icons/lu';
import './DateRangePicker.css';
export const todayInNewYork=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const iso=date=>date.toISOString().slice(0,10);
const dateOf=value=>new Date(`${value}T12:00:00Z`);
const shiftDays=(value,days)=>{const d=dateOf(value);d.setUTCDate(d.getUTCDate()+days);return iso(d);};
const monthStart=(value,offset=0)=>{const d=dateOf(value);return iso(new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+offset,1,12)));};
const monthLabel=value=>new Intl.DateTimeFormat('en-US',{month:'long',year:'numeric',timeZone:'UTC'}).format(dateOf(value));
export const rangePresets=(today=todayInNewYork(),allowAllTime=true)=>{
 const d=dateOf(today),year=d.getUTCFullYear(),quarter=Math.floor(d.getUTCMonth()/3)*3;
 return [['Today',today],['Last 7 days',shiftDays(today,-6)],['Last 15 days',shiftDays(today,-14)],['Last 4 weeks',shiftDays(today,-27)],['Last 6 months',monthStart(today,-5)],['Last 12 months',monthStart(today,-11)],['Month to date',monthStart(today)],['Quarter to date',iso(new Date(Date.UTC(year,quarter,1,12)))],['Year to date',`${year}-01-01`],...(allowAllTime?[['All time','']]:[])].map(([label,start])=>({label,start,end:start?today:''}));
};
const display=value=>new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(dateOf(value));
export default function DateRangePicker({start='',end='',onApply,disabled=false,allowAllTime=true}){
 const [open,setOpen]=useState(false),[draft,setDraft]=useState({start,end}),[anchor,setAnchor]=useState(()=>monthStart(end||todayInNewYork(),-1)),[pickingEnd,setPickingEnd]=useState(false),[error,setError]=useState('');
 const trigger=useRef(null),panel=useRef(null);
 const [compact,setCompact]=useState(()=>window.matchMedia?.('(max-width: 440px)').matches||false);
 useEffect(()=>{const media=window.matchMedia?.('(max-width: 440px)');if(!media)return;const update=()=>setCompact(media.matches);media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
 const presets=rangePresets(todayInNewYork(),allowAllTime);
 const active=presets.find(p=>p.start===start&&p.end===end);
 const label=active?.label||(!start&&!end?'All time':start&&end?`${display(start)} – ${display(end)}`:'Choose dates');
 const close=()=>{setOpen(false);trigger.current?.focus();};
 useEffect(()=>{
  if(!open)return;
  const first=panel.current?.querySelector('button');first?.focus();
  const previous=document.body.style.overflow;document.body.style.overflow='hidden';
  const key=event=>{if(event.key==='Escape'){event.preventDefault();setOpen(false);trigger.current?.focus();}if(event.key==='Tab'){
   const items=[...panel.current.querySelectorAll('button:not(:disabled),input,select,[tabindex="0"]')].filter(el=>!el.disabled);
   const first=items[0],last=items[items.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  }};document.addEventListener('keydown',key);return()=>{document.body.style.overflow=previous;document.removeEventListener('keydown',key);};
 },[open]);
 const chooseDay=value=>{setError('');if(!pickingEnd||!draft.start||value<draft.start){setDraft({start:value,end:value});setPickingEnd(true);}else{setDraft({...draft,end:value});setPickingEnd(false);}};
 const apply=()=>{if((!draft.start||!draft.end)&&!(allowAllTime&&!draft.start&&!draft.end)){setError('Choose a start and end date.');return;}if(draft.start>draft.end){setError('The start date must come before the end date.');return;}onApply(draft);close();};
 const calendar=value=>{
  const d=dateOf(value),days=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate(),offset=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1)).getUTCDay();
  return <section className="range-calendar" key={value} aria-label={monthLabel(value)}><h3>{monthLabel(value)}</h3><div className="calendar-weekdays" aria-hidden="true">{['Su','Mo','Tu','We','Th','Fr','Sa'].map(day=><span key={day}>{day}</span>)}</div><div className="calendar-days">{Array.from({length:offset},(_,i)=><span key={`empty-${i}`}/>)}{Array.from({length:days},(_,i)=>{const day=value.slice(0,8)+String(i+1).padStart(2,'0'),selected=day===draft.start||day===draft.end,inRange=draft.start&&draft.end&&day>draft.start&&day<draft.end;return <button key={day} type="button" aria-label={display(day)} aria-pressed={Boolean(selected)} className={`${selected?'day-selected':''} ${inRange?'day-in-range':''} ${day===todayInNewYork()?'day-today':''}`} onClick={()=>chooseDay(day)}>{i+1}</button>;})}</div></section>;
 };
 return <><button type="button" className="date-range-trigger" ref={trigger} aria-haspopup="dialog" aria-expanded={open} disabled={disabled} onClick={()=>{setDraft({start,end});setAnchor(monthStart(end||todayInNewYork(),-1));setPickingEnd(false);setError('');setOpen(true);}}><LuCalendar/><span>Date range</span><strong>{label}</strong><LuChevronDown/></button>{open&&createPortal(<div className="range-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)close();}}><section role="dialog" aria-modal="true" aria-labelledby="range-dialog-title" className="date-range-panel" ref={panel}><header><h2 id="range-dialog-title">Date range</h2><button type="button" className="range-close" aria-label="Close date range" onClick={close}><LuX/></button></header><div className="range-panel-body"><nav className="range-presets" aria-label="Date range presets">{presets.map(p=><button type="button" key={p.label} aria-pressed={draft.start===p.start&&draft.end===p.end} onClick={()=>{setDraft({start:p.start,end:p.end});setAnchor(monthStart(p.end||todayInNewYork(),-1));setPickingEnd(false);setError('');}}>{p.label}</button>)}</nav><div className="range-custom"><div className="range-fields"><label>Start<input type="date" value={draft.start} onChange={e=>{setDraft({...draft,start:e.target.value});setPickingEnd(false);setError('');if(e.target.value)setAnchor(monthStart(e.target.value,-1));}}/></label><label>End<input type="date" value={draft.end} onChange={e=>{setDraft({...draft,end:e.target.value});setError('');}}/></label></div><div className="range-calendar-nav"><button type="button" aria-label="Previous month" onClick={()=>setAnchor(monthStart(anchor,-1))}><LuChevronLeft/></button><label className="range-jump">Jump to month<input type="month" value={(compact?monthStart(anchor,1):anchor).slice(0,7)} onChange={e=>{if(e.target.value)setAnchor(monthStart(e.target.value+'-01',compact?-1:0));}}/></label><button type="button" aria-label="Next month" onClick={()=>setAnchor(monthStart(anchor,1))}><LuChevronRight/></button></div><div className="range-calendars">{!compact&&calendar(anchor)}{calendar(monthStart(anchor,1))}</div><p className="range-hint" role="status">{error|| (pickingEnd?'Choose the last day of your range.':'Choose a preset, or select a start and end day. Dates use New York time.')}</p></div></div><footer><button type="button" className="range-clear" onClick={()=>{setDraft({start:'',end:''});setPickingEnd(false);setError('');}}>Clear</button><button type="button" className="range-cancel" onClick={close}>Cancel</button><button type="button" className="range-apply" onClick={apply}>Apply</button></footer></section></div>,document.body)}</>;
}
