import { useMemo } from 'react';
import { format, parseISO, startOfMonth, isThisMonth, isThisWeek } from 'date-fns';
import { ShoppingCart, TrendingUp, Package, Sparkles, IndianRupee, CalendarDays } from 'lucide-react';
import { computeRecommendations } from '../lib/recommendations';

export default function DashboardPage({ items, purchases, onNavigate }) {
  const stats = useMemo(() => {
    const thisMonth = purchases.filter(p => isThisMonth(parseISO(p.purchased_at)));
    const thisWeek = purchases.filter(p => isThisWeek(parseISO(p.purchased_at)));
    const spend = thisMonth.reduce((s, p) =>
      s + (p.quantity * (p.price_per_unit || 0)), 0);

    // top items by count
    const freq = {};
    for (const p of purchases) {
      freq[p.item_id] = (freq[p.item_id] || 0) + 1;
    }
    const topItems = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => ({ item: items.find(i => i.id === id), count }))
      .filter(x => x.item);

    return { thisMonthCount: thisMonth.length, thisWeekCount: thisWeek.length, spend, topItems };
  }, [items, purchases]);

  const recs = useMemo(() => computeRecommendations(items, purchases), [items, purchases]);
  const urgent = recs.filter(r => r.urgency === 'overdue' || r.urgency === 'due-soon').slice(0, 3);

  return (
    <div className="dashboard">
      <div className="dash-stats">
        <div className="stat-card">
          <ShoppingCart size={20} />
          <div>
            <span className="stat-val">{stats.thisWeekCount}</span>
            <span className="stat-label">This week</span>
          </div>
        </div>
        <div className="stat-card">
          <CalendarDays size={20} />
          <div>
            <span className="stat-val">{stats.thisMonthCount}</span>
            <span className="stat-label">This month</span>
          </div>
        </div>
        <div className="stat-card">
          <IndianRupee size={20} />
          <div>
            <span className="stat-val">₹{Math.round(stats.spend).toLocaleString('en-IN')}</span>
            <span className="stat-label">Month spend</span>
          </div>
        </div>
        <div className="stat-card">
          <Package size={20} />
          <div>
            <span className="stat-val">{items.length}</span>
            <span className="stat-label">Items tracked</span>
          </div>
        </div>
      </div>

      {urgent.length > 0 && (
        <div className="dash-section">
          <div className="section-header">
            <Sparkles size={16} />
            <h3>Needs Attention</h3>
            <button className="see-all" onClick={() => onNavigate('recs')}>See all →</button>
          </div>
          {urgent.map(rec => (
            <div key={rec.item.id} className={`dash-rec-row urgency-${rec.urgency}`}>
              <span className="dash-rec-name">{rec.item.name}</span>
              <span className="dash-rec-status">
                {rec.urgency === 'overdue'
                  ? `${rec.daysSinceLast - rec.avgDaysBetween}d overdue`
                  : `Due in ~${rec.daysUntilNext}d`}
              </span>
            </div>
          ))}
        </div>
      )}

      {stats.topItems.length > 0 && (
        <div className="dash-section">
          <div className="section-header">
            <TrendingUp size={16} />
            <h3>Most Purchased</h3>
          </div>
          {stats.topItems.map(({ item, count }) => (
            <div key={item.id} className="dash-top-row">
              <span className="dash-top-name">{item.name}</span>
              <div className="dash-top-bar-wrap">
                <div className="dash-top-bar"
                  style={{ width: `${(count / stats.topItems[0].count) * 100}%` }} />
              </div>
              <span className="dash-top-count">{count}×</span>
            </div>
          ))}
        </div>
      )}

      {purchases.length === 0 && (
        <div className="empty-state">
          <ShoppingCart size={48} opacity={0.3} />
          <p>Welcome to GroCart! Start by adding items in the Log tab, then record your first purchase.</p>
        </div>
      )}
    </div>
  );
}
