import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export function useGroceryData() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [{ data: itemsData, error: iErr }, { data: purchasesData, error: pErr }] =
        await Promise.all([
          supabase.from('grocery_items').select('*').eq('user_id', user.id).order('name'),
          supabase.from('purchases').select('*, grocery_items(name,category,unit)')
            .eq('user_id', user.id).order('purchased_at', { ascending: false })
        ]);
      if (iErr) throw iErr;
      if (pErr) throw pErr;
      setItems(itemsData || []);
      setPurchases(purchasesData || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Items ──────────────────────────────────────────────────────────────────
  const addItem = async (name, category, unit) => {
    const { data, error } = await supabase.from('grocery_items')
      .insert({ user_id: user.id, name: name.trim(), category, unit })
      .select().single();
    if (error) throw error;
    setItems(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    return data;
  };

  const deleteItem = async (id) => {
    const { error } = await supabase.from('grocery_items').delete().eq('id', id);
    if (error) throw error;
    setItems(prev => prev.filter(i => i.id !== id));
    setPurchases(prev => prev.filter(p => p.item_id !== id));
  };

  // ── Purchases ──────────────────────────────────────────────────────────────
  const logPurchase = async ({ item_id, quantity, price_per_unit, store, notes, purchased_at }) => {
    const { data, error } = await supabase.from('purchases')
      .insert({ user_id: user.id, item_id, quantity, price_per_unit, store, notes, purchased_at })
      .select('*, grocery_items(name,category,unit)').single();
    if (error) throw error;
    setPurchases(prev => [data, ...prev]);
    return data;
  };

  const deletePurchase = async (id) => {
    const { error } = await supabase.from('purchases').delete().eq('id', id);
    if (error) throw error;
    setPurchases(prev => prev.filter(p => p.id !== id));
  };

  return { items, purchases, loading, error, addItem, deleteItem, logPurchase, deletePurchase, refresh: fetchAll };
}
