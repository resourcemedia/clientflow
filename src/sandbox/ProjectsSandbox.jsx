// Sandbox — static visual shell for Projects page UI
// No state, no data fetching. Style objects match Projects.jsx exactly.
// To update the live app: copy the style={{ }} object to the matching element.

import iconTodo   from '../assets/icon_todo.svg'
import iconItem   from '../assets/icon_item.svg'
import iconProofs from '../assets/icon_proofs.svg'
import iconView   from '../assets/icon_view.svg'

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

// ── sample data ───────────────────────────────────────────────────────────────
const ITEMS = [
  { id: 1, name: 'Initial Interface Design', item_number: '01', scheduled_date: '2026-04-12' },
  { id: 2, name: 'Logo Refinements',         item_number: '02', scheduled_date: '2026-04-12' },
  { id: 3, name: 'Brand Guidelines',         item_number: '03', scheduled_date: '2026-05-01' },
]
const PROOFS = [
  { id: 1, version: 1, status: 'In Review', comments: 'Lighten the tagline color' },
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
            {/* ── item drag ── */}
            <th style={{ width: 25, padding: '6px 4px 6px 12px', background: '#89bac9', borderTop: 'none', borderBottom: 'none' }} />
            {/* ── item proofs button ── */}
            <th style={{ width: 75, 
              
              background: '#89bac9', borderTop: 'none', borderBottom: 'none' }} />
            {/* ── item name ── */}
            <th style={{ ...itemTh, width: 200 }}>Item</th>
            {/* ── item order ── */}
            <th style={{ ...itemTh, width: 75 }}>Order</th>
            {/* ── item scheduled ── */}
            <th style={{ ...itemTh }}>Scheduled</th>
            {/* ── item actions ── */}
            <th style={{ width: 225, background: '#89bac9', borderTop: 'none', borderBottom: 'none' }} />
          </tr>
        </thead>

        <tbody>
          {ITEMS.map(item => {
            const isOverdue = item.scheduled_date && item.scheduled_date < '2026-04-18'
            const proofOpen = item.id === proofOpenId
            return (
              <>
                {/* ── item row ── */}
                <tr key={item.id} className="item-row" style={{ background: '#e6f8fc', cursor: 'default' }}>

                  <td style={{
                    padding:      '7px 4px 7px 12px',
                    width:        25,
                    cursor:       'grab',
                    color:        'var(--text3)',
                    fontSize:     14,
                    userSelect:   'none',
                    borderBottom: '1px solid #89bac9',
                    borderRight:  '1px solid #89bac9',
                  }}>
                    <DragDots />
                  </td>

                  {/* ── item proof button ── */}

                  <td style={{
                    padding:      '4px 0',
                    borderBottom: '1px solid #89bac9',
                    borderRight:  '1px solid #89bac9',
                    textAlign:    'center',
                  }}>
                    <button
                      className="btn btn-ghost btn-icon"
                      title="Toggle Proofs"
                      style={{
                        padding: 0,
                        border: 'none',
                        background: 'none',
                        opacity: proofOpen ? 1 : 0.45, transition: 'opacity 0.15s' }}
                    >
                      <img src={iconProofs} width={25} height={25} alt="Proofs" style={{ display: 'block' }} />
                    </button>
                  </td>

                  {/* ── item items ── */}

                  <td style={{
                    padding:      '4px 12px',
                    fontSize:     13,
                    fontWeight:   600,
                    color:        'var(--text)',
                    borderBottom: '1px solid #89bac9',
                    borderRight:  '1px solid #89bac9',
                  }}>
                    {item.name}
                  </td>

                  {/* ── item order ── */}

                  <td style={{
                    padding:      '7px 12px',
                    fontSize:     12,
                    color:        'var(--text3)',
                    borderBottom: '1px solid #89bac9',
                    borderRight:  '1px solid #89bac9',
                    textAlign:    'center',
                  }}>
                    {item.item_number}
                  </td>

                   {/* ── item scheduled date ── */}

                  <td style={{
                    padding:      '4px 12px',
                    fontSize:     12,
                    fontFamily:   'DM Mono, monospace',
                    color:        isOverdue ? 'var(--red)' : 'var(--text3)',
                    fontWeight:   isOverdue ? 600 : 400,
                    borderBottom: '1px solid #89bac9',
                    borderRight:  '1px solid #89bac9',
                  }}>
                    {item.scheduled_date
                      ? (() => { const [y,m,d] = item.scheduled_date.split('-'); return `${m}/${d}/${y.slice(2)}` })()
                      : '—'}
                  </td>

                   {/* ── item trash button ── */}

                  <td style={{
                    padding:      '7px 10px 7px 4px',
                    whiteSpace:   'nowrap',
                    borderBottom: '1px solid #89bac9',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                      <button
                        className="btn btn-ghost btn-icon btn-sm"
                        style={{ color: 'var(--text3)', border: '1px solid #333' }}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </td>

                </tr>

                {/* ── proof sub-drawer ── */}
                {proofOpen && (
                  <tr key={`proof-${item.id}`}>
                    <td colSpan={6} style={{ padding: 0 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>

                        <thead>
                          <tr>
                            <th style={{ width: 25, background: '#d5b6dd', borderTop: 'none', borderBottom: 'none' }} />
                            <th style={{ width: 65, background: '#d5b6dd', borderTop: 'none', borderBottom: 'none' }} />
                            <th style={{ ...proofTh, width: 200 }}>Item</th>
                            <th style={{ ...proofTh, width: 75 }}>Proof</th>
                            <th style={{ ...proofTh }}>Status</th>
                            <th style={{ ...proofTh }}>Comments / Changes</th>
                            <th style={{ width: 225, background: '#d5b6dd', borderTop: 'none', borderBottom: 'none' }} />
                          </tr>
                        </thead>

                        <tbody>
                          {PROOFS.map(proof => (
                            <tr key={proof.id} className="proof-row" style={{ background: '#f2eaf4' }}>

                              <td style={{ width: 25, borderBottom: '1px solid #d5b6dd', borderRight: '1px solid #d5b6dd' }} />
                              <td style={{ padding: '5px 8px', borderBottom: '1px solid #d5b6dd', borderRight: '1px solid #d5b6dd' }}>
                                <img src={iconView} width={25} height={25} alt="View" style={{ display: 'block', cursor: 'pointer' }} />
                              </td>

                              <td style={{ padding: '5px 12px', fontSize: 13, borderBottom: '1px solid #d5b6dd', borderRight: '1px solid #d5b6dd' }}>
                                {item.name}
                              </td>

                              {/* ── proof number ── */}

                              <td style={{ padding: '5px 12px', fontSize: 12, borderBottom: '1px solid #d5b6dd', borderRight: '1px solid #d5b6dd', textAlign: 'center' }}>
                                {item.item_number}{String.fromCharCode(64 + proof.version)}
                              </td>

                              <td style={{ padding: '5px 12px', fontSize: 13, borderBottom: '1px solid #d5b6dd', borderRight: '1px solid #d5b6dd' }}>
                                {proof.status}
                              </td>

                              <td style={{ padding: '5px 12px', fontSize: 13, borderBottom: '1px solid #d5b6dd', borderRight: '1px solid #d5b6dd' }}>
                                {proof.comments}
                              </td>

                              <td style={{
                                padding:      '5px 8px',
                                whiteSpace:   'nowrap',
                                borderBottom: '1px solid #d5b6dd',
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                                  <button className="btn btn-ghost btn-icon btn-sm" style={{ border: '1px solid #333' }}><TrashIcon /></button>
                                  <button className="btn btn-ghost btn-icon btn-sm" style={{ border: '1px solid #333' }}><PlusIcon /></button>
                                </div>
                              </td>

                            </tr>
                          ))}

                          {/* add proof footer */}
                          <tr style={{ background: '#f2eaf4' }}>
                            <td colSpan={7} style={{ padding: '8px 12px 8px 40px', borderTop: '1px solid #d5b6dd' }}>
                              <button
                                className="btn btn-sm"
                                style={{
                                  background:  'none',
                                  color:       '#d5b6dd',
                                  fontSize:    12,
                                  fontWeight:  600,
                                  border:      '1px solid #d5b6dd',
                                }}
                              >
                                +
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
                +
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

         {/* ── item | header ── */} 

        <thead>
          <tr>
            <th style={{ width: 25, padding: '6px 4px 6px 12px', background: '#9dc691', borderTop: 'none', borderBottom: 'none' }} />
            <th style={{ width: 65, background: '#9dc691', borderTop: 'none', borderBottom: 'none' }} />
            <th style={{ ...taskTh, width: 200 }}>Task</th>
            <th style={{ ...taskTh              }}>Note</th>
            <th style={{ ...taskTh, width: 75   }}>Assigned</th>
            <th style={{ ...taskTh              }}>Updated</th>
            <th style={{ width: 225, background: '#9dc691', borderTop: 'none', borderBottom: 'none' }} />
          </tr>
        </thead>

        <tbody>
          {TASKS.map(task => (
            <tr key={task.id} style={{ background: '#f7fff5', cursor: 'default' }}>

               {/* ── tasks | drag dots ── */}

              <td style={{
                padding:      '7px 4px 7px 12px',
                width:        25,
                cursor:       'grab',
                borderBottom: '1px solid #9dc691',
                borderRight:  '1px solid #9dc691',
              }}>
                <DragDots />
              </td>

              {/* ── tasks | blank ── */}

              <td style={{ width: 65, borderBottom: '1px solid #9dc691', borderRight: '1px solid #9dc691' }} />

              {/* ── tasks | note ── */}

              <td
                className="td-main"
                style={{
                  borderBottom: '1px solid #9dc691',
                  borderRight:  '1px solid #9dc691',
                }}
              >
                {task.note}
              </td>
               {/* ── tasks | note ── */}

              <td style={{
                padding:      '7px 12px',
                fontSize:     13,
                color:        'var(--text3)',
                borderBottom: '1px solid #9dc691',
                borderRight:  '1px solid #9dc691',
              }}>
                {task.status_note}
              </td>

              {/* ── tasks | asigned ── */}

              <td style={{
                padding:      '7px 12px',
                fontSize:     12,
                color:        'var(--text3)',
                borderBottom: '1px solid #9dc691',
                borderRight:  '1px solid #9dc691',
              }}>
                {task.assignee}
              </td>

              {/* ── tasks | updated ── */}

              <td style={{
                padding:      '7px 12px',
                fontFamily:   'DM Mono, monospace',
                fontSize:     11,
                color:        'var(--text3)',
                whiteSpace:   'nowrap',
                borderBottom: '1px solid #9dc691',
                borderRight:  '1px solid #9dc691',
              }}>
                {task.updated}
              </td>

              {/* ── tasks | buttons ── */}

              <td style={{
                padding:      '7px 10px 7px 4px',
                whiteSpace:   'nowrap',
                borderBottom: '1px solid #9dc691',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
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
            <td colSpan={7} style={{ padding: '8px 12px 8px 40px', borderTop: '1px solid var(--border)' }}>
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
                + 
              </button>
            </td>
          </tr>
        </tbody>

      </table>
    </div>
  )
}

// ── ProjectRow ────────────────────────────────────────────────────────────────
function ProjectRow({ number, tags, name, itemsOpen, tasksOpen }) {
  return (
    <>
      <tr style={{ cursor: 'pointer' }}>

        {/* drag handle */}
        <td style={{
          padding:     '12px 4px 12px 4px',
          width:       25,
          color:       'var(--text3)',
          fontSize:    15,
          cursor:      'grab',
          userSelect:  'none',
          borderRight: '1px solid var(--border)',
        }}>
          ⠿
        </td>

        {/* expand toggles */}
        <td style={{
          borderRight: '1px solid var(--border)',
          width: 65,
          padding: '8px 8px 8px 12px',
          whiteSpace: 'nowrap' }}>
          <button
            className="btn btn-ghost btn-icon"
            title="Toggle Tasks"
            style={{ padding: 0, border: 'none', background: 'none', marginRight: 4, opacity: tasksOpen ? 1 : 0.45, transition: 'opacity 0.15s' }}
          >
            <img src={iconTodo} width={25} height={25} alt="Tasks" style={{ display: 'block' }} />
          </button>
          <button
            className="btn btn-ghost btn-icon"
            title="Toggle Items"
            style={{ padding: 0, border: 'none', background: 'none', opacity: itemsOpen ? 1 : 0.45, transition: 'opacity 0.15s' }}
          >
            <img src={iconItem} width={25} height={25} alt="Items" style={{ display: 'block' }} />
          </button>
        </td>

        {/* project name */}
        <td className="td-main" style={{
          borderRight: '1px solid var(--border)',
          width: 200,
          padding: '8px 12px' }}>
          {name}
        </td>

        {/* project number */}
        <td style={{
          borderRight: '1px solid var(--border)',
          width:      75,
          color:      'var(--text2)',
          fontSize:   12,
          padding:    '8px 12px',
          textAlign: 'center', 
        }}>
          {number}
        </td>

        {/* tags / product */}
        <td style={{
          borderRight: '1px solid var(--border)',
          color: 'var(--text2)',
          fontSize: 13,
          whiteSpace: 'nowrap',
          padding: '8px 12px' }}>
          {tags}
        </td>

        {/* actions */}
        <td style={{
          width: 225,
          whiteSpace: 'nowrap',
          padding: '8px 10px' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'flex-end',
            gap: 4 }}>
            <button className="btn btn-ghost btn-sm" style={{ border: '1px solid #333' }}>✏️</button>
            <button className="btn btn-ghost btn-sm" style={{ border: '1px solid #333', color: 'var(--red)' }}><TrashIcon /></button>
            <button className="btn btn-ghost btn-sm" style={{ border: '1px solid #333' }}><PlusIcon /></button>
          </div>
        </td>

      </tr>

      {itemsOpen && (
        <tr><td colSpan={6} style={{ padding: 0 }}><ItemsDrawer /></td></tr>
      )}
      {tasksOpen && (
        <tr><td colSpan={6} style={{ padding: 0 }}><TasksDrawer /></td></tr>
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
                  <td colSpan={6} style={{
                    padding:       '6px 16px',
                    fontWeight:    700,
                    fontSize:      13,
                    color:         '#fff',
                    letterSpacing: '0.04em',
                  }}>
                    Adams Orthodontics
                  </td>
                </tr>

                <ProjectRow number="8083" tags="CO"          name="Test Project"    itemsOpen tasksOpen={false} />
                <ProjectRow number="8062" tags="ST | Website" name="Website Redesign" itemsOpen={false} tasksOpen />
                <ProjectRow number="8041" tags="DS | Logo"    name="Brand Identity"   itemsOpen={false} tasksOpen={false} />
              </tbody>

              <tbody>
                {/* project footer */}
                <tr>
                  <td colSpan={6} style={{ padding: '12px 20px' }}>
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
