import { useState, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { Search, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { CATEGORIES } from '../lib/recommendations';

export default function EntriesPage({ purchases, items, deletePurchase }) {
  const [search,   setSearch]   = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');
  const [sortCol,  setSortCol]  = useState('purchased_at');
  const [sortDir,  setSortDir]  = useState('desc');
  const [confirm,  setConfirm]  = useState(null);

  const itemMap = useMemo(() => {
    const m = {};
    for (const i of items) m[i.id] = i;
    return m;
  }, [items]);

  const filtered = useMemo(() => {
    let rows = purchases.map(p => ({
      ...p,
      itemObj: itemMap[p.item_id] || p.grocery_items || {}
    }));

    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(p =>
        (p.itemObj.name || '').toLowerCase().includes(q) ||
        (p.store || '').toLowerCase().includes(q) ||
        (p.notes || '').toLowerCase().includes(q)
      );
    }
    if (catFilter) {
      rows = rows.filter(p => (p.itemObj.category || p.grocery_items?.category) === catFilter);
    }
    if (dateFrom) rows = rows.filter(p => p.purchased_at >= new Date(dateFrom).toISOString());
    if (dateTo)   rows = rows.filter(p => p.purchased_at <= new Date(dateTo + 'T23:59:59').toISOString());

    rows.sort((a, b) => {
      let av, bv;
      if (sortCol === 'purchased_at') { av = a.purchased_at; bv = b.purchased_at; }
      else if (sortCol === 'name')    { av = (a.itemObj.name||''); bv = (b.itemObj.name||''); }
      else if (sortCol === 'qty')     { av = a.quantity; bv = b.quantity; }
      else if (sortCol === 'cat')     { av = (a.itemObj.category||''); bv = (b.itemObj.category||''); }
      else if (sortCol === 'store')   { av = (a.store||''); bv = (b.store||''); }
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return rows;
  }, [purchases, search, catFilter, dateFrom, dateTo, sortCol, sortDir, itemMap]);

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  };

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <span style={{ opacity: .3 }}>↕</span>;
    return sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />;
  };

  return (
    <div className="entries-page">
      {/* Filters */}
      <div className="filter-grid">
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={13} style={{ position: 'absolute', left: 9, color: 'var(--text3)', pointerEvents: 'none' }} />
          <input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 28 }} />
        </div>
        <div style={{ position: 'relative' }}>
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)} style={{ paddingRight: 20 }}>
            <option value="">All categories</option>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <ChevronDown size={11} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text3)' }} />
        </div>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          placeholder="From date" style={{ fontSize: '.77rem' }} />
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          placeholder="To date" style={{ fontSize: '.77rem' }} />
      </div>

      <div className="entries-count">{filtered.length} entr{filtered.length === 1 ? 'y' : 'ies'}</div>

      {filtered.length === 0 ? (
        <div className="empty-state"><Search size={36} /><p>No entries match your filters.</p></div>
      ) : (
        <div className="entries-table">
          <div className="entries-head">
            <span onClick={() => toggleSort('name')}>Item <SortIcon col="name" /></span>
            <span onClick={() => toggleSort('purchased_at')}>Date <SortIcon col="purchased_at" /></span>
            <span onClick={() => toggleSort('qty')}>Qty <SortIcon col="qty" /></span>
            <span onClick={() => toggleSort('cat')}>Category <SortIcon col="cat" /></span>
            <span onClick={() => toggleSort('store')}>Store <SortIcon col="store" /></span>
            <span></span>
          </div>
          {filtered.map(p => (
            <div key={p.id} className="entries-row">
              <div>
                <div className="e-name">{p.itemObj.name || p.grocery_items?.name}</div>
              </div>
              <div className="e-date">{format(parseISO(p.purchased_at), 'dd MMM yy')}</div>
              <div className="e-qty">{p.quantity} {p.itemObj.unit || p.grocery_items?.unit || ''}</div>
              <div className="e-cat">{p.itemObj.category || p.grocery_items?.category}</div>
              <div className="e-store">{p.store || '—'}</div>
              <div>
                {confirm === p.id ? (
                  <div style={{ display: 'flex', gap: 3 }}>
                    <button style={{ fontSize: '.65rem', background: 'var(--danger-bg)', color: 'var(--danger)', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}
                      onClick={() => { deletePurchase(p.id); setConfirm(null); }}>Del</button>
                    <button style={{ fontSize: '.65rem', color: 'var(--text2)', padding: '2px 4px' }}
                      onClick={() => setConfirm(null)}>✕</button>
                  </div>
                ) : (
                  <button className="e-del" onClick={() => setConfirm(p.id)}><Trash2 size={13} /></button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
