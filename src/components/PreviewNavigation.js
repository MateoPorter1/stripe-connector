import RecoveryLogo from './RecoveryLogo';
import React from 'react';
import {useLocation} from 'react-router-dom';
import {LuArrowUpRight} from 'react-icons/lu';
export default function PreviewNavigation(){const {pathname}=useLocation();const insights=pathname.endsWith('/insights');return <header className="desk-navigation"><a href="/design-preview" className="desk-brand"><RecoveryLogo/><span> / </span></a><nav aria-label="Workspace navigation"><a href="/design-preview" aria-current={!insights?'page':undefined}>Collections</a><a href="/design-preview/insights" aria-current={insights?'page':undefined}>Insights</a></nav><span className="desk-demo"><i/>Demo workspace <LuArrowUpRight/></span><span className="desk-account" aria-label="Demo account">D</span></header>;}
