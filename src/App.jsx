import { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { useGroceryData } from './hooks/useGroceryData';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import LogPage from './pages/LogPage';
import RecommendationsPage from './pages/RecommendationsPage';
import HistoryPage from './pages/HistoryPage';
import { LayoutDashboard, ShoppingCart, Sparkles, History, LogOut, RefreshCw } from 'lucide-react';

const TABS = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Home' },
  { id: 'log', icon: ShoppingCart, label: 'Log' },
  { id: 'recs', icon: Sparkles, label: 'Smart' },
  { id: 'history', icon: History, label: 'History' }
];

export default function App() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { items, purchases, loading, addItem, logPurchase, deleteItem, deletePurchase, refresh } = useGroceryData();
  const [tab, setTab] = useState('dashboard');

  if (authLoading) return <div className="splash"><div className="spinner" /></div>;
  if (!user) return <AuthPage />;

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-brand">
          <ShoppingCart size={20} />
          <span>GroCart</span>
        </div>
        <div className="header-actions">
          {loading && <RefreshCw size={16} className="spin" />}
          <button className="icon-btn" onClick={refresh} title="Refresh"><RefreshCw size={16} /></button>
          <button className="icon-btn" onClick={signOut} title="Sign out"><LogOut size={16} /></button>
        </div>
      </header>

      <main className="app-main">
        {tab === 'dashboard' && (
          <DashboardPage items={items} purchases={purchases} onNavigate={setTab} />
        )}
        {tab === 'log' && (
          <LogPage items={items} purchases={purchases} addItem={addItem} logPurchase={logPurchase} />
        )}
        {tab === 'recs' && (
          <RecommendationsPage items={items} purchases={purchases} />
        )}
        {tab === 'history' && (
          <HistoryPage purchases={purchases} items={items} deleteItem={deleteItem} deletePurchase={deletePurchase} />
        )}
      </main>

      <nav className="bottom-nav">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} className={`nav-btn ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}>
              <Icon size={20} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
