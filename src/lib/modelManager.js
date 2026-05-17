/**
 * GroCart Image Recognition Engine
 * Uses MobileNet + Transfer Learning via TensorFlow.js
 * Model weights stored globally in Supabase (shared across all users)
 */

let tf = null;
let mobilenet = null;
let classifier = null;
let labels = [];
let isLoaded = false;
let isTraining = false;

const MOBILENET_URL = 'https://tfhub.dev/google/tfjs-model/imagenet/mobilenet_v3_small_100_224/feature_vector/5/default/1';

// ── Load TF.js dynamically ──────────────────────────────────────────────────
export async function loadTF() {
  if (tf) return tf;
  tf = await import('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.17.0/dist/tf.min.js');
  return tf;
}

// ── Load MobileNet feature extractor ───────────────────────────────────────
export async function loadMobileNet(onProgress) {
  await loadTF();
  onProgress?.('Loading base model…');
  mobilenet = await tf.loadGraphModel(MOBILENET_URL, { fromTFHub: true });
  // Warm up
  const warmup = tf.zeros([1, 224, 224, 3]);
  mobilenet.predict(warmup).dispose();
  warmup.dispose();
  onProgress?.('Base model ready');
  return mobilenet;
}

// ── Extract features from image element ────────────────────────────────────
export function extractFeatures(imgElement) {
  return tf.tidy(() => {
    const tensor = tf.browser.fromPixels(imgElement)
      .resizeBilinear([224, 224])
      .toFloat()
      .div(255.0)
      .expandDims(0);
    return mobilenet.predict(tensor);
  });
}

// ── Training data store ─────────────────────────────────────────────────────
let trainingData = {}; // { label: [featureTensor, ...] }

export function addTrainingSample(label, imgElement) {
  if (!mobilenet) throw new Error('Base model not loaded');
  const features = extractFeatures(imgElement);
  if (!trainingData[label]) trainingData[label] = [];
  trainingData[label].push(features);
  return trainingData[label].length;
}

export function getTrainingStatus() {
  const status = {};
  for (const [label, samples] of Object.entries(trainingData)) {
    status[label] = samples.length;
  }
  return status;
}

export function clearTrainingData() {
  for (const tensors of Object.values(trainingData)) {
    tensors.forEach(t => t.dispose());
  }
  trainingData = {};
}

// ── Train classifier ────────────────────────────────────────────────────────
export async function trainModel(itemLabels, onProgress) {
  if (isTraining) throw new Error('Already training');
  isTraining = true;

  try {
    await loadTF();
    onProgress?.('Preparing training data…');

    labels = itemLabels.filter(l => trainingData[l]?.length > 0);
    if (labels.length < 2) throw new Error('Need at least 2 items with photos');

    const xs = [];
    const ys = [];

    for (let i = 0; i < labels.length; i++) {
      const samples = trainingData[labels[i]];
      for (const sample of samples) {
        xs.push(sample);
        const y = new Array(labels.length).fill(0);
        y[i] = 1;
        ys.push(y);
      }
    }

    const xTensor = tf.concat(xs, 0);
    const yTensor = tf.tensor2d(ys);

    // Build simple dense classifier on top of MobileNet features
    classifier = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [1024], units: 128, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({ units: labels.length, activation: 'softmax' })
      ]
    });

    classifier.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    onProgress?.('Training… (this takes ~30 seconds)');

    await classifier.fit(xTensor, yTensor, {
      epochs: 30,
      batchSize: 16,
      shuffle: true,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          const pct = Math.round(((epoch + 1) / 30) * 100);
          onProgress?.(`Training ${pct}% — accuracy ${(logs.acc * 100).toFixed(0)}%`);
        }
      }
    });

    xTensor.dispose();
    yTensor.dispose();
    isLoaded = true;
    onProgress?.('Training complete!');

    return { labels, sampleCounts: labels.map(l => trainingData[l]?.length || 0) };
  } finally {
    isTraining = false;
  }
}

// ── Predict from image ──────────────────────────────────────────────────────
export async function predict(imgElement, threshold = 0.7) {
  if (!classifier || !isLoaded) throw new Error('Model not trained or loaded');
  const features = extractFeatures(imgElement);
  const prediction = classifier.predict(features);
  const scores = await prediction.data();
  features.dispose();
  prediction.dispose();

  const maxIdx = scores.indexOf(Math.max(...scores));
  const confidence = scores[maxIdx];

  if (confidence < threshold) return { label: null, confidence, allScores: Array.from(scores).map((s, i) => ({ label: labels[i], score: s })) };
  return { label: labels[maxIdx], confidence, allScores: Array.from(scores).map((s, i) => ({ label: labels[i], score: s })) };
}

// ── Export model weights for Supabase ──────────────────────────────────────
export async function exportModelWeights() {
  if (!classifier) throw new Error('No trained model');
  const weightsData = [];
  for (const layer of classifier.layers) {
    const layerWeights = layer.getWeights().map(w => ({
      shape: w.shape,
      data: Array.from(w.dataSync())
    }));
    weightsData.push({ name: layer.name, weights: layerWeights });
  }
  return { weights: weightsData, labels, version: Date.now() };
}

// ── Import model weights from Supabase ─────────────────────────────────────
export async function importModelWeights(modelData) {
  await loadTF();
  labels = modelData.labels;

  classifier = tf.sequential({
    layers: [
      tf.layers.dense({ inputShape: [1024], units: 128, activation: 'relu' }),
      tf.layers.dropout({ rate: 0.3 }),
      tf.layers.dense({ units: labels.length, activation: 'softmax' })
    ]
  });
  classifier.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy']
  });

  // Set weights layer by layer
  for (let i = 0; i < modelData.weights.length; i++) {
    const layerData = modelData.weights[i];
    const layer = classifier.layers[i];
    if (!layer || layerData.weights.length === 0) continue;
    const tensors = layerData.weights.map(w => tf.tensor(w.data, w.shape));
    layer.setWeights(tensors);
    tensors.forEach(t => t.dispose());
  }

  isLoaded = true;
  return labels;
}

export const isModelLoaded = () => isLoaded;
export const getLabels = () => labels;
