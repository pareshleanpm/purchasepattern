import { supabase } from './supabase';

// ── Global model (shared across all users) ──────────────────────────────────
export async function saveGlobalModel(modelData) {
  const { error } = await supabase
    .from('global_model')
    .upsert({
      id: 1,
      model_weights: modelData.weights,
      model_labels: modelData.labels,
      model_updated_at: new Date().toISOString(),
      item_count: modelData.labels.length
    });
  if (error) throw error;
}

export async function loadGlobalModel() {
  const { data, error } = await supabase
    .from('global_model')
    .select('*')
    .eq('id', 1)
    .single();
  if (error) return null;
  if (!data?.model_weights || !data?.model_labels) return null;
  return {
    weights: data.model_weights,
    labels: data.model_labels,
    updatedAt: data.model_updated_at,
    itemCount: data.item_count
  };
}

// ── User settings (Gemini key per user) ────────────────────────────────────
export async function saveUserSettings(userId, settings) {
  const { error } = await supabase
    .from('user_settings')
    .upsert({ user_id: userId, ...settings });
  if (error) throw error;
}

export async function loadUserSettings(userId) {
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error) return {};
  return data || {};
}
