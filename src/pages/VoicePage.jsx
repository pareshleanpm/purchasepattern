import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Check, X, Edit2, Trash2 } from 'lucide-react';
import { CATEGORIES, UNITS } from '../lib/recommendations';

/**
 * Parses spoken text into grocery items
 * Handles: "milk 1 litre, bread 2, eggs dozen, onions 500g"
 */
function parseVoiceText(text) {
  const raw = text.toLowerCase().trim();
  // Split on commas, "and", newlines
  const parts = raw.split(/,|\band\b|\n/).map(p => p.trim()).filter(Boolean);

  return parts.map(part => {
    const item = { name: '', quantity: 1, unit: 'pcs', raw: part };

    // Extract quantity + unit patterns
    const patterns = [
      { re: /(\d+\.?\d*)\s*(kg|kilogram)/i,      unit: 'kg' },
      { re: /(\d+\.?\d*)\s*(g|gram)/i,            unit: 'g' },
      { re: /(\d+\.?\d*)\s*(l|litre|liter|ltr)/i, unit: 'L' },
      { re: /(\d+\.?\d*)\s*(ml|milliliter)/i,      unit: 'mL' },
      { re: /(\d+\.?\d*)\s*(pack|packet|packs)/i,  unit: 'pack' },
      { re: /(\d+\.?\d*)\s*(dozen|doz)/i,          unit: 'dozen', multiplier: 12 },
      { re: /(\d+\.?\d*)\s*(bottle|bottles)/i,     unit: 'bottle' },
      { re: /(\d+\.?\d*)\s*(box|boxes)/i,          unit: 'box' },
      { re: /(\d+\.?\d*)\s*(bag|bags)/i,           unit: 'bag' },
      { re: /(\d+\.?\d*)/,                         unit: 'pcs' },
    ];

    let matched = false;
    let cleanPart = part;

    for (const p of patterns) {
      const m = part.match(p.re);
      if (m) {
        item.quantity = parseFloat(m[1]);
        item.unit = p.unit;
        cleanPart = part.replace(m[0], '').trim();
        matched = true;
        break;
      }
    }

    // Handle word numbers
    const wordNums = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, half: 0.5, quarter: 0.25 };
    for (const [word, val] of Object.entries(wordNums)) {
      if (cleanPart.includes(word)) {
        item.quantity = val;
        cleanPart = cleanPart.replace(word, '').trim();
      }
    }

    // Clean up name
    item.name = cleanPart
      .replace(/^(buy|get|need|add)\s+/i, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Capitalise first letter
    item.name = item.name.charAt(0).toUpperCase() + item.name.slice(1);

    return item;
  }).filter(i => i.name.length > 1);
}

