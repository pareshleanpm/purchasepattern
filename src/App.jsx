import { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { useGroceryData } from './hooks/useGroceryData';
import AuthPage from './pages/AuthPage';
import AddPage from './pages/AddPage';
import EntriesPage from './pages/EntriesPage';
import AnalysePage from './pages/AnalysePage';
import PredictPage from './pages/PredictPage';
import { Plus, List, BarChart2, Sparkles, LogOut, RefreshCw, ShoppingCart } from 'lucide-react';

const TABS = [
  { id: 'add',     icon: Plus,      label: 'Add' },
  { id: 'entries', icon: List,      label: 'Entries' },
  { id: 'analyse', icon: BarChart2, label: 'Analyse' },
  { id: 'predict', icon: Sparkles,  label: 'Predict' }
];

export default function App() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { items, purchases, loading, addItem, logPurchase, deleteItem, deletePurchase, refresh } = useGroceryData();
  const [tab, setTab] = useState('add');

  if (authLoading) return <div className="splash"><div className="spinner" /></div>;
  if (!user) return <AuthPage />;

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-brand">
          <ShoppingCart size={18} />
          GroCart
        </div>
        <div className="header-actions">
          {loading && <RefreshCw size={14} style={{ animation: 'spin .8s linear infinite', color: 'var(--text3)' }} />}
          <button className="icon-btn" onClick={refresh} title="Refresh"><RefreshCw size={15} /></button>
          <button className="icon-btn" onClick={signOut} title="Sign out"><LogOut size={15} /></button>
        </div>
      </header>

      <main className="app-main">
        {tab === 'add'     && <AddPage     items={items} purchases={purchases} addItem={addItem} logPurchase={logPurchase} deleteItem={deleteItem} />}
        {tab === 'entries' && <EntriesPage purchases={purchases} items={items} deletePurchase={deletePurchase} />}
        {tab === 'analyse' && <AnalysePage items={items} purchases={purchases} />}
        {tab === 'predict' && <PredictPage items={items} purchases={purchases} />}
      </main>

      <nav className="bottom-nav">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} className={`nav-btn ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}>
              <Icon size={19} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
