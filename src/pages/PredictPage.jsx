import { useMemo } from 'react';
import { formatDistanceToNow, parseISO, differenceInDays } from 'date-fns';
import { Sparkles, AlertCircle, Clock, CalendarCheck, TrendingUp, ShoppingBag } from 'lucide-react';
import { computeRecommendations } from '../lib/recommendations';

export default function PredictPage({ items, purchases }) {
  const recs = useMemo(() => computeRecommendations(items, purchases), [items, purchases]);

  // Classify into 4 buckets
  const overdue  = recs.filter(r => r.urgency === 'overdue');
  const today    = recs.filter(r => r.urgency === 'today');
  const soon     = recs.filter(r => r.urgency === 'due-soon');
  const upcoming = recs.filter(r => r.urgency === 'upcoming');

  if (items.length === 0) return (
    <div className="empty-state"><ShoppingBag size={40} /><p>Add items and log purchases to see predictions.</p></div>
  );
  if (recs.length === 0) return (
    <div className="empty-state"><Sparkles size={40} /><p>No items due yet. Keep logging and we'll predict your restock needs!</p></div>
  );

  const Card = ({ rec }) => {
    const pct = Math.min((rec.daysSinceLast / rec.avgDaysBetween) * 100, 110);
    const statusClass = rec.urgency === 'overdue' ? 'p-overdue'
      : rec.urgency === 'today' ? 'p-today'
      : rec.urgency === 'due-soon' ? 'p-soon'
      : 'p-upcoming';
    const pillClass = rec.urgency === 'overdue' ? 'overdue'
      : rec.urgency === 'today' ? 'today'
      : rec.urgency === 'due-soon' ? 'soon'
      : 'upcoming';
    const pillLabel = rec.urgency === 'overdue'
      ? `${rec.daysSinceLast - rec.avgDaysBetween}d overdue`
      : rec.urgency === 'today' ? 'Buy today'
      : rec.urgency === 'due-soon' ? `Due in ~${rec.daysUntilNext}d`
      : `~${rec.daysUntilNext}d away`;
    const confClass = rec.confidence === 'high' ? 'conf-high' : rec.confidence === 'medium' ? 'conf-med' : 'conf-low';

    return (
      <div className={`predict-card ${statusClass}`}>
        <div className="predict-top">
          <div>
            <div className="predict-name">{rec.item.name}</div>
            <div className="predict-cat">{rec.item.category} · {rec.item.unit}</div>
          </div>
          <span className={`s-pill ${pillClass}`}>{pillLabel}</span>
        </div>

        <div className="predict-bar-wrap">
          <div className="predict-bar">
            <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, borderRadius: 4, transition: 'width .5s' }} />
          </div>
          <span className="predict-pct">{Math.round(pct)}%</span>
        </div>

        <div className="predict-meta">
          <div className="pm-item"><TrendingUp size={11} /> Every ~{rec.avgDaysBetween}d</div>
          <div className="pm-item"><Clock size={11} /> Last: {formatDistanceToNow(new Date(rec.lastPurchased), { addSuffix: true })}</div>
          <div className="pm-item"><ShoppingBag size={11} /> {rec.purchaseCount} purchase{rec.purchaseCount !== 1 ? 's' : ''}</div>
        </div>

        <div className="predict-footer">
          <span className={`conf ${confClass}`}>{rec.confidence} confidence</span>
        </div>
      </div>
    );
  };

  const Section = ({ title, items: list, color }) => {
    if (!list.length) return null;
    return (
      <div>
        <div style={{ fontSize: '.72rem', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }} />
          {title} ({list.length})
        </div>
        {list.map(r => <Card key={r.item.id} rec={r} />)}
      </div>
    );
  };

  return (
    <div className="predict-page">
      <div className="predict-legend">
        <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--danger)' }} />Overdue</div>
        <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--warn)' }} />Due today</div>
        <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--success)' }} />Due soon</div>
        <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--border2)' }} />Upcoming</div>
      </div>

      <Section title="Overdue — Buy Now" items={overdue} color="var(--danger)" />
      <Section title="Due Today" items={today} color="var(--warn)" />
      <Section title="Due Soon" items={soon} color="var(--success)" />
      <Section title="Upcoming" items={upcoming} color="var(--text3)" />
    </div>
  );
}
