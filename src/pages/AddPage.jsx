import { useState } from 'react';
import { format } from 'date-fns';
import { Plus, ChevronDown, Check, Trash2 } from 'lucide-react';
import { CATEGORIES, UNITS } from '../lib/recommendations';

export default function AddPage({ items, purchases, addItem, logPurchase, deleteItem }) {
  const [name, setName]   = useState('');
  const [date, setDate]   = useState(format(new Date(), 'yyyy-MM-dd'));
  const [qty,  setQty]    = useState('1');
  const [unit, setUnit]   = useState('pcs');
  const [cat,  setCat]    = useState('Other');
  const [busy, setBusy]   = useState(false);
  const [toast, setToast] = useState('');

  // Editable state per row  { id: { field: value } }
  const [edits, setEdits] = useState({});

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  const handleAdd = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      // Find or create item
      let item = items.find(i => i.name.toLowerCase() === name.trim().toLowerCase());
      if (!item) item = await addItem(name.trim(), cat, unit);
      // Log purchase
      await logPurchase({
        item_id: item.id,
        quantity: parseFloat(qty) || 1,
        price_per_unit: null,
        store: null,
        notes: null,
        purchased_at: new Date(date).toISOString()
      });
      showToast(`✓ Added ${qty} ${unit} of ${name.trim()}`);
      setName(''); setQty('1');
    } catch (e) {
      showToast('Error: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleKey = (e) => { if (e.key === 'Enter') handleAdd(); };

  // Get latest purchase per item for display
  const latestByItem = {};
  for (const p of purchases) {
    if (!latestByItem[p.item_id] || p.purchased_at > latestByItem[p.item_id].purchased_at) {
      latestByItem[p.item_id] = p;
    }
  }

  const setEdit = (id, field, val) =>
    setEdits(prev => ({ ...prev, [id]: { ...prev[id], [field]: val } }));

  const getEdit = (id, field, fallback) =>
    edits[id]?.[field] !== undefined ? edits[id][field] : fallback;

  const handleSaveRow = async (item) => {
    const e = edits[item.id] || {};
    if (e.name && e.name !== item.name) {
      // Name changed — not editable via this flow, skip
    }
    // Save a new purchase entry if qty/date changed
    const qty2 = parseFloat(e.qty || latestByItem[item.id]?.quantity || 1);
    const date2 = e.date || (latestByItem[item.id]
      ? format(new Date(latestByItem[item.id].purchased_at), 'yyyy-MM-dd')
      : format(new Date(), 'yyyy-MM-dd'));
    await logPurchase({
      item_id: item.id,
      quantity: qty2,
      price_per_unit: null,
      store: null,
      notes: 'Edited from list',
      purchased_at: new Date(date2).toISOString()
    });
    setEdits(prev => { const n = { ...prev }; delete n[item.id]; return n; });
    showToast('✓ Entry updated');
  };

  return (
    <div className="add-page">
      {toast && <div className="success-toast">{toast}</div>}

      {/* ── Input row ── */}
      <div>
        <div className="add-row-header">
          <span>Item name</span>
          <span>Date</span>
          <span>Qty</span>
          <span>Unit</span>
          <span></span>
        </div>
        <div style={{ height: 5 }} />
        <div className="add-row">
          <input
            placeholder="e.g. Milk, Rice…"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={handleKey}
            list="item-suggestions"
          />
          <datalist id="item-suggestions">
            {items.map(i => <option key={i.id} value={i.name} />)}
          </datalist>

          <input type="date" value={date} onChange={e => setDate(e.target.value)} />

          <input
            type="number" value={qty} min="0.01" step="any"
            onChange={e => setQty(e.target.value)}
            style={{ textAlign: 'center' }}
          />

          <div style={{ position: 'relative' }}>
            <select value={unit} onChange={e => setUnit(e.target.value)} style={{ paddingRight: 20 }}>
              {UNITS.map(u => <option key={u}>{u}</option>)}
            </select>
          </div>

          <button className="plus-btn" onClick={handleAdd} disabled={busy || !name.trim()}>
            <Plus size={18} />
          </button>
        </div>

        {/* Category row (secondary) */}
        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '.73rem', color: 'var(--text3)' }}>Category:</span>
          <div style={{ position: 'relative', flex: 1, maxWidth: 160 }}>
            <select value={cat} onChange={e => setCat(e.target.value)} style={{ height: 30, fontSize: '.76rem', paddingRight: 20 }}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
            <ChevronDown size={11} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text3)' }} />
          </div>
          <span style={{ fontSize: '.73rem', color: 'var(--text3)' }}>for new items</span>
        </div>
      </div>

      {/* ── Items table ── */}
      {items.length === 0 ? (
        <div className="empty-state" style={{ padding: '32px 0' }}>
          <Plus size={36} />
          <p>No items yet. Type a name above and tap + to add your first entry.</p>
        </div>
      ) : (
        <div className="items-table">
          <div className="items-table-head">
            <span>Item</span>
            <span>Last date</span>
            <span>Qty</span>
            <span>Unit</span>
            <span>Actions</span>
          </div>
          {items.map(item => {
            const last = latestByItem[item.id];
            const lastDate = last ? format(new Date(last.purchased_at), 'dd MMM yy') : '—';
            const lastQty  = last ? last.quantity : '—';
            const dirty = !!edits[item.id];

            return (
              <div key={item.id} className="items-table-row">
                <div>
                  <div style={{ fontWeight: 500, fontSize: '.8rem' }}>{item.name}</div>
                  <div style={{ fontSize: '.68rem', color: 'var(--text3)' }}>{item.category}</div>
                </div>
                <input
                  type="date"
                  defaultValue={last ? format(new Date(last.purchased_at), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')}
                  onChange={e => setEdit(item.id, 'date', e.target.value)}
                  style={{ fontSize: '.74rem' }}
                />
                <input
                  type="number" defaultValue={lastQty} min="0.01" step="any"
                  onChange={e => setEdit(item.id, 'qty', e.target.value)}
                  style={{ textAlign: 'center' }}
                />
                <div style={{ fontSize: '.78rem', color: 'var(--text2)', paddingLeft: 4 }}>{item.unit}</div>
                <div className="row-actions">
                  {dirty && (
                    <button className="row-save" onClick={() => handleSaveRow(item)}>
                      <Check size={11} style={{ display: 'inline', marginRight: 2 }} />Save
                    </button>
                  )}
                  <button className="row-del" onClick={() => deleteItem(item.id)}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
