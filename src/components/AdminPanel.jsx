import React, { useEffect, useState } from "react";

export default function AdminPanel({ profile }) {
  const [items, setItems] = useState([]);
  useEffect(()=>{ if (profile?.isAdmin) fetchList(); }, [profile]);

  async function fetchList(){
    try{
      const url = import.meta.env.VITE_FN_LIST_WITHDRAWS_URL + `?adminUid=${profile.uid}`;
      const res = await fetch(url);
      const j = await res.json();
      if (j.ok) setItems(j.items || []);
    }catch(e){ console.error(e); }
  }

  async function decide(id, decision){
    try{
      const res = await fetch(import.meta.env.VITE_FN_DECIDE_WITHDRAW_URL, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ adminUid: profile.uid, requestId: id, decision })
      });
      const j = await res.json();
      if (j.ok) fetchList();
      else alert(j.error || 'failed');
    }catch(e){ console.error(e); alert('error'); }
  }

  if (!profile?.isAdmin) return null;
  return (
    <div style={{marginTop:10}}>
      <h4>Admin — Withdraws</h4>
      {items.length===0 && <div style={{color:'#666'}}>No pending</div>}
      {items.map(it=>(
        <div key={it.id} style={{padding:10,background:'#fff',borderRadius:8,marginTop:8}}>
          <div><b>{it.amountTokens} VET</b> from {it.userId}</div>
          <div>UID: {it.binanceUID}</div>
          <div style={{marginTop:8,display:'flex',gap:8}}>
            <button className="btn" onClick={()=>decide(it.id,'approved')}>Approve</button>
            <button className="btn btn-withdraw" onClick={()=>decide(it.id,'rejected')}>Reject</button>
          </div>
        </div>
      ))}
    </div>
  );
}
