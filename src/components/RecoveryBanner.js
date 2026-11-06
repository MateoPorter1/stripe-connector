import React from 'react';
export default function RecoveryBanner({title, subtitle}) {
  return <section className="recovery-banner"><div className="banner-copy"><span className="banner-note">A little persistence. A lot of possibility.</span><h2>{title}</h2><p>{subtitle}</p></div><span className="banner-spark" aria-hidden="true">✳</span></section>;
}
