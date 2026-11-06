import React from 'react';
export default function RecoveryBanner({title, subtitle}) {
  return <section className="recovery-banner"><svg className="crayon-defs" aria-hidden="true"><defs><filter id="crayon-edge"><feTurbulence type="fractalNoise" baseFrequency=".045 .7" numOctaves="3" seed="12" result="grain"/><feDisplacementMap in="SourceGraphic" in2="grain" scale="2.2" xChannelSelector="R" yChannelSelector="G"/></filter></defs></svg><div className="banner-copy"><span className="banner-note">A little persistence. A lot of possibility.</span><h2>{title}</h2><p>{subtitle}</p></div><span className="banner-spark" aria-hidden="true">✳</span></section>;
}
