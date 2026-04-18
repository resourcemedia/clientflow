// Sandbox — static visual shell for Projects page UI
// No state, no data fetching. Style objects match Projects.jsx exactly.
// To update the live app: copy the style={{ }} object to the matching element.

// ── icons ─────────────────────────────────────────────────────────────────────
const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/>
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
)
const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
)
const DragDots = () => (
  <span style={{ fontSize: 14, color: 'var(--text3)', userSelect: 'none' }}>⠿</span>
)
const TriArrow = ({ open }) => (
  <svg
    width="9" height="9" viewBox="0 0 10 10" fill="currentColor"
    style={{
      transition:      'transform 0.15s',
      transform:       open ? 'rotate(90deg)' : 'rotate(0deg)',
      flexShrink:      0,
    }}
  >
    <path d="M3 1.5l4 3.5-4 3.5V1.5z"/>
  </svg>
)

// ── sample data ───────────────────────────────────────────────────────────────
const ITEMS = [
  { id: 1, name: 'Initial Interface Design', item_number: '01', scheduled_date: '2026-04-12' },
  { id: 2, name: 'Logo Refinements',         item_number: '02', scheduled_date: '2026-04-12' },
  { id: 3, name: 'Brand Guidelines',         item_number: '03', scheduled_date: '2026-05-01' },
]
const PROOFS = [
  { id: 1, version: 1, status: 'In Review', comments: 'Lighten the tagline color' },
]
const TASKS = [
  { id: 1, note: 'Write homepage copy',   status_note: 'Draft due by end of week', assignee: 'JO', updated: '4/10/26', done: false },
  { id: 2, note: 'Review design mockups', status_note: '—',                        assignee: 'JO', updated: '4/11/26', done: true  },
]

// ── shared style objects ──────────────────────────────────────────────────────
const th = {
  padding:        '6px 12px',
  textAlign:      'left',
  fontSize:       11,
  fontWeight:     600,
  letterSpacing:  '0.07em',
  textTransform:  'uppercase',
  color:          'var(--text3)',
}
const itemTh = {
  ...th,
  color:          '#fff',
  background:     '#89bac9',
  borderTop:      'none',
  borderBottom:   'none',
}
const proofTh = {
  ...th,
  color:          '#fff',
  background:     '#d5b6dd',
  borderTop:      'none',
  borderBottom:   'none',
}
const taskTh = {
  ...th,
  color:          '#fff',
  background:     '#9dc691',
  borderTop:      'none',
  borderBottom:   'none',
}

