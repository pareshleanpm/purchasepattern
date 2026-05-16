import { differenceInDays, parseISO } from 'date-fns';

/**
 * Analyse purchase history to recommend items.
 * Returns array of { item, avgDaysBetween, lastPurchased, daysSinceLast, urgency }
 * urgency: 'overdue' | 'due-soon' | 'upcoming'
 */
export function computeRecommendations(items, purchases) {
  const byItem = {};

  // Group purchases by item
  for (const p of purchases) {
    if (!byItem[p.item_id]) byItem[p.item_id] = [];
    byItem[p.item_id].push(p.purchased_at);
  }

  const now = new Date();
  const recommendations = [];

  for (const item of items) {
    const dates = (byItem[item.id] || [])
      .map(d => parseISO(d))
      .sort((a, b) => a - b);

    if (dates.length === 0) continue;

    const lastPurchased = dates[dates.length - 1];
    const daysSinceLast = differenceInDays(now, lastPurchased);

    let avgDaysBetween = null;
    if (dates.length >= 2) {
      const gaps = [];
      for (let i = 1; i < dates.length; i++) {
        gaps.push(differenceInDays(dates[i], dates[i - 1]));
      }
      avgDaysBetween = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
    } else {
      // Single purchase — use category defaults
      avgDaysBetween = categoryDefaultDays(item.category);
    }

    if (!avgDaysBetween || avgDaysBetween <= 0) continue;

    const daysUntilNext = avgDaysBetween - daysSinceLast;
    const pctElapsed = daysSinceLast / avgDaysBetween;

    let urgency;
    if (pctElapsed >= 1.1) urgency = 'overdue';
    else if (pctElapsed >= 0.8) urgency = 'due-soon';
    else if (pctElapsed >= 0.6) urgency = 'upcoming';
    else continue; // not near due yet

    recommendations.push({
      item,
      avgDaysBetween,
      lastPurchased,
      daysSinceLast,
      daysUntilNext: Math.max(daysUntilNext, 0),
      urgency,
      purchaseCount: dates.length,
      confidence: dates.length >= 3 ? 'high' : dates.length === 2 ? 'medium' : 'low'
    });
  }

  // Sort: overdue first, then due-soon, then upcoming; within each by most elapsed %
  const order = { overdue: 0, 'due-soon': 1, upcoming: 2 };
  return recommendations.sort((a, b) => {
    const uo = order[a.urgency] - order[b.urgency];
    if (uo !== 0) return uo;
    return b.daysSinceLast / b.avgDaysBetween - a.daysSinceLast / a.avgDaysBetween;
  });
}

function categoryDefaultDays(cat) {
  const defaults = {
    'Dairy': 7,
    'Vegetables': 5,
    'Fruits': 5,
    'Beverages': 14,
    'Snacks': 14,
    'Meat & Seafood': 7,
    'Grains & Pulses': 30,
    'Spices & Condiments': 45,
    'Cleaning': 30,
    'Personal Care': 30,
    'Other': 14
  };
  return defaults[cat] || 14;
}

export const CATEGORIES = [
  'Dairy', 'Vegetables', 'Fruits', 'Beverages', 'Snacks',
  'Meat & Seafood', 'Grains & Pulses', 'Spices & Condiments',
  'Cleaning', 'Personal Care', 'Other'
];

export const UNITS = ['pcs', 'kg', 'g', 'L', 'mL', 'pack', 'dozen', 'bottle', 'box', 'bag'];
