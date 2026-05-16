import { useMemo } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { Sparkles, AlertCircle, Clock, CalendarCheck, TrendingUp, ShoppingBag } from 'lucide-react';
import { computeRecommendations } from '../lib/recommendations';

const urgencyConfig = {
  overdue: { icon: AlertCircle, label: 'Overdue', color: '#ff6b6b' },
  'due-soon': { icon: Clock, label: 'Due Soon', color: '#ffa94d' },
  upcoming: { icon: CalendarCheck, label: 'Upcoming', color: '#69db7c' }
};

export default function RecommendationsPage({ items, purchases }) {
  const recs = useMemo(() => computeRecommendations(items, purchases), [items, purchases]);

  if (items.length === 0) return (
    <div className="empty-state">
      <ShoppingBag size={48} opacity={0.3} />
      <p>Add items and log some purchases to see smart recommendations here.</p>
    </div>
  );

  if (recs.length === 0) return (
    <div className="empty-state">
      <Sparkles size={48} opacity={0.3} />
      <p>No items are due yet. Keep logging your purchases and we'll predict your needs!</p>
    </div>
  );

  return (
    <div className="recs-page">
      <div className="page-header">
        <Sparkles size={20} />
        <h2>Smart Recommendations</h2>
        <span className="badge">{recs.length}</span>
      </div>

      <div className="recs-grid">
        {recs.map(rec => {
          const cfg = urgencyConfig[rec.urgency];
          const Icon = cfg.icon;
          const pct = Math.min((rec.daysSinceLast / rec.avgDaysBetween) * 100, 100);

          return (
            <div key={rec.item.id} className={`rec-card urgency-${rec.urgency}`}>
              <div className="rec-top">
                <div className="rec-name-row">
                  <span className="rec-name">{rec.item.name}</span>
                  <span className="rec-cat">{rec.item.category}</span>
                </div>
                <div className="rec-badge" style={{ color: cfg.color }}>
                  <Icon size={14} />
                  <span>{cfg.label}</span>
                </div>
              </div>

              <div className="rec-bar-wrap">
                <div className="rec-bar">
                  <div className="rec-bar-fill" style={{ width: `${pct}%`, background: cfg.color }} />
                </div>
                <span className="rec-pct">{Math.round(pct)}%</span>
              </div>

              <div className="rec-meta">
                <div className="rec-meta-item">
                  <TrendingUp size={12} />
                  <span>Every ~{rec.avgDaysBetween}d</span>
                </div>
                <div className="rec-meta-item">
                  <Clock size={12} />
                  <span>Last: {formatDistanceToNow(new Date(rec.lastPurchased), { addSuffix: true })}</span>
                </div>
                {rec.urgency === 'overdue' ? (
                  <div className="rec-meta-item overdue-text">
                    <AlertCircle size={12} />
                    <span>{rec.daysSinceLast - rec.avgDaysBetween}d overdue</span>
                  </div>
                ) : (
                  <div className="rec-meta-item">
                    <CalendarCheck size={12} />
                    <span>Due in ~{rec.daysUntilNext}d</span>
                  </div>
                )}
              </div>

              <div className="rec-footer">
                <span className={`confidence confidence-${rec.confidence}`}>
                  {rec.confidence} confidence
                </span>
                <span className="purchase-count">{rec.purchaseCount} purchase{rec.purchaseCount !== 1 ? 's' : ''} logged</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
