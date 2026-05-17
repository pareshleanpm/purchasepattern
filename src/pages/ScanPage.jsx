import { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, Barcode, X, Check, RefreshCw, AlertCircle } from 'lucide-react';
import { predict, loadMobileNet, importModelWeights, isModelLoaded } from '../lib/modelManager';
import { loadGlobalModel } from '../lib/modelStorage';
import { CATEGORIES, UNITS } from '../lib/recommendations';

const OPEN_FOOD_FACTS = 'https://world.openfoodfacts.org/api/v0/product/';

export default function ScanPage({ items, logPurchase, addItem }) {
  const videoRef   = useRef(null);
  const canvasRef  = useRef(null);
  const streamRef  = useRef(null);
  const scanTimer  = useRef(null);

  const [mode, setMode]           = useState('image'); // 'image' | 'barcode'
  const [cameraOn, setCameraOn]   = useState(false);
  const [status, setStatus]       = useState('');
  const [result, setResult]       = useState(null);   // { name, category, unit, confidence, source }
  const [modelReady, setModelReady] = useState(false);
  const [modelInfo, setModelInfo] = useState(null);
  const [busy, setBusy]           = useState(false);
  const [logged, setLogged]       = useState('');

  // ── Load model on mount ──────────────────────────────────────────────────
  useEffect(() => {
    initModel();
    return () => stopCamera();
  }, []);

  const initModel = async () => {
    setStatus('Loading recognition engine…');
    try {
      await loadMobileNet(setStatus);
      const modelData = await loadGlobalModel();
      if (modelData?.weights && modelData?.labels?.length > 0) {
        await importModelWeights(modelData);
        setModelReady(true);
        setModelInfo(modelData);
        setStatus(`Model ready — ${modelData.labels.length} items trained`);
      } else {
        setStatus('No trained model found. Use Train tab to train items.');
      }
    } catch (e) {
      setStatus('Error loading model: ' + e.message);
    }
  };

  // ── Camera ───────────────────────────────────────────────────────────────
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: 640, height: 480 }
      });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraOn(true);
      if (mode === 'image' && modelReady) startImageScan();
      if (mode === 'barcode') startBarcodeScan();
    } catch (e) {
      setStatus('Camera error: ' + e.message);
    }
  };

  const stopCamera = () => {
    clearInterval(scanTimer.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraOn(false);
  };

  const captureFrame = () => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;
    canvas.width  = video.videoWidth  || 224;
    canvas.height = video.videoHeight || 224;
    canvas.getContext('2d').drawImage(video, 0, 0);
    return canvas;
  };

  // ── Image recognition scan loop ──────────────────────────────────────────
  const startImageScan = () => {
    clearInterval(scanTimer.current);
    scanTimer.current = setInterval(async () => {
      if (busy || result) return;
      const canvas = captureFrame();
      if (!canvas) return;
      try {
        const pred = await predict(canvas);
        if (pred.label) {
          clearInterval(scanTimer.current);
          const item = items.find(i => i.name.toLowerCase() === pred.label.toLowerCase());
          setResult({
            name: pred.label,
            category: item?.category || 'Other',
            unit: item?.unit || 'pcs',
            confidence: Math.round(pred.confidence * 100),
            source: 'image',
            itemId: item?.id || null
          });
          setStatus(`Recognised: ${pred.label} (${Math.round(pred.confidence * 100)}%)`);
        } else {
          setStatus('Scanning… point at item');
        }
      } catch (e) { /* continue scanning */ }
    }, 1000);
  };

  // ── Barcode scan loop (uses BarcodeDetector API) ─────────────────────────
  const startBarcodeScan = () => {
    if (!('BarcodeDetector' in window)) {
      setStatus('Barcode detection not supported on this browser. Try Chrome on Android.');
      return;
    }
    const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] });
    clearInterval(scanTimer.current);
    scanTimer.current = setInterval(async () => {
      if (busy || result) return;
      const canvas = captureFrame();
      if (!canvas) return;
      try {
        const barcodes = await detector.detect(canvas);
        if (barcodes.length > 0) {
          clearInterval(scanTimer.current);
          const code = barcodes[0].rawValue;
          setStatus(`Barcode: ${code} — looking up…`);
          await lookupBarcode(code);
        }
      } catch (e) { /* continue */ }
    }, 500);
  };

  const lookupBarcode = async (code) => {
    setBusy(true);
    try {
      const res  = await fetch(`${OPEN_FOOD_FACTS}${code}.json`);
      const data = await res.json();
      if (data.status === 1) {
        const p = data.product;
        const name     = p.product_name || p.abbreviated_product_name || code;
        const quantity = p.quantity || '';
        const cats     = p.categories_tags?.[0]?.replace('en:', '') || 'Other';
        const category = mapCategory(cats);
        const unit     = guessUnit(quantity);
        setResult({ name: `${name} ${quantity}`.trim(), category, unit, confidence: 100, source: 'barcode', barcode: code });
        setStatus(`Found: ${name}`);
      } else {
        setStatus(`Barcode ${code} not in database. Enter manually.`);
      }
    } catch (e) {
      setStatus('Lookup failed: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  // ── Log the recognised item ──────────────────────────────────────────────
  const handleLog = async () => {
    if (!result) return;
    setBusy(true);
    try {
      let item = result.itemId
        ? items.find(i => i.id === result.itemId)
        : items.find(i => i.name.toLowerCase() === result.name.toLowerCase());
      if (!item) item = await addItem(result.name, result.category, result.unit);
      await logPurchase({
        item_id: item.id, quantity: 1,
        price_per_unit: null, store: null,
        notes: `Auto-logged via ${result.source}`,
        purchased_at: new Date().toISOString()
      });
      setLogged(`✓ Logged: ${result.name}`);
      setResult(null);
      setTimeout(() => { setLogged(''); if (cameraOn) { if (mode === 'image') startImageScan(); else startBarcodeScan(); } }, 2000);
    } catch (e) {
      setStatus('Error: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleRetry = () => { setResult(null); if (mode === 'image') startImageScan(); else startBarcodeScan(); };

  const switchMode = (m) => {
    setMode(m); setResult(null); setStatus('');
    clearInterval(scanTimer.current);
    if (cameraOn) { if (m === 'image' && modelReady) startImageScan(); else if (m === 'barcode') startBarcodeScan(); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Mode toggle */}
      <div className="tab-switcher" style={{ marginBottom: 0 }}>
        <button className={mode === 'image' ? 'active' : ''} onClick={() => switchMode('image')}>
          <Camera size={14} /> Image Recognition
        </button>
        <button className={mode === 'barcode' ? 'active' : ''} onClick={() => switchMode('barcode')}>
          <Barcode size={14} /> Barcode Scan
        </button>
      </div>

      {/* Model info */}
      {modelInfo && (
        <div style={{ fontSize: '.73rem', color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 5 }}>
          <Check size={12} color="var(--success)" />
          {modelInfo.labels.length} items trained · Updated {new Date(modelInfo.updatedAt).toLocaleDateString()}
        </div>
      )}
      {!modelReady && mode === 'image' && (
        <div style={{ background: 'var(--warn-bg)', border: '1px solid #e8c97a', borderRadius: 8, padding: '8px 12px', fontSize: '.78rem', color: 'var(--warn)', display: 'flex', gap: 6, alignItems: 'center' }}>
          <AlertCircle size={14} /> No trained model. Go to Train tab to add item photos.
        </div>
      )}

      {/* Camera viewport */}
      <div style={{ position: 'relative', background: '#000', borderRadius: 12, overflow: 'hidden', aspectRatio: '4/3' }}>
        <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }} playsInline muted />
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {/* Scan overlay */}
        {cameraOn && !result && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 180, height: 180, border: '2px solid rgba(255,255,255,.6)', borderRadius: 12, boxShadow: '0 0 0 9999px rgba(0,0,0,.4)' }} />
          </div>
        )}

        {/* Result overlay */}
        {result && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.75)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20 }}>
            <div style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', width: '100%', maxWidth: 280 }}>
              <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 4 }}>{result.name}</div>
              <div style={{ fontSize: '.78rem', color: 'var(--text2)', marginBottom: 8 }}>{result.category} · {result.unit}</div>
              {result.source === 'image' && (
                <div style={{ fontSize: '.72rem', color: result.confidence > 85 ? 'var(--success)' : 'var(--warn)' }}>
                  {result.confidence}% confidence
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleRetry} style={{ background: 'rgba(255,255,255,.2)', color: '#fff', padding: '9px 16px', borderRadius: 8, fontWeight: 600, fontSize: '.85rem', display: 'flex', alignItems: 'center', gap: 5 }}>
                <X size={14} /> Retry
              </button>
              <button onClick={handleLog} disabled={busy} style={{ background: 'var(--success)', color: '#fff', padding: '9px 20px', borderRadius: 8, fontWeight: 600, fontSize: '.85rem', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Check size={14} /> {busy ? 'Logging…' : 'Log It'}
              </button>
            </div>
          </div>
        )}

        {!cameraOn && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10 }}>
            <Camera size={40} color="rgba(255,255,255,.4)" />
            <span style={{ color: 'rgba(255,255,255,.5)', fontSize: '.82rem' }}>Camera off</span>
          </div>
        )}
      </div>

      {/* Status */}
      {status && <div style={{ fontSize: '.78rem', color: 'var(--text2)', textAlign: 'center', padding: '4px 0' }}>{status}</div>}
      {logged && <div className="success-toast">{logged}</div>}

      {/* Camera button */}
      <button
        onClick={cameraOn ? stopCamera : startCamera}
        disabled={mode === 'image' && !modelReady && !('BarcodeDetector' in window)}
        style={{
          background: cameraOn ? 'var(--danger-bg)' : 'var(--accent)',
          color: cameraOn ? 'var(--danger)' : '#fff',
          border: cameraOn ? '1px solid #f0c0c0' : 'none',
          padding: '12px', borderRadius: 10, fontWeight: 700,
          fontSize: '.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
        }}
      >
        {cameraOn ? <><X size={18} /> Stop Camera</> : <><Camera size={18} /> Start Camera</>}
      </button>

      <div style={{ fontSize: '.72rem', color: 'var(--text3)', textAlign: 'center' }}>
        {mode === 'image' ? 'Point camera at item and hold steady. Auto-recognises in ~1 second.' : 'Point camera at barcode. Supports EAN-13, UPC, Code128.'}
      </div>
    </div>
  );
}

