import React from "react";
export default function BalanceCard({ balance, totalAds, todayAds, dailyLimit }) {
  return (
    <div className="card">
      <div className="label">Current Balance</div>
      <div className="amount">VET {Number(balance).toFixed(2)}</div>
      <div className="stats">
        <div>
          <div className="num">{totalAds}</div>
          <div className="small">Total Ads Watched</div>
        </div>
        <div>
          <div className="num">{todayAds} / {dailyLimit}</div>
          <div className="small">Today's Ads</div>
        </div>
      </div>
    </div>
  );
}
