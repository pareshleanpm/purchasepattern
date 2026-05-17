import { useState, useRef } from 'react';
import { Receipt, Camera, Upload, Check, Trash2, AlertCircle } from 'lucide-react';
import { UNITS } from '../lib/recommendations';
import { loadUserSettings } from '../lib/modelStorage';
import { useAuth } from '../hooks/useAuth';

export default function ReceiptPage({ items, logPurchase, addItem }) {
  const { user } = useAuth();
  const fileRef = useRef(null);
  const [image, setImage]   = useState(null);  // base64
  const [parsed, setParsed] = useState([]);
  const [busy, setBusy]     = useState(false);
  const [status, setStatus] = useState('');
  const [logged, setLogged] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  const handleFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => setImage(e.target.result);
    reader.readAsDataURL(file);
    setParsed([]); setStatus('');
  };

  const handleCamera = async () => {
    // Trigger file input with camera
    fileRef.current.setAttribute('capture', 'environment');
    fileRef.current.click();
  };

  const extractWithGemini = async () => {
    if (!image) return;
    let key = apiKey;
    if (!key) {
      const settings = await loadUserSettings(user.id);
      key = settings.gemini_api_key;
    }
    if (!key) { setStatus('Enter your Gemini API key below first.'); setShowKey(true); return; }

    setBusy(true);
    setStatus('Sending to Gemini…');
    try {
      const base64 = image.split(',')[1];
      const mimeType = image.split(';')[0].split(':')[1];

      const prompt = `You are analysing a grocery receipt or shopping bill.
Extract ALL grocery items from this image.
Return ONLY a JSON array, no other text.
Each item: { "name": string, "quantity": number, "unit": string, "price": number or null }
Units must be one of: pcs, kg, g, L, mL, pack, dozen, bottle, box, bag
If quantity unclear, use 1. If unit unclear, use pcs.
Example: [{"name":"Amul Milk","quantity":1,"unit":"L","price":68},{"name":"Bread","quantity":1,"unit":"pcs","price":45}]`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: prompt },
                { inline_data: { mime_type: mimeType, data: base64 } }
              ]
            }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 1024 }
          })
        }
      );

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const clean = text.replace(/```json|```/g, '').trim();
      const items = JSON.parse(clean);
      setParsed(items.map(i => ({ ...i, selected: true })));
      setStatus(`Found ${items.length} items. Review and log.`);
    } catch (e) {
      setStatus('Error: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  const updateItem = (idx, field, val) => {
    setParsed(prev => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item));
  };

  const handleLogAll = async () => {
    const toLog = parsed.filter(p => p.selected && p.name.trim());
    if (!toLog.length) return;
    setBusy(true);
    let count = 0;
    try {
      for (const p of toLog) {
        let item = items.find(i => i.name.toLowerCase() === p.name.toLowerCase());
        if (!item) item = await addItem(p.name, 'Other', p.unit);
        await logPurchase({
          item_id: item.id, quantity: p.quantity,
          price_per_unit: p.price ? p.price / p.quantity : null,
          store: null, notes: 'Receipt scan',
          purchased_at: new Date().toISOString()
        });
        count++;
      }
      setLogged(`✓ Logged ${count} items from receipt`);
      setParsed([]); setImage(null);
      setTimeout(() => setLogged(''), 3000);
    } catch (e) {
      setStatus('Error: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {logged && <div className="success-toast">{logged}</div>}

      {/* Upload area */}
      <div
        onClick={() => { fileRef.current.removeAttribute('capture'); fileRef.current.click(); }}
        style={{
          border: '2px dashed var(--border2)', borderRadius: 12,
          padding: image ? 0 : '32px 16px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 8, cursor: 'pointer', background: 'var(--bg2)',
          overflow: 'hidden', minHeight: image ? 0 : 140
        }}
      >
        {image ? (
          <img src={image} alt="Receipt" style={{ width: '100%', borderRadius: 10, maxHeight: 280, objectFit: 'contain' }} />
        ) : (
          <>
            <Receipt size={36} color="var(--text3)" />
            <div style={{ fontSize: '.85rem', fontWeight: 600, color: 'var(--text2)' }}>Tap to upload receipt photo</div>
            <div style={{ fontSize: '.74rem', color: 'var(--text3)' }}>or use camera button below</div>
          </>
        )}
      </div>

      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => handleFile(e.target.files[0])} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <button onClick={handleCamera}
          style={{ background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text2)', padding: '9px', borderRadius: 8, fontWeight: 600, fontSize: '.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Camera size={15} /> Camera
        </button>
        <button onClick={extractWithGemini} disabled={!image || busy}
          className="submit-btn">
          {busy ? 'Extracting…' : '✨ Extract Items'}
        </button>
      </div>

      {status && (
        <div style={{ fontSize: '.78rem', color: 'var(--text2)', display: 'flex', gap: 6, alignItems: 'center' }}>
          <AlertCircle size={13} /> {status}
        </div>
      )}

      {/* API key input */}
      {showKey && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: '.76rem', fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>
            Gemini API Key (get free at aistudio.google.com)
          </div>
          <input type="password" placeholder="AIza…" value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            style={{ fontSize: '.8rem' }} />
          <div style={{ fontSize: '.7rem', color: 'var(--text3)', marginTop: 4 }}>
            ~₹0.05 per receipt. Key stored in app settings.
          </div>
        </div>
      )}

      {/* Parsed items */}
      {parsed.length > 0 && (
        <div>
          <div style={{ fontSize: '.78rem', fontWeight: 600, color: 'var(--text2)', marginBottom: 8 }}>
            Review items ({parsed.filter(p => p.selected).length} selected):
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {parsed.map((item, idx) => (
              <div key={idx} style={{
                background: item.selected ? 'var(--surface)' : 'var(--bg3)',
                border: '1px solid var(--border)', borderRadius: 8,
                padding: '7px 10px',
                display: 'grid', gridTemplateColumns: '20px 1fr 52px 60px 60px 24px',
                gap: 5, alignItems: 'center', opacity: item.selected ? 1 : .5
              }}>
                <input type="checkbox" checked={item.selected}
                  onChange={e => updateItem(idx, 'selected', e.target.checked)} />
                <input value={item.name} onChange={e => updateItem(idx, 'name', e.target.value)}
                  style={{ height: 28, fontSize: '.78rem' }} />
                <input type="number" value={item.quantity} min="0.01" step="any"
                  onChange={e => updateItem(idx, 'quantity', parseFloat(e.target.value))}
                  style={{ height: 28, fontSize: '.76rem', textAlign: 'center' }} />
                <select value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)}
                  style={{ height: 28, fontSize: '.72rem', padding: '2px 4px' }}>
                  {UNITS.map(u => <option key={u}>{u}</option>)}
                </select>
                <input type="number" value={item.price || ''} placeholder="₹"
                  onChange={e => updateItem(idx, 'price', parseFloat(e.target.value))}
                  style={{ height: 28, fontSize: '.76rem', textAlign: 'center' }} />
                <button onClick={() => setParsed(prev => prev.filter((_, i) => i !== idx))}
                  style={{ color: 'var(--text3)' }}><Trash2 size={12} /></button>
              </div>
            ))}
          </div>
          <div style={{ fontSize: '.68rem', color: 'var(--text3)', marginTop: 4, marginBottom: 8 }}>
            Name · Qty · Unit · Price(₹)
          </div>
          <button onClick={handleLogAll} disabled={busy} className="submit-btn" style={{ width: '100%' }}>
            <Check size={16} /> {busy ? 'Logging…' : `Log ${parsed.filter(p => p.selected).length} Items`}
          </button>
        </div>
      )}
    </div>
  );
}
