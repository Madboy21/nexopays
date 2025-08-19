import React, { useEffect, useState } from "react";
import { signInWithToken } from "./firebase";
import { getTelegramContext } from "./tgAuth";
import BalanceCard from "./components/BalanceCard";
import BottomNav from "./components/BottomNav";
import WithdrawModal from "./components/WithdrawModal";
import AdminPanel from "./components/AdminPanel";

const SUBUNITS_PER_TOKEN = 1000;
const DAILY_LIMIT = 25;
const MIN_WITHDRAW_SUBUNITS = 100 * SUBUNITS_PER_TOKEN;

export default function App(){
  const [uid, setUid] = useState("");
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("home");
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  useEffect(()=>{
    (async ()=>{
      setLoading(true);
      const tg = getTelegramContext();
      if (!tg) { setLoading(false); return; } // local dev mode
      try{
        const resp = await fetch(import.meta.env.VITE_FN_AUTH_URL, {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ initData: tg.initData, initDataUnsafe: tg.initDataUnsafe, ref: new URLSearchParams(window.location.search).get('startapp') || null })
        });
        const j = await resp.json();
        if (!j.ok) { alert(j.error || 'auth failed'); setLoading(false); return; }
        await signInWithToken(j.customToken);
        setUid(j.uid);
        await loadProfile(j.uid);
      }catch(e){ console.error(e); alert('Auth error'); setLoading(false); return; }
      setLoading(false);
    })();
  },[]);

  async function loadProfile(targetUid){
    try{
      const resp = await fetch(import.meta.env.VITE_FN_PROFILE_URL, {
        method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ uid: targetUid })
      });
      const j = await resp.json();
      if (j.ok) setProfile(j.profile);
    }catch(e){ console.error(e); }
  }

  async function handleWatchAd(){
    if (!profile) return;
    try{
      const res = await fetch(import.meta.env.VITE_FN_INCREMENT_AD_URL, {
        method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ uid: profile.uid })
      });
      const j = await res.json();
      if (!j.ok) { alert(j.error || 'Failed'); return; }
      await loadProfile(profile.uid);
    }catch(e){ console.error(e); alert('Error'); }
  }

  async function handleRequestWithdraw({amount, binance}){
    if (!profile) return;
    try{
      const res = await fetch(import.meta.env.VITE_FN_CREATE_WITHDRAW_URL, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ uid: profile.uid, amountTokens: Number(amount), binanceUID: binance })
      });
      const j = await res.json();
      if (j.ok) { alert('Withdraw requested'); setWithdrawOpen(false); await loadProfile(profile.uid); setTab('home'); }
      else alert(j.error || 'Failed');
    }catch(e){ console.error(e); alert('error'); }
  }

  // local/test mode
  if (!profile && !loading) {
    return (
      <div className="container">
        <div style={{padding:16,background:'#fff',borderRadius:12}}>
          <h3>Local/Test mode</h3>
          <p className="small-muted">No Telegram WebApp detected. Enter your test UID and press Load.</p>
          <input placeholder="telegram id (e.g., 12345)" className="input" onChange={(e)=>setUid(e.target.value)} value={uid} />
          <div style={{display:'flex',gap:8, marginTop:8}}>
            <button className="btn btn-watch" onClick={async ()=>{ if (!uid) return alert('enter uid'); await loadProfile(uid); }}>Load Profile</button>
            <button className="btn" onClick={()=>{ window.location.reload(); }}>Reload</button>
          </div>
        </div>
      </div>
    );
  }

  const balance = (profile?.balanceSubunits ?? 0) / SUBUNITS_PER_TOKEN;
  const todayAds = profile?.todayAds ?? 0;
  const totalAds = profile?.lifetimeAds ?? 0;

  const canWatch = todayAds < DAILY_LIMIT;
  const canWithdraw = (profile?.balanceSubunits ?? 0) >= MIN_WITHDRAW_SUBUNITS;

  return (
    <div className="container">
      <div className="small-note">Watch Ads and Earn Vet</div>
      <div className="ribbon">Minimum Withdraw: <b>100 VET</b> · Daily Ad Limit: <b>{DAILY_LIMIT}</b></div>

      <BalanceCard balance={balance} totalAds={totalAds} todayAds={todayAds} dailyLimit={DAILY_LIMIT} />

      <div style={{marginTop:12}}>
        <button className="btn btn-watch" disabled={!canWatch} onClick={handleWatchAd}>
          {canWatch ? `Watch Ad (+0.5 VET)` : 'Daily Limit Reached'}
        </button>

        <button className="btn btn-withdraw" disabled={!canWithdraw} onClick={()=>setWithdrawOpen(true)}>
          {canWithdraw ? 'Withdraw' : 'Reach 100.00 VET to Withdraw'}
        </button>
      </div>

      <AdminPanel profile={profile} />

      <BottomNav tab={tab} setTab={setTab} />

      <WithdrawModal open={withdrawOpen} onClose={()=>setWithdrawOpen(false)} balance={balance} onSubmit={handleRequestWithdraw} />
    </div>
  );
}
