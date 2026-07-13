import { supabase } from './supabase'

// Deleting a project_item cascades in the DB:
//   project_items → proofs → proof_comments
// Storage is NOT covered by any FK, so proof images must be cleared here.
// Item numbers are renumbered so the project keeps a gapless 01, 02, 03 sequence.
//
// Used by Projects (item drawer) and Calendar (List view). Do not inline a
// bare .delete() anywhere else — it will leave images in the bucket.

export async function getItemProofCount(itemId) {
  const { count, error } = await supabase
    .from('proofs')
    .select('id', { count: 'exact', head: true })
    .eq('item_id', itemId)
  if (error) { console.error('proof count failed:', error); return 0 }
  return count ?? 0
}

export async function deleteItemCascade(itemId) {
  // 1. what project is this in, and what proofs hang off it?
  const { data: item } = await supabase
    .from('project_items').select('project_id').eq('id', itemId).single()
  const { data: proofs } = await supabase
    .from('proofs').select('id').eq('item_id', itemId)

  // 2. clear proof images from storage (path is proofs/{proof_id}/{filename})
  for (const p of proofs || []) {
    const { data: files } = await supabase.storage
      .from('proof-images').list(`proofs/${p.id}`)
    if (files?.length) {
      await supabase.storage
        .from('proof-images')
        .remove(files.map(f => `proofs/${p.id}/${f.name}`))
    }
  }

  // 3. delete the item — proofs and proof_comments cascade in the DB
  const { error } = await supabase.from('project_items').delete().eq('id', itemId)
  if (error) return { error }

  // 4. renumber the project's surviving items (item_number is DISPLAYED,
  //    so a gap looks like a bug)
  const projectId = item?.project_id
  if (!projectId) return { error: null, projectId: null, renumbered: [] }

  const { data: remaining } = await supabase
    .from('project_items')
    .select('id, item_number, name, scheduled_date, status, sort_order, note')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('item_number')

  const renumbered = (remaining || []).map((it, i) => ({
    ...it,
    sort_order:  i,
    item_number: String(i + 1).padStart(2, '0'),
  }))

  await Promise.all(renumbered.map(it =>
    supabase.from('project_items')
      .update({ sort_order: it.sort_order, item_number: it.item_number })
      .eq('id', it.id)
  ))

  return { error: null, projectId, renumbered }
}