export default function VoicePage({ items, logPurchase, addItem }) {
  const [listening, setListening]   = useState(false);
  const [transcript, setTranscript] = useState('');
  const [parsed, setParsed]         = useState([]);
  const [busy, setBusy]             = useState(false);
  const [logged, setLogged]         = useState('');
  const [error, setError]           = useState('');
  const recognitionRef = useRef(null);

  useEffect(() => {
    return () => recognitionRef.current?.stop();
  }, []);

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Voice input not supported. Use Chrome on Android or desktop.');
      return;
    }
    setError(''); setTranscript(''); setParsed([]);
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-IN';
    recognition.maxAlternatives = 1;

    recognition.onresult = (e) => {
      let final = '';
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript + ', ';
        else setTranscript(e.results[i][0].transcript);
      }
      if (final) {
        setTranscript(prev => prev + final);
      }
    };
    recognition.onerror = (e) => { setError('Voice error: ' + e.error); setListening(false); };
    recognition.onend   = () => { setListening(false); };

    recognition.start();
    recognitionRef.current = recognition;
    setListening(true);
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setListening(false);
    if (transcript) {
      const items = parseVoiceText(transcript);
      setParsed(items);
    }
  };

  const updateParsed = (idx, field, val) => {
    setParsed(prev => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item));
  };

  const removeParsed = (idx) => {
    setParsed(prev => prev.filter((_, i) => i !== idx));
  };

  const handleLogAll = async () => {
    if (!parsed.length) return;
    setBusy(true);
    let count = 0;
    try {
      for (const p of parsed) {
        if (!p.name.trim()) continue;
        let item = items.find(i => i.name.toLowerCase() === p.name.toLowerCase());
        if (!item) item = await addItem(p.name, 'Other', p.unit);
        await logPurchase({
          item_id: item.id, quantity: p.quantity,
          price_per_unit: null, store: null,
          notes: 'Voice entry',
          purchased_at: new Date().toISOString()
        });
        count++;
      }
      setLogged(`✓ Logged ${count} item${count !== 1 ? 's' : ''}`);
      setParsed([]); setTranscript('');
      setTimeout(() => setLogged(''), 3000);
    } catch (e) {
      setError('Error: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {logged && <div className="success-toast">{logged}</div>}
      {error  && <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid #f0c0c0', padding: '8px 12px', borderRadius: 8, fontSize: '.78rem' }}>{error}</div>}

      {/* Big mic button */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '24px 0' }}>
        <button
          onClick={listening ? stopListening : startListening}
          style={{
            width: 88, height: 88, borderRadius: '50%',
            background: listening ? 'var(--danger)' : 'var(--accent)',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: listening ? '0 0 0 12px rgba(166,61,61,.15)' : '0 4px 16px rgba(91,127,166,.3)',
            transition: 'all .2s',
            animation: listening ? 'pulse 1.5s infinite' : 'none'
          }}
        >
          {listening ? <MicOff size={32} /> : <Mic size={32} />}
        </button>
        <div style={{ fontSize: '.82rem', color: 'var(--text2)', fontWeight: 500 }}>
          {listening ? 'Listening… tap to stop' : 'Tap to speak your grocery list'}
        </div>
        {listening && (
          <div style={{ fontSize: '.78rem', color: 'var(--text3)', textAlign: 'center', maxWidth: 280 }}>
            Say items naturally: <em>"Milk 1 litre, bread 2, eggs dozen, onions 500g"</em>
          </div>
        )}
      </div>

      {/* Live transcript */}
      {(transcript || listening) && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px' }}>
          <div style={{ fontSize: '.7rem', fontWeight: 600, color: 'var(--text3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.4px' }}>Transcript</div>
          <div style={{ fontSize: '.85rem', color: 'var(--text)', lineHeight: 1.5, minHeight: 40 }}>
            {transcript || <span style={{ color: 'var(--text3)', fontStyle: 'italic' }}>Waiting for speech…</span>}
          </div>
        </div>
      )}

      {/* Parsed items - editable */}
      {parsed.length > 0 && (
        <div>
          <div style={{ fontSize: '.78rem', fontWeight: 600, color: 'var(--text2)', marginBottom: 8 }}>
            Review & edit before logging ({parsed.length} items):
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {parsed.map((item, idx) => (
              <div key={idx} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', display: 'grid', gridTemplateColumns: '1fr 60px 64px 28px', gap: 6, alignItems: 'center' }}>
                <input
                  value={item.name}
                  onChange={e => updateParsed(idx, 'name', e.target.value)}
                  style={{ height: 30, fontSize: '.8rem' }}
                />
                <input
                  type="number" value={item.quantity} min="0.01" step="any"
                  onChange={e => updateParsed(idx, 'quantity', parseFloat(e.target.value))}
                  style={{ height: 30, fontSize: '.8rem', textAlign: 'center' }}
                />
                <select value={item.unit} onChange={e => updateParsed(idx, 'unit', e.target.value)}
                  style={{ height: 30, fontSize: '.76rem', padding: '2px 4px' }}>
                  {UNITS.map(u => <option key={u}>{u}</option>)}
                </select>
                <button onClick={() => removeParsed(idx)} style={{ color: 'var(--text3)', padding: 3 }}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>

          <button onClick={handleLogAll} disabled={busy || !parsed.length}
            className="submit-btn" style={{ width: '100%', marginTop: 10 }}>
            <Check size={16} /> {busy ? 'Logging…' : `Log All ${parsed.length} Items`}
          </button>
        </div>
      )}

      <style>{`@keyframes pulse { 0%,100%{box-shadow:0 0 0 12px rgba(166,61,61,.15)} 50%{box-shadow:0 0 0 20px rgba(166,61,61,.05)} }`}</style>
    </div>
  );
}
