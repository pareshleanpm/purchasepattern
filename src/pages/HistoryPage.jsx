import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { History, Trash2, Search, IndianRupee } from 'lucide-react';

export default function HistoryPage({ purchases, items, deleteItem, deletePurchase }) {
  const [view, setView] = useState('purchases'); // 'purchases' | 'items'
  const [search, setSearch] = useState('');
  const [confirm, setConfirm] = useState(null);

  const filteredPurchases = purchases.filter(p =>
    (p.grocery_items?.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.store || '').toLowerCase().includes(search.toLowerCase())
  );

  const filteredItems = items.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleDeletePurchase = async (id) => {
    await deletePurchase(id);
    setConfirm(null);
  };

  const handleDeleteItem = async (id) => {
    await deleteItem(id);
    setConfirm(null);
  };

  return (
    <div className="history-page">
      <div className="tab-switcher">
        <button className={view === 'purchases' ? 'active' : ''} onClick={() => setView('purchases')}>
          <History size={16} /> Purchases ({purchases.length})
        </button>
        <button className={view === 'items' ? 'active' : ''} onClick={() => setView('items')}>
          Items ({items.length})
        </button>
      </div>

      <div className="search-bar">
        <Search size={16} />
        <input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {view === 'purchases' && (
        <div className="purchase-list">
          {filteredPurchases.length === 0 ? (
            <div className="empty-state-sm">No purchases yet.</div>
          ) : filteredPurchases.map(p => (
            <div key={p.id} className="purchase-card">
              <div className="purchase-main">
                <div>
                  <span className="purchase-name">{p.grocery_items?.name}</span>
                  <span className="purchase-detail">
                    {p.quantity} {p.grocery_items?.unit}
                    {p.price_per_unit ? ` · ₹${(p.quantity * p.price_per_unit).toFixed(0)}` : ''}
                    {p.store ? ` · ${p.store}` : ''}
                  </span>
                </div>
                <div className="purchase-right">
                  <span className="purchase-date">{format(parseISO(p.purchased_at), 'dd MMM yy')}</span>
                  {confirm === p.id ? (
                    <div className="confirm-row">
                      <button className="confirm-yes" onClick={() => handleDeletePurchase(p.id)}>Delete</button>
                      <button className="confirm-no" onClick={() => setConfirm(null)}>Cancel</button>
                    </div>
                  ) : (
                    <button className="del-btn" onClick={() => setConfirm(p.id)}><Trash2 size={14} /></button>
                  )}
                </div>
              </div>
              {p.notes && <span className="purchase-notes">{p.notes}</span>}
            </div>
          ))}
        </div>
      )}

      {view === 'items' && (
        <div className="items-manage-list">
          {filteredItems.length === 0 ? (
            <div className="empty-state-sm">No items added yet.</div>
          ) : filteredItems.map(item => (
            <div key={item.id} className="item-manage-card">
              <div>
                <span className="item-manage-name">{item.name}</span>
                <span className="item-manage-meta">{item.category} · {item.unit}</span>
              </div>
              {confirm === item.id ? (
                <div className="confirm-row">
                  <button className="confirm-yes" onClick={() => handleDeleteItem(item.id)}>Delete</button>
                  <button className="confirm-no" onClick={() => setConfirm(null)}>Cancel</button>
                </div>
              ) : (
                <button className="del-btn" onClick={() => setConfirm(item.id)}><Trash2 size={14} /></button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
