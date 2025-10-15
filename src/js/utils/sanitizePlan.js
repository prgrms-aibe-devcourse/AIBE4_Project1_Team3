export function sanitizePlan(plan, fx = 9.5) {
  const toInt = (s) => Number(String(s).replace(/[^\d]/g, "")) || 0;

  const krwFromCostReason = (text) => {
    if (!text) return null;

    const m = text.match(/→\s*([\d,]+)\s*원(?:\s*\(1인\))?\s*$/);
    if (m) return toInt(m[1]);

    const j = text.match(/=\s*([\d,]+)\s*엔/);
    if (j) return Math.round(toInt(j[1]) * fx);

    return null;
  };

  let overall = 0;
  for (const day of plan.dayPlans || []) {
    let daySum = 0;
    for (const stop of day.stops || []) {
      const parsed = krwFromCostReason(stop.costReason);
      if (parsed != null) {
        stop.estimatedCost = parsed; 
      }
      stop.estimatedCost = Number(stop.estimatedCost || 0);
      daySum += stop.estimatedCost;
    }
    day.dayTotal = daySum;
    overall += daySum;
  }
  plan.overallTotal = overall;
  return plan;
}
