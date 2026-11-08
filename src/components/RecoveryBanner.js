import React from 'react';
export default function RecoveryBanner({title, subtitle}) {
  return <header className="recovery-banner"><div className="banner-copy"><span className="banner-note">Workspace / Payment recovery</span><h1>{title}</h1><p>{subtitle}</p></div><span className="banner-state">Manual start</span></header>;
}
