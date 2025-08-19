import React from "react";
export default function WithdrawModal({ open, onClose, balance, onSubmit }) {
  const [amount, setAmount] = React.useState(100);
  const [binance, setBinance] = React.useState("");
  React.useEffect(()=>{ setAmount(100); setBinance(""); }, [open]);
  if (!open) return null;
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e)=>e.stopPropagation()}>
        <h3 style={{margin:0}}>Withdraw</h3>
        <div className="small-muted">Available: VET {Number(balance).toFixed(2)}</div>
        <div style={{marginTop:12}}>
          <label>Amount (VET)</label>
          <input className="input" type="number" min="100" value={amount} onChange={(e)=>setAmount(e.target.value)} />
        </div>
        <div style={{marginTop:12}}>
          <label>Binance UID</label>
          <input className="input" value={binance} onChange={(e)=>setBinance(e.target.value)} />
        </div>
        <div style={{display:'flex',gap:8,marginTop:12}}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-watch" onClick={()=>onSubmit({amount, binance})}>Submit</button>
        </div>
      </div>
    </div>
  );
}
