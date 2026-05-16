import { useMemo } from 'react';
import { parseISO, isThisMonth, isThisWeek, format, startOfMonth } from 'date-fns';
import { BarChart2, ShoppingBag, TrendingUp, Calendar, IndianRupee, Package } from 'lucide-react';

export default function AnalysePage({ items, purchases }) {
  const stats = useMemo(() => {
    if (!purchases.length) return null;

    const thisMonth = purchases.filter(p => isThisMonth(parseISO(p.purchased_at)));
    const thisWeek  = purchases.filter(p => isThisWeek(parseISO(p.purchased_at)));
    const spend     = thisMonth.reduce((s, p) => s + (p.quantity * (p.price_per_unit || 0)), 0);

    // Frequency per item
    const freq = {};
    for (const p of purchases) freq[p.item_id] = (freq[p.item_id] || 0) + 1;

    const topItems = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([id, count]) => ({ item: items.find(i => i.id === id), count }))
      .filter(x => x.item);

    // Category breakdown
    const catCount = {};
    for (const p of purchases) {
      const cat = p.grocery_items?.category || items.find(i => i.id === p.item_id)?.category || 'Other';
      catCount[cat] = (catCount[cat] || 0) + 1;
    }
    const topCats = Object.entries(catCount).sort((a, b) => b[1] - a[1]).slice(0, 6);

    // Monthly trend (last 6 months)
    const monthCounts = {};
    for (const p of purchases) {
      const key = format(parseISO(p.purchased_at), 'MMM yy');
      monthCounts[key] = (monthCounts[key] || 0) + 1;
    }
    const months = Object.entries(monthCounts)
      .sort((a, b) => new Date('01 ' + a[0]) - new Date('01 ' + b[0]))
      .slice(-6);

    // Avg days between purchases per item (for items with 2+)
    const itemIntervals = [];
    for (const item of items) {
      const dates = purchases
        .filter(p => p.item_id === item.id)
        .map(p => parseISO(p.purchased_at))
        .sort((a, b) => a - b);
      if (dates.length >= 2) {
        const gaps = [];
        for (let i = 1; i < dates.length; i++)
          gaps.push((dates[i] - dates[i-1]) / 86400000);
        const avg = Math.round(gaps.reduce((a,b) => a+b, 0) / gaps.length);
        itemIntervals.push({ item, avg, count: dates.length });
      }
    }
    itemIntervals.sort((a, b) => a.avg - b.avg);

    return { thisMonth: thisMonth.length, thisWeek: thisWeek.length, spend, topItems, topCats, months, itemIntervals: itemIntervals.slice(0, 6), totalPurchases: purchases.length };
  }, [items, purchases]);

  if (!purchases.length) return (
    <div className="empty-state"><BarChart2 size={40} /><p>Log some purchases to see analysis here.</p></div>
  );

  const maxTopItem = stats.topItems[0]?.count || 1;
  const maxCat     = stats.topCats[0]?.[1] || 1;
  const maxMonth   = Math.max(...stats.months.map(m => m[1]), 1);

  return (
    <div className="analyse-page">
      {/* Stats */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">This week</div>
          <div className="stat-val">{stats.thisWeek}</div>
          <div className="stat-sub">purchases</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">This month</div>
          <div className="stat-val">{stats.thisMonth}</div>
          <div className="stat-sub">purchases</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Month spend</div>
          <div className="stat-val">₹{Math.round(stats.spend).toLocaleString('en-IN')}</div>
          <div className="stat-sub">where price logged</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Items tracked</div>
          <div className="stat-val">{items.length}</div>
          <div className="stat-sub">{stats.totalPurchases} total logs</div>
        </div>
      </div>

      {/* Top purchased items */}
      {stats.topItems.length > 0 && (
        <div className="a-section">
          <div className="a-section-hd"><TrendingUp size={14} /> Most Purchased Items</div>
          {stats.topItems.map(({ item, count }) => (
            <div key={item.id} className="a-row">
              <div className="a-row-name">{item.name}</div>
              <div className="a-bar-wrap">
                <div className="a-bar-fill" style={{ width: `${(count / maxTopItem) * 100}%` }} />
              </div>
              <div className="a-row-val">{count}×</div>
              <div className="a-row-meta">{item.category}</div>
            </div>
          ))}
        </div>
      )}

      {/* Category breakdown */}
      {stats.topCats.length > 0 && (
        <div className="a-section">
          <div className="a-section-hd"><Package size={14} /> By Category</div>
          {stats.topCats.map(([cat, count]) => (
            <div key={cat} className="a-row">
              <div className="a-row-name">{cat}</div>
              <div className="a-bar-wrap">
                <div className="a-bar-fill" style={{ width: `${(count / maxCat) * 100}%` }} />
              </div>
              <div className="a-row-val">{count}</div>
              <div className="a-row-meta">purchases</div>
            </div>
          ))}
        </div>
      )}

      {/* Monthly trend */}
      {stats.months.length > 1 && (
        <div className="a-section">
          <div className="a-section-hd"><Calendar size={14} /> Monthly Trend</div>
          {stats.months.map(([month, count]) => (
            <div key={month} className="a-row">
              <div className="a-row-name">{month}</div>
              <div className="a-bar-wrap">
                <div className="a-bar-fill" style={{ width: `${(count / maxMonth) * 100}%` }} />
              </div>
              <div className="a-row-val">{count}</div>
              <div className="a-row-meta">purchases</div>
            </div>
          ))}
        </div>
      )}

      {/* Reorder frequency */}
      {stats.itemIntervals.length > 0 && (
        <div className="a-section">
          <div className="a-section-hd"><ShoppingBag size={14} /> Reorder Frequency (avg days)</div>
          {stats.itemIntervals.map(({ item, avg, count }) => (
            <div key={item.id} className="a-row">
              <div className="a-row-name">{item.name}</div>
              <div className="a-row-val" style={{ minWidth: 60 }}>Every {avg}d</div>
              <div className="a-row-meta">{count} logs</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
