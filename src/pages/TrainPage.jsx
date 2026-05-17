import { useState, useRef, useEffect } from 'react';
import { Camera, X, Check, Upload, Download, Trash2, Brain, AlertCircle, RefreshCw } from 'lucide-react';
import { loadMobileNet, addTrainingSample, trainModel, getTrainingStatus, clearTrainingData, exportModelWeights, importModelWeights, isModelLoaded } from '../lib/modelManager';
import { saveGlobalModel, loadGlobalModel } from '../lib/modelStorage';
import { CATEGORIES, UNITS } from '../lib/recommendations';

export default function TrainPage({ items }) {
  const videoRef   = useRef(null);
  const canvasRef  = useRef(null);
  const streamRef  = useRef(null);

  const [step, setStep]           = useState('select');  // select | capture | train | done
  const [selectedItem, setSelectedItem] = useState(null);
  const [cameraOn, setCameraOn]   = useState(false);
  const [sampleCounts, setSampleCounts] = useState({});
  const [status, setStatus]       = useState('');
  const [baseReady, setBaseReady] = useState(false);
  const [training, setTraining]   = useState(false);
  const [modelInfo, setModelInfo] = useState(null);
  const [captureFlash, setCaptureFlash] = useState(false);

  useEffect(() => {
    initBase();
    loadModelInfo();
    return () => stopCamera();
  }, []);

  const initBase = async () => {
    setStatus('Loading base model…');
    try {
      await loadMobileNet(setStatus);
      setBaseReady(true);
      setStatus('Ready to train');
    } catch (e) {
      setStatus('Error: ' + e.message);
    }
  };

  const loadModelInfo = async () => {
    const info = await loadGlobalModel();
    if (info) setModelInfo(info);
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
    } catch (e) {
      setStatus('Camera error: ' + e.message);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    setCameraOn(false);
  };

  // ── Capture sample ───────────────────────────────────────────────────────
  const captureSample = () => {
    if (!selectedItem || !cameraOn) return;
    const canvas = canvasRef.current;
    const video  = videoRef.current;
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);

    try {
      addTrainingSample(selectedItem.name, canvas);
      const counts = getTrainingStatus();
      setSampleCounts({ ...counts });
      setCaptureFlash(true);
      setTimeout(() => setCaptureFlash(false), 200);
      setStatus(`${selectedItem.name}: ${counts[selectedItem.name]} photo${counts[selectedItem.name] !== 1 ? 's' : ''} captured`);
    } catch (e) {
      setStatus('Error: ' + e.message);
    }
  };

  // ── Train model ──────────────────────────────────────────────────────────
  const handleTrain = async () => {
    const counts = getTrainingStatus();
    const itemsWithSamples = Object.entries(counts).filter(([, c]) => c >= 5);
    if (itemsWithSamples.length < 2) {
      setStatus('Need at least 2 items with 5+ photos each to train');
      return;
    }
    setTraining(true);
    stopCamera();
    try {
      const labels = itemsWithSamples.map(([l]) => l);
      const result = await trainModel(labels, setStatus);
      setStatus('Saving model to cloud…');
      const weights = await exportModelWeights();
      await saveGlobalModel(weights);
      setModelInfo({ labels: weights.labels, updatedAt: new Date().toISOString(), itemCount: weights.labels.length });
      setStatus(`✓ Model trained and saved! ${result.labels.length} items ready.`);
      setStep('done');
    } catch (e) {
      setStatus('Training error: ' + e.message);
    } finally {
      setTraining(false);
    }
  };

  const totalSamples = Object.values(sampleCounts).reduce((a, b) => a + b, 0);
  const readyItems   = Object.entries(sampleCounts).filter(([, c]) => c >= 5).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Model status banner */}
      {modelInfo && (
        <div style={{ background: 'var(--success-bg)', border: '1px solid #b8dfc9', borderRadius: 8, padding: '8px 12px', fontSize: '.76rem', color: 'var(--success)', display: 'flex', gap: 6, alignItems: 'center' }}>
          <Check size={13} />
          Active model: {modelInfo.itemCount} items · Updated {new Date(modelInfo.updatedAt).toLocaleDateString()}
        </div>
      )}

      {status && (
        <div style={{ fontSize: '.78rem', color: training ? 'var(--accent)' : 'var(--text2)', display: 'flex', gap: 6, alignItems: 'center' }}>
          {training && <RefreshCw size={12} style={{ animation: 'spin .8s linear infinite' }} />}
          {status}
        </div>
      )}

      {/* Instructions */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', fontSize: '.78rem', color: 'var(--text2)', lineHeight: 1.6 }}>
        <strong style={{ color: 'var(--text)' }}>How to train:</strong><br />
        1. Select an item below<br />
        2. Start camera and capture 10-20 photos from different angles<br />
        3. Repeat for each item (min 2 items, 5 photos each)<br />
        4. Tap Train Model — saves to cloud for all users
      </div>

      {/* Item selector */}
      <div>
        <div style={{ fontSize: '.74rem', fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 8 }}>
          Select item to photograph
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 220, overflowY: 'auto' }}>
          {items.length === 0 && (
            <div style={{ fontSize: '.8rem', color: 'var(--text3)', padding: '12px 0' }}>No items yet. Add items in the Add tab first.</div>
          )}
          {items.map(item => (
            <button key={item.id}
              onClick={() => { setSelectedItem(item); setStep('capture'); }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: selectedItem?.id === item.id ? 'var(--accent-bg)' : 'var(--surface)',
                border: `1px solid ${selectedItem?.id === item.id ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 8, padding: '8px 12px', textAlign: 'left'
              }}>
              <div>
                <div style={{ fontWeight: 500, fontSize: '.85rem' }}>{item.name}</div>
                <div style={{ fontSize: '.7rem', color: 'var(--text3)' }}>{item.category}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {sampleCounts[item.name] > 0 && (
                  <span style={{
                    background: sampleCounts[item.name] >= 5 ? 'var(--success-bg)' : 'var(--warn-bg)',
                    color: sampleCounts[item.name] >= 5 ? 'var(--success)' : 'var(--warn)',
                    fontSize: '.7rem', fontWeight: 600, padding: '2px 8px', borderRadius: 20
                  }}>
                    {sampleCounts[item.name]} photos
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Camera for capturing */}
      {selectedItem && (
        <div>
          <div style={{ fontSize: '.8rem', fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
            Capturing: <span style={{ color: 'var(--accent)' }}>{selectedItem.name}</span>
            {sampleCounts[selectedItem.name] > 0 && ` — ${sampleCounts[selectedItem.name]} photos`}
          </div>

          <div style={{ position: 'relative', background: '#000', borderRadius: 12, overflow: 'hidden', aspectRatio: '4/3' }}>
            <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }} playsInline muted />
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            {captureFlash && <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,.5)', pointerEvents: 'none' }} />}
            {!cameraOn && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10 }}>
                <Camera size={40} color="rgba(255,255,255,.4)" />
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
            <button onClick={cameraOn ? stopCamera : startCamera}
              style={{ background: cameraOn ? 'var(--danger-bg)' : 'var(--bg2)', color: cameraOn ? 'var(--danger)' : 'var(--text2)', border: '1px solid var(--border)', padding: '9px', borderRadius: 8, fontWeight: 600, fontSize: '.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
              {cameraOn ? <><X size={14} />Stop</> : <><Camera size={14} />Start</>}
            </button>
            <button onClick={captureSample} disabled={!cameraOn || !baseReady}
              className="submit-btn">
              📸 Capture
            </button>
          </div>
          <div style={{ fontSize: '.7rem', color: 'var(--text3)', marginTop: 4, textAlign: 'center' }}>
            Capture 10-20 photos: front, side, angle, different lighting
          </div>
        </div>
      )}

      {/* Training summary + Train button */}
      {totalSamples > 0 && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px' }}>
          <div style={{ fontSize: '.76rem', fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
            Training data: {totalSamples} photos · {readyItems} items ready
          </div>
          {Object.entries(sampleCounts).map(([label, count]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{ fontSize: '.74rem', width: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
              <div style={{ flex: 1, height: 4, background: 'var(--bg3)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min((count / 20) * 100, 100)}%`, background: count >= 5 ? 'var(--success)' : 'var(--warn)', borderRadius: 4 }} />
              </div>
              <div style={{ fontSize: '.72rem', color: count >= 5 ? 'var(--success)' : 'var(--warn)', width: 52, textAlign: 'right' }}>
                {count}/20 {count >= 5 ? '✓' : ''}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={handleTrain}
          disabled={training || readyItems < 2 || !baseReady}
          className="submit-btn" style={{ flex: 1 }}>
          <Brain size={16} /> {training ? 'Training…' : `Train Model (${readyItems} items)`}
        </button>
        {totalSamples > 0 && (
          <button onClick={() => { clearTrainingData(); setSampleCounts({}); }}
            style={{ background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid #f0c0c0', padding: '9px 12px', borderRadius: 8, fontWeight: 600, fontSize: '.82rem' }}>
            Clear
          </button>
        )}
      </div>

      {readyItems < 2 && totalSamples > 0 && (
        <div style={{ fontSize: '.74rem', color: 'var(--text3)', textAlign: 'center' }}>
          Need at least 2 items with 5+ photos each to train
        </div>
      )}
    </div>
  );
}
