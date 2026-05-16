import { useState } from 'react';
import { format } from 'date-fns';
import { Plus, Search, ShoppingCart, Package, X, ChevronDown } from 'lucide-react';
import { CATEGORIES, UNITS } from '../lib/recommendations';

export default function LogPage({ items, purchases, addItem, logPurchase }) {
  const [tab, setTab] = useState('log'); // 'log' | 'add-item'
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [qty, setQty] = useState('1');
  const [price, setPrice] = useState('');
  const [store, setStore] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState('');

  // Add-item form
  const [newName, setNewName] = useState('');
  const [newCat, setNewCat] = useState('Other');
  const [newUnit, setNewUnit] = useState('pcs');

  const filtered = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));

  const handleLog = async (e) => {
    e.preventDefault();
    if (!selectedItem) return;
    setBusy(true);
    try {
      await logPurchase({
        item_id: selectedItem.id,
        quantity: parseFloat(qty),
        price_per_unit: price ? parseFloat(price) : null,
        store: store || null,
        notes: notes || null,
        purchased_at: new Date(date).toISOString()
      });
      setSuccess(`✓ Logged ${qty} ${selectedItem.unit} of ${selectedItem.name}`);
      setSelectedItem(null); setQty('1'); setPrice(''); setStore(''); setNotes('');
      setTimeout(() => setSuccess(''), 3000);
    } finally {
      setBusy(false);
    }
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await addItem(newName, newCat, newUnit);
      setSuccess(`✓ Added "${newName}" to your list`);
      setNewName(''); setNewCat('Other'); setNewUnit('pcs');
      setTimeout(() => setSuccess(''), 3000);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="log-page">
      <div className="tab-switcher">
        <button className={tab === 'log' ? 'active' : ''} onClick={() => setTab('log')}>
          <ShoppingCart size={16} /> Log Purchase
        </button>
        <button className={tab === 'add-item' ? 'active' : ''} onClick={() => setTab('add-item')}>
          <Package size={16} /> Add Item
        </button>
      </div>

      {success && <div className="success-toast">{success}</div>}

      {tab === 'log' && (
        <div className="log-form-wrap">
          {!selectedItem ? (
            <div className="item-picker">
              <div className="search-bar">
                <Search size={16} />
                <input placeholder="Search items…" value={search}
                  onChange={e => setSearch(e.target.value)} autoFocus />
              </div>
              {items.length === 0 ? (
                <div className="empty-state-sm">No items yet. Add some in the "Add Item" tab.</div>
              ) : filtered.length === 0 ? (
                <div className="empty-state-sm">No items match "{search}"</div>
              ) : (
                <div className="item-list">
                  {filtered.map(item => (
                    <button key={item.id} className="item-row" onClick={() => setSelectedItem(item)}>
                      <div>
                        <span className="item-row-name">{item.name}</span>
                        <span className="item-row-cat">{item.category}</span>
                      </div>
                      <span className="item-row-unit">{item.unit}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleLog} className="purchase-form">
              <div className="selected-item-header">
                <div>
                  <strong>{selectedItem.name}</strong>
                  <span className="item-row-cat">{selectedItem.category}</span>
                </div>
                <button type="button" className="clear-btn" onClick={() => setSelectedItem(null)}>
                  <X size={16} />
                </button>
              </div>

              <div className="form-row">
                <label>
                  Quantity
                  <input type="number" value={qty} min="0.01" step="any"
                    onChange={e => setQty(e.target.value)} required />
                </label>
                <label>
                  Unit
                  <input type="text" value={selectedItem.unit} readOnly className="readonly" />
                </label>
              </div>

              <div className="form-row">
                <label>
                  Price / unit (₹)
                  <input type="number" value={price} min="0" step="any" placeholder="Optional"
                    onChange={e => setPrice(e.target.value)} />
                </label>
                <label>
                  Date
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} required />
                </label>
              </div>

              <label>
                Store
                <input type="text" value={store} placeholder="e.g. D-Mart, BigBasket…"
                  onChange={e => setStore(e.target.value)} />
              </label>

              <label>
                Notes
                <input type="text" value={notes} placeholder="Optional"
                  onChange={e => setNotes(e.target.value)} />
              </label>

              <button type="submit" className="submit-btn" disabled={busy}>
                {busy ? 'Saving…' : 'Log Purchase'}
              </button>
            </form>
          )}
        </div>
      )}

      {tab === 'add-item' && (
        <form onSubmit={handleAddItem} className="add-item-form">
          <label>
            Item Name *
            <input type="text" value={newName} placeholder="e.g. Basmati Rice"
              onChange={e => setNewName(e.target.value)} required />
          </label>

          <label>
            Category
            <div className="select-wrap">
              <select value={newCat} onChange={e => setNewCat(e.target.value)}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
              <ChevronDown size={14} />
            </div>
          </label>

          <label>
            Unit
            <div className="select-wrap">
              <select value={newUnit} onChange={e => setNewUnit(e.target.value)}>
                {UNITS.map(u => <option key={u}>{u}</option>)}
              </select>
              <ChevronDown size={14} />
            </div>
          </label>

          <button type="submit" className="submit-btn" disabled={busy || !newName.trim()}>
            {busy ? 'Adding…' : <><Plus size={16} /> Add Item</>}
          </button>
        </form>
      )}
    </div>
  );
}
