// Placeholder pages — will be built as full modules in future sessions
export function CampaignsPage() {
  return <ComingSoon title="Campaigns" icon="📣" next="campaign builder with benefit / proof / CTA and channel selection" />
}
export function CalendarPage() {
  return <ComingSoon title="Content calendar" icon="📅" next="monthly content calendar with color-coded channel events" />
}
export function ProofsPage() {
  return <ComingSoon title="Proofs" icon="📄" next="proof review board with Approve / Revise / No Go workflow" />
}
export function TimeboardPage() {
  return <ComingSoon title="Time board" icon="⏱" next="weekly time tracking grid by team member and project" />
}
export function BillingPage() {
  return <ComingSoon title="Billing" icon="💰" next="invoice management and revenue by client summary" />
}

function ComingSoon({ title, icon, next }) {
  return (
    <div className="fade-in">
      <div className="topbar">
        <div className="topbar-title">{title}</div>
      </div>
      <div className="page-content">
        <div className="card">
          <div style={{ padding: '64px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>{icon}</div>
            <div style={{ fontSize: 18, fontFamily: 'Fraunces, serif', fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
              {title} — coming next
            </div>
            <div style={{ fontSize: 14, color: 'var(--text2)', maxWidth: 400, margin: '0 auto', lineHeight: 1.6 }}>
              Next build session: {next}.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
