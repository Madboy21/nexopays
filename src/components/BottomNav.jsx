import React from "react";
export default function BottomNav({ tab, setTab }) {
  return (
    <div className="footer-nav">
      <div className="nav-inner">
        <button className={`nav-btn ${tab==='home'?'active':''}`} onClick={()=>setTab('home')}>Home</button>
        <button className={`nav-btn ${tab==='withdraw'?'active':''}`} onClick={()=>setTab('withdraw')}>Withdraw</button>
        <button className={`nav-btn ${tab==='referrals'?'active':''}`} onClick={()=>setTab('referrals')}>Referrals</button>
      </div>
    </div>
  );
}
