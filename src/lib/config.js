import { useState, useEffect } from 'react'
import { supabase } from './supabase'

// Fallback targets — used if the app_config row is missing or the fetch fails,
// so the gauge and charts never break on a bad/empty read.
export const DEFAULT_PACE_TARGETS = { breakEven: 60000, goal: 100000, stretch: 125000 }

// One-shot async read of the pace targets from app_config (key = 'pace_targets').
export async function fetchPaceTargets() {
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'pace_targets')
      .maybeSingle()
    if (error || !data?.value) return DEFAULT_PACE_TARGETS
    return { ...DEFAULT_PACE_TARGETS, ...data.value }
  } catch {
    return DEFAULT_PACE_TARGETS
  }
}

// Hook: returns targets, defaulting until the fetch resolves.
export function usePaceTargets() {
  const [targets, setTargets] = useState(DEFAULT_PACE_TARGETS)
  useEffect(() => { fetchPaceTargets().then(setTargets) }, [])
  return targets
}