// ── ItemsDrawer ───────────────────────────────────────────────────────────────
function ItemsDrawer() {
  const proofOpenId = 2 // Logo Refinements shown open

  return (
    <div style={{
      background:   'var(--bg3)',
      borderTop:    '2px solid var(--border2)',
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>

        <thead>
          <tr>
            <th style={{ width: 24, padding: '6px 4px 6px 12px', background: '#89bac9', borderTop: 'none', borderBottom: 'none' }} />
            <th style={{ width: 110,                              background: '#89bac9', borderTop: 'none', borderBottom: 'none' }} />
            <th style={{ ...itemTh, width: 180 }}>Item</th>
            <th style={{ ...itemTh, width: 80  }}>Order</th>
            <th style={{ ...itemTh, width: 120 }}>Scheduled</th>
            <th style={{ width: 40,                              background: '#89bac9', borderTop: 'none', borderBottom: 'none' }} />
          </tr>
        </thead>

        <tbody>
          {ITEMS.map(item => {
            const isOverdue = item.scheduled_date && item.scheduled_date < '2026-04-18'
            const proofOpen = item.id === proofOpenId
            return (
              <>
                {/* ── item row ── */}
                <tr key={item.id} style={{ background: '#e6f8fc', cursor: 'default' }}>

                  <td style={{
                    padding:      '7px 4px 7px 12px',
                    width:        24,
                    cursor:       'grab',
                    color:        'var(--text3)',
                    fontSize:     14,
                    userSelect:   'none',
                    borderBottom: '1px solid #89bac9',
                  }}>
                    <DragDots />
                  </td>

                  <td style={{
                    padding:      '4px 0',
                    borderBottom: '1px solid #89bac9',
                  }}>
                    <button
                      className="btn btn-sm"
                      style={{
                        display:     'inline-flex',
                        alignItems:  'center',
                        gap:         4,
                        background:  '#d5b6dd',
                        color:       '#fff',
                        border:      'none',
                        fontSize:    12,
                        fontWeight:  600,
                      }}
                    >
                      <TriArrow open={proofOpen} />
                      Proofs
                    </button>
                  </td>

                  <td style={{
                    padding:      '4px 12px',
                    fontSize:     13,
                    fontWeight:   600,
                    color:        'var(--text)',
                    borderBottom: '1px solid #89bac9',
                  }}>
                    {item.name}
                  </td>

                  <td style={{
                    padding:      '7px 12px',
                    fontSize:     12,
                    color:        'var(--text3)',
                    fontFamily:   'DM Mono, monospace',
                    borderBottom: '1px solid #89bac9',
                  }}>
                    {item.item_number}
                  </td>

                  <td style={{
                    padding:      '4px 12px',
                    fontSize:     12,
                    fontFamily:   'DM Mono, monospace',
                    color:        isOverdue ? 'var(--red)' : 'var(--text3)',
                    fontWeight:   isOverdue ? 600 : 400,
                    borderBottom: '1px solid #89bac9',
                  }}>
                    {item.scheduled_date
                      ? (() => { const [y,m,d] = item.scheduled_date.split('-'); return `${m}/${d}/${y.slice(2)}` })()
                      : '—'}
                  </td>

                  <td style={{
                    padding:      '7px 10px 7px 4px',
                    whiteSpace:   'nowrap',
                    borderBottom: '1px solid #89bac9',
                  }}>
                    <button
                      className="btn btn-ghost btn-icon btn-sm"
                      style={{ color: 'var(--text3)', border: '1px solid #333' }}
                    >
                      <TrashIcon />
                    </button>
                  </td>

                </tr>

                {/* ── proof sub-drawer ── */}
                {proofOpen && (
                  <tr key={`proof-${item.id}`}>
                    <td colSpan={6} style={{ padding: 0 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>

                        <thead>
                          <tr>
                            <th style={{ width: 125, padding: '6px 12px', background: '#d5b6dd', borderTop: 'none', borderBottom: 'none' }} />
                            <th style={{ ...proofTh }}>Item</th>
                            <th style={{ ...proofTh }}>Proof</th>
                            <th style={{ ...proofTh }}>Status</th>
                            <th style={{ ...proofTh }}>Comments / Changes</th>
                            <th style={{ width: 70,                           background: '#d5b6dd', borderTop: 'none', borderBottom: 'none' }} />
                          </tr>
                        </thead>

                        <tbody>
                          {PROOFS.map(proof => (
                            <tr key={proof.id} style={{ background: '#f2eaf4' }}>

                              <td style={{
                                padding:      '5px 12px 5px 40px',
                                borderBottom: '1px solid #d5b6dd',
                              }}>
                                <button style={{
                                  color:       '#333',
                                  width:       70,
                                  background:   '#fff',
                                  border:       '1px solid #ffffff',
                                  borderRadius: 6,
                                  padding:      '5px 8px 2px 10px',
                                  fontSize:     12,
                                  cursor:       'default',
                                  display:      'inline-flex',
                                  alignItems:   'center',
                                  gap:          4,
                                }}>
                                  👁 View
                                </button>
                              </td>

                              <td style={{ padding: '5px 12px', fontSize: 13, borderBottom: '1px solid #d5b6dd' }}>
                                {item.name}
                              </td>

                              <td style={{ padding: '5px 12px', fontFamily: 'DM Mono, monospace', fontSize: 12, borderBottom: '1px solid #d5b6dd' }}>
                                {item.item_number}{String.fromCharCode(64 + proof.version)}
                              </td>

                              <td style={{ padding: '5px 12px', fontSize: 13, borderBottom: '1px solid #d5b6dd' }}>
                                {proof.status}
                              </td>

                              <td style={{ padding: '5px 12px', fontSize: 13, borderBottom: '1px solid #d5b6dd' }}>
                                {proof.comments}
                              </td>

                              <td style={{
                                padding:      '5px 8px',
                                whiteSpace:   'nowrap',
                                borderBottom: '1px solid #d5b6dd',
                              }}>
                                <div style={{ display: 'flex', gap: 4 }}>
                                  <button className="btn btn-ghost btn-icon btn-sm" style={{ border: '1px solid #333' }}><TrashIcon /></button>
                                  <button className="btn btn-ghost btn-icon btn-sm" style={{ border: '1px solid #333' }}><PlusIcon /></button>
                                </div>
                              </td>

                            </tr>
                          ))}

                          {/* add proof footer */}
                          <tr style={{ background: '#f2eaf4' }}>
                            <td colSpan={6} style={{ padding: '8px 12px 8px 40px', borderTop: '1px solid #d5b6dd' }}>
                              <button
                                className="btn btn-sm"
                                style={{
                                  background:  '#d5b6dd',
                                  color:       '#fff',
                                  fontSize:    12,
                                  fontWeight:  600,
                                  border:      'none',
                                }}
                              >
                                + Add Proof
                              </button>
                            </td>
                          </tr>
                        </tbody>

                      </table>
                    </td>
                  </tr>
                )}
              </>
            )
          })}

          {/* add item footer */}
          <tr style={{ background: '#e6f8fc' }}>
            <td colSpan={6} style={{ padding: '8px 12px 8px 40px', borderTop: '1px solid var(--border)' }}>
              <button
                className="btn btn-sm"
                style={{
                  background:  'none',
                  color:       '#89bac9',
                  fontSize:    12,
                  fontWeight:  600,
                  border:      '1px solid #89bac9',
                }}
              >
                + Add item
              </button>
            </td>
          </tr>
        </tbody>

      </table>
    </div>
  )
}

// ── TasksDrawer ───────────────────────────────────────────────────────────────
function TasksDrawer() {
  return (
    <div style={{
      background:   'var(--bg3)',
      borderTop:    '2px solid var(--border2)',
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>

        <thead>
          <tr>
            <th style={{ width: 24, padding: '6px 4px 6px 12px', background: '#9dc691', borderTop: 'none', borderBottom: 'none' }} />
            <th style={{ ...taskTh              }}>Task</th>
            <th style={{ ...taskTh              }}>Note</th>
            <th style={{ ...taskTh, width: 80   }}>Assigned</th>
            <th style={{ ...taskTh, width: 100  }}>Updated</th>
            <th style={{ width: 40, background: '#9dc691', borderTop: 'none', borderBottom: 'none' }} />
          </tr>
        </thead>

        <tbody>
          {TASKS.map(task => (
            <tr key={task.id} style={{ background: '#f7fff5', cursor: 'default' }}>

              <td style={{
                padding:      '7px 4px 7px 12px',
                width:        24,
                cursor:       'grab',
                borderBottom: '1px solid #9dc691',
              }}>
                <DragDots />
              </td>

              <td
                className="td-main"
                style={{
                  minWidth:     140,
                  borderBottom: '1px solid #9dc691',
                }}
              >
                {task.note}
              </td>

              <td style={{
                minWidth:     120,
                padding:      '7px 12px',
                fontSize:     13,
                color:        'var(--text3)',
                borderBottom: '1px solid #9dc691',
              }}>
                {task.status_note}
              </td>

              <td style={{
                padding:      '7px 12px',
                fontSize:     12,
                color:        'var(--text3)',
                borderBottom: '1px solid #9dc691',
              }}>
                {task.assignee}
              </td>

              <td style={{
                padding:      '7px 12px',
                fontFamily:   'DM Mono, monospace',
                fontSize:     11,
                color:        'var(--text3)',
                whiteSpace:   'nowrap',
                borderBottom: '1px solid #9dc691',
              }}>
                {task.updated}
              </td>

              <td style={{
                padding:      '7px 10px 7px 4px',
                whiteSpace:   'nowrap',
                borderBottom: '1px solid #9dc691',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--text3)', border: '1px solid #333' }}>
                    <PlusIcon />
                  </button>
                  <button
                    className="btn btn-ghost btn-icon btn-sm"
                    style={{ color: task.done ? 'var(--green)' : 'var(--text3)', border: '1px solid #333' }}
                  >
                    {task.done
                      ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                      : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
                    }
                  </button>
                  <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--text3)', border: '1px solid #333' }}>
                    <TrashIcon />
                  </button>
                </div>
              </td>

            </tr>
          ))}

          {/* add task footer */}
          <tr style={{ background: '#f7fff5' }}>
            <td colSpan={6} style={{ padding: '8px 12px 8px 40px', borderTop: '1px solid var(--border)' }}>
              <button
                className="btn btn-sm"
                style={{
                  background:  'none',
                  color:       '#9dc691',
                  fontSize:    12,
                  fontWeight:  600,
                  border:      '1px solid #9dc691',
                }}
              >
                + Add Task
              </button>
            </td>
          </tr>
        </tbody>

      </table>
    </div>
  )
}

// ── ProjectRow ────────────────────────────────────────────────────────────────
function ProjectRow({ number, client, tags, name, itemsOpen, tasksOpen }) {
  return (
    <>
      <tr style={{ cursor: 'pointer' }}>

        <td style={{
          padding:    '12px 4px 12px 4px',
          width:      20,
          color:      'var(--text3)',
          fontSize:   15,
          cursor:     'grab',
          userSelect: 'none',
        }}>
          ⠿
        </td>

        <td style={{ padding: '8px 4px 8px 12px', whiteSpace: 'nowrap' }}>
          <button
            className="btn btn-sm"
            style={{
              display:     'inline-flex',
              alignItems:  'center',
              gap:         4,
              marginRight: 4,
              background:  '#9dc691',
              color:       '#fff',
              border:      'none',
            }}
          >
            <TriArrow open={tasksOpen} /> Tasks
          </button>
          <button
            className="btn btn-sm"
            style={{
              display:    'inline-flex',
              alignItems: 'center',
              gap:        4,
              background: '#89bac9',
              color:      '#fff',
              border:     'none',
            }}
          >
            <TriArrow open={itemsOpen} /> Items
          </button>
        </td>

        <td style={{
          fontFamily: 'DM Mono, monospace',
          color:      'var(--text3)',
          fontSize:   12,
          padding:    '8px 12px',
        }}>
          {number}
        </td>

        <td style={{ color: 'var(--text2)', fontSize: 13, padding: '8px 12px' }}>
          {client}
        </td>

        <td style={{ color: 'var(--text2)', fontSize: 13, whiteSpace: 'nowrap', padding: '8px 12px' }}>
          {tags}
        </td>

        <td className="td-main" style={{ padding: '8px 12px' }}>
          {name}
        </td>

        <td style={{ whiteSpace: 'nowrap', padding: '8px 10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button className="btn btn-ghost btn-sm" style={{ border: '1px solid #333' }}>Items</button>
            <button className="btn btn-ghost btn-sm" style={{ border: '1px solid #333' }}>✏️</button>
            <button className="btn btn-ghost btn-sm" style={{ border: '1px solid #333', color: 'var(--red)' }}><TrashIcon /></button>
            <button className="btn btn-ghost btn-sm" style={{ border: '1px solid #333' }}><PlusIcon /></button>
          </div>
        </td>

      </tr>

      {itemsOpen && (
        <tr><td colSpan={7} style={{ padding: 0 }}><ItemsDrawer /></td></tr>
      )}
      {tasksOpen && (
        <tr><td colSpan={7} style={{ padding: 0 }}><TasksDrawer /></td></tr>
      )}
    </>
  )
}

// ── Page shell ────────────────────────────────────────────────────────────────
export default function ProjectsSandbox() {
  return (
    <div className="fade-in">

      <div className="topbar">
        <span style={{ fontSize: 20, fontWeight: 700 }}>Projects — Sandbox</span>
      </div>

      <div className="page-content">
        <div className="card">
          <div className="table-wrap">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>

              <tbody>
                {/* client group header */}
                <tr style={{ background: '#595958', cursor: 'default' }}>
                  <td colSpan={7} style={{
                    padding:       '6px 16px',
                    fontWeight:    700,
                    fontSize:      13,
                    color:         '#fff',
                    letterSpacing: '0.04em',
                  }}>
                    Adams Orthodontics
                  </td>
                </tr>

                <ProjectRow number="8083" client="Adams Orthodontics" tags="CO"          name="Test Project"    itemsOpen tasksOpen={false} />
                <ProjectRow number="8062" client="Adams Orthodontics" tags="ST | Website" name="Website Redesign" itemsOpen={false} tasksOpen />
                <ProjectRow number="8041" client="Adams Orthodontics" tags="DS | Logo"    name="Brand Identity"   itemsOpen={false} tasksOpen={false} />
              </tbody>

              <tbody>
                {/* project footer */}
                <tr>
                  <td colSpan={7} style={{ padding: '12px 20px' }}>
                    <button className="btn btn-ghost btn-sm">+ Add project</button>
                  </td>
                </tr>
              </tbody>

            </table>
          </div>
        </div>
      </div>

    </div>
  )
}