function mapCategory(tag) {
  const t = tag.toLowerCase();
  if (t.includes('dairy') || t.includes('milk') || t.includes('cheese') || t.includes('yogurt')) return 'Dairy';
  if (t.includes('vegetable') || t.includes('veggie')) return 'Vegetables';
  if (t.includes('fruit')) return 'Fruits';
  if (t.includes('beverage') || t.includes('drink') || t.includes('juice') || t.includes('water')) return 'Beverages';
  if (t.includes('snack') || t.includes('chip') || t.includes('biscuit') || t.includes('cookie')) return 'Snacks';
  if (t.includes('meat') || t.includes('fish') || t.includes('seafood') || t.includes('chicken')) return 'Meat & Seafood';
  if (t.includes('grain') || t.includes('rice') || t.includes('pulse') || t.includes('lentil') || t.includes('flour')) return 'Grains & Pulses';
  if (t.includes('spice') || t.includes('sauce') || t.includes('condiment') || t.includes('oil')) return 'Spices & Condiments';
  if (t.includes('clean') || t.includes('detergent') || t.includes('soap')) return 'Cleaning';
  if (t.includes('personal') || t.includes('shampoo') || t.includes('toothpaste')) return 'Personal Care';
  return 'Other';
}

function guessUnit(qty) {
  if (!qty) return 'pcs';
  const q = qty.toLowerCase();
  if (q.includes('ml') || q.includes('milliliter')) return 'mL';
  if (q.includes('l ') || q.includes('litre') || q.includes('liter')) return 'L';
  if (q.includes('kg') || q.includes('kilogram')) return 'kg';
  if (q.includes('g ') || q.includes('gram')) return 'g';
  if (q.includes('pack') || q.includes('packet')) return 'pack';
  return 'pcs';
}
