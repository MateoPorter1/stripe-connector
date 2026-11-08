import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {Simulate} from 'react-dom/test-utils';
import DateRangePicker,{rangePresets} from './DateRangePicker';
let root,container,apply;
const button=name=>[...document.querySelectorAll('button')].find(b=>b.textContent===name||b.getAttribute('aria-label')===name);
const click=async name=>act(async()=>button(name).click());
beforeEach(()=>{global.IS_REACT_ACT_ENVIRONMENT=true;container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);apply=jest.fn();});
afterEach(()=>{act(()=>root.unmount());container.remove();});
const mount=async props=>act(async()=>root.render(<DateRangePicker start="2026-10-01" end="2026-11-08" onApply={apply} {...props}/>));
const open=async()=>act(async()=>container.querySelector('button').click());
test('panel edits are drafts: presets and calendars never apply until Apply; cancel restores current selection',async()=>{
 await mount();expect(document.querySelector('input')).toBeNull();await open();await click('Today');expect(apply).not.toHaveBeenCalled();await click('Cancel');expect(apply).not.toHaveBeenCalled();await open();expect(document.querySelector('.range-fields input').value).toBe('2026-10-01');await click('Apply');expect(apply).toHaveBeenCalledWith({start:'2026-10-01',end:'2026-11-08'});
});
test('selects a range across two months inclusively and applies exact date-only values',async()=>{
 await mount();await open();await click('Oct 31, 2026');await click('Nov 2, 2026');expect(apply).not.toHaveBeenCalled();await click('Apply');expect(apply).toHaveBeenCalledWith({start:'2026-10-31',end:'2026-11-02'});
});
test('invalid manual ranges stay open; escape closes without applying and returns focus',async()=>{
 await mount();await open();await act(async()=>Simulate.change(document.querySelector('.range-fields input'),{target:{value:'2026-12-01'}}));await click('Apply');expect(apply).not.toHaveBeenCalled();expect(document.body.textContent).toContain('start date must come before');await act(async()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));expect(document.querySelector('[role="dialog"]')).toBeNull();expect(document.activeElement).toBe(container.querySelector('button'));
});
test('Clear cannot submit an empty invoice filter when all-time is disabled',async()=>{
 await mount({allowAllTime:false});await open();expect(button('All time')).toBeUndefined();await click('Clear');await click('Apply');expect(apply).not.toHaveBeenCalled();expect(document.body.textContent).toContain('Choose a start and end date.');
});
test('presets keep calendar dates across DST, year and quarter boundaries',()=>{
 const preset=(date,label)=>rangePresets(date).find(p=>p.label===label);
 expect(preset('2026-11-08','Last 7 days')).toMatchObject({start:'2026-11-02',end:'2026-11-08'});
 expect(preset('2026-01-03','Last 4 weeks').start).toBe('2025-12-07');
 expect(preset('2026-11-08','Quarter to date').start).toBe('2026-10-01');
 expect(preset('2026-02-08','Last 6 months').start).toBe('2025-09-01');
});
