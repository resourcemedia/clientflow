import { useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

export default function TasksPrint() {
  const { state } = useLocation()
  const tasks    = state?.tasks    || []
  const profiles = state?.profiles || []
  const docRef   = useRef(null)
  const [copyLabel, setCopyLabel] = useState('Copy for Email')

  async function handleCopy() {
    try {
      const html = docRef.current.innerHTML
      const text = docRef.current.innerText
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html':  new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' }),
        }),
      ])
      setCopyLabel('Copied!')
      setTimeout(() => setCopyLabel('Copy for Email'), 2000)
    } catch {
      setCopyLabel('Copy failed')
    }
  }

  function initials(str) {
    if (!str) return '?'
    return str.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
  }

  function assigneeProfile(task) {
    if (!task.assigned_to) return null
    return profiles.find(p => p.id === task.assigned_to) || null
  }

  if (!tasks.length) {
    return (
      <div style={{ padding: 40, fontFamily: 'system-ui, sans-serif', color: '#666' }}>
        No tasks to display.
      </div>
    )
  }


  // Group tasks by project, preserving incoming order
  const projectGroups = []
  const seenProjectIds = new Map()
  for (const task of tasks) {
    const pid = task.project?.id || task.project_id
    if (!seenProjectIds.has(pid)) {
      seenProjectIds.set(pid, projectGroups.length)
      projectGroups.push({ project: task.project, tasks: [] })
    }
    projectGroups[seenProjectIds.get(pid)].tasks.push(task)
  }

  // Group projects by client, preserving incoming order
  const clientGroups = []
  const seenClients = new Map()
  for (const group of projectGroups) {
    const company = group.project?.client?.company || ''
    if (!seenClients.has(company)) {
      seenClients.set(company, clientGroups.length)
      clientGroups.push({ company, projectGroups: [] })
    }
    clientGroups[seenClients.get(company)].projectGroups.push(group)
  }

  const multiClient = clientGroups.length > 1
  const docTitle    = tasks[0]?.project?.client?.company || ''

  const cellBase = {
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: 14,
    color: '#222',
    padding: '0',
    verticalAlign: 'top',
  }

  return (
    <div style={{ padding: 40, fontFamily: 'system-ui, sans-serif', background: 'white', minHeight: '100vh' }}>
      <style>{`
        @page { size: landscape; margin: 0.5in; }
        @media print {
          .no-print, .sidebar { display: none !important; }
          .app-layout { display: block !important; }
          .main-content {
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            background: white !important;
          }
          body { background: white !important; margin: 0 !important; }
        }
      `}</style>

      {/* Action bar — outside docRef, hidden on print */}
      <div className="no-print" style={{ marginBottom: 28 }}>
        <button
          onClick={() => window.print()}
          style={{ padding: '6px 18px', borderRadius: 6, border: '1px solid #ccc', background: 'white', fontSize: 13, cursor: 'pointer', color: '#333', marginRight: 8 }}
        >
          Print / PDF
        </button>
        <button
          onClick={handleCopy}
          style={{ padding: '6px 18px', borderRadius: 6, border: '1px solid #ccc', background: 'white', fontSize: 13, cursor: 'pointer', color: '#333' }}
        >
          {copyLabel}
        </button>
      </div>

      <div ref={docRef} style={{ maxWidth: 700, margin: '0 auto' }}>

        {/* Header */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 28 }}>
          <tbody>
            <tr>
              <td style={{ ...cellBase, fontSize: 24, fontWeight: 700 }}>{docTitle}</td>
              <td style={{ ...cellBase, fontSize: 18, fontWeight: 700, textAlign: 'right' }}>ToDo List</td>
            </tr>
          </tbody>
        </table>

        {/* Client groups */}
        {clientGroups.map(({ company, projectGroups: pGroups }) => (
          <div key={company}>
            {multiClient && (
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
                <tbody>
                  <tr>
                    <td style={{ ...cellBase, fontSize: 16, fontWeight: 700, paddingBottom: 6 }}>{company}</td>
                  </tr>
                </tbody>
              </table>
            )}

            {pGroups.map(({ project, tasks: pTasks }) => (
              <table key={project?.id} style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
                <tbody>
                  {/* Project header row */}
                  <tr>
                    <td colSpan={2} style={{ ...cellBase, fontWeight: 700, paddingBottom: 4, width: '85%' }}>{project?.name || '—'}</td>
                    <td style={{ ...cellBase, fontWeight: 700, textAlign: 'right', paddingBottom: 4, width: '15%' }}>Who</td>
                  </tr>
                  {/* Task rows */}
                  {pTasks.map(task => {
                    const bulletLines = (task.status_note || '').split('\n').map(l => l.trim()).filter(Boolean)
                    return (
                      <tr key={task.id}>
                        <td style={{ ...cellBase, borderBottom: '1px solid #ccc', paddingTop: 5, paddingBottom: 5, width: '40%' }}>
                          {task.note || ''}
                        </td>
                        <td style={{ ...cellBase, borderBottom: '1px solid #ccc', paddingTop: 5, paddingBottom: 5, width: '45%' }}>
                          {bulletLines.map((line, i) => (
                            <div key={i} style={{ fontSize: 12, color: '#555', lineHeight: 1.4 }}>{line}</div>
                          ))}
                        </td>
                        <td style={{ ...cellBase, borderBottom: '1px solid #ccc', paddingTop: 5, paddingBottom: 5, textAlign: 'right', width: '15%' }}>
                          {(() => {
                            const p = assigneeProfile(task)
                            if (!p) return '—'
                            return (
                              <div style={{
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                width: 28, height: 28, borderRadius: '50%',
                                border: '1px solid #222',
                                fontSize: 11, fontWeight: 600, color: '#222',
                                userSelect: 'none',
                              }}>
                                {initials(p.name)}
                              </div>
                            )
                          })()}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ))}
          </div>
        ))}

      </div>
    </div>
  )
}
