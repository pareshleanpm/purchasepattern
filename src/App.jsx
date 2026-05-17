import { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { useGroceryData } from './hooks/useGroceryData';
import AuthPage from './pages/AuthPage';
import AddPage from './pages/AddPage';
import EntriesPage from './pages/EntriesPage';
import AnalysePage from './pages/AnalysePage';
import PredictPage from './pages/PredictPage';
import ScanPage from './pages/ScanPage';
import VoicePage from './pages/VoicePage';
import ReceiptPage from './pages/ReceiptPage';
import TrainPage from './pages/TrainPage';
import { Plus, List, BarChart2, Sparkles, LogOut, RefreshCw, ShoppingCart, Camera, Mic, Receipt, Brain } from 'lucide-react';

const BOTTOM_TABS = [
  { id: 'add',     icon: Plus,      label: 'Add' },
  { id: 'entries', icon: List,      label: 'Entries' },
  { id: 'analyse', icon: BarChart2, label: 'Analyse' },
  { id: 'predict', icon: Sparkles,  label: 'Predict' },
];

const INPUT_TABS = [
  { id: 'add',     icon: Plus,     label: 'Manual' },
  { id: 'scan',    icon: Camera,   label: 'Scan' },
  { id: 'voice',   icon: Mic,      label: 'Voice' },
  { id: 'receipt', icon: Receipt,  label: 'Receipt' },
  { id: 'train',   icon: Brain,    label: 'Train AI' },
];

export default function App() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { items, purchases, loading, addItem, logPurchase, deleteItem, deletePurchase, refresh } = useGroceryData();
  const [tab, setTab]       = useState('add');
  const [inputTab, setInputTab] = useState('add');

  if (authLoading) return <div className="splash"><div className="spinner" /></div>;
  if (!user) return <AuthPage />;

  const isInputSection = ['add','scan','voice','receipt','train'].includes(tab);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-brand">
          <ShoppingCart size={17} /> GroCart
        </div>
        <div className="header-actions">
          {loading && <RefreshCw size={13} style={{ animation: 'spin .8s linear infinite', color: 'var(--text3)' }} />}
          <button className="icon-btn" onClick={refresh}><RefreshCw size={14} /></button>
          <button className="icon-btn" onClick={signOut}><LogOut size={14} /></button>
        </div>
      </header>

      <main className="app-main">
        {/* Input method sub-tabs (shown when Add is active) */}
        {tab === 'add' && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
              {INPUT_TABS.map(t => {
                const Icon = t.icon;
                return (
                  <button key={t.id}
                    onClick={() => setInputTab(t.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px',
                      borderRadius: 20, border: '1px solid',
                      borderColor: inputTab === t.id ? 'var(--accent)' : 'var(--border)',
                      background: inputTab === t.id ? 'var(--accent-bg)' : 'var(--surface)',
                      color: inputTab === t.id ? 'var(--accent)' : 'var(--text2)',
                      fontSize: '.76rem', fontWeight: 600, whiteSpace: 'nowrap',
                      flexShrink: 0
                    }}>
                    <Icon size={13} /> {t.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {tab === 'add' && inputTab === 'add'     && <AddPage     items={items} purchases={purchases} addItem={addItem} logPurchase={logPurchase} deleteItem={deleteItem} />}
        {tab === 'add' && inputTab === 'scan'    && <ScanPage    items={items} logPurchase={logPurchase} addItem={addItem} />}
        {tab === 'add' && inputTab === 'voice'   && <VoicePage   items={items} logPurchase={logPurchase} addItem={addItem} />}
        {tab === 'add' && inputTab === 'receipt' && <ReceiptPage items={items} logPurchase={logPurchase} addItem={addItem} />}
        {tab === 'add' && inputTab === 'train'   && <TrainPage   items={items} />}

        {tab === 'entries' && <EntriesPage purchases={purchases} items={items} deletePurchase={deletePurchase} />}
        {tab === 'analyse' && <AnalysePage items={items} purchases={purchases} />}
        {tab === 'predict' && <PredictPage items={items} purchases={purchases} />}
      </main>

      <nav className="bottom-nav">
        {BOTTOM_TABS.map(t => {
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
