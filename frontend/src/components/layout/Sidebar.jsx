import { NavLink } from 'react-router-dom'
import { LayoutDashboard, MessageSquare, Users, FileText, Bell, MessageCircle } from 'lucide-react'
import { useLeads } from '@/hooks/useLeads'
import { useMembers } from '@/hooks/useMembers'

const nav = [
  { to: '/',          label: 'Overview',          icon: LayoutDashboard },
  { to: '/sessions',  label: 'Chat Sessions',      icon: MessageSquare },
  { to: '/members',   label: 'Members',            icon: Users },
  { to: '/leads',     label: 'Leads',              icon: FileText },
  { to: '/approvals', label: 'Pending Approvals',  icon: Bell, badge: true },
  { to: '/groups',    label: 'WhatsApp Groups',     icon: MessageCircle },
]

function usePendingCount() {
  const { data: payments = [] } = useMembers({ status: 'Payment Uploaded' })
  const { data: leads = [] }    = useLeads({ tier: 'FREE', status: 'Pending Review' })
  return payments.length + leads.length
}

export default function Sidebar() {
  const pending = usePendingCount()

  return (
    <aside className="w-60 min-h-screen bg-rifah-dark text-white flex flex-col shrink-0">
      <div className="px-5 py-5 border-b border-white/10">
        <div className="text-xl font-bold tracking-tight">RIFAH Admin</div>
        <div className="text-xs text-white/50 mt-0.5">Chamber of Commerce</div>
      </div>
      <nav className="flex-1 py-4 space-y-0.5 px-2">
        {nav.map(({ to, label, icon: Icon, badge }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive ? 'bg-white/20 text-white font-medium' : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            <Icon size={16} />
            <span className="flex-1">{label}</span>
            {badge && pending > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-5 text-center">
                {pending}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="px-4 py-3 border-t border-white/10 text-xs text-white/40">
        v1.0 · RIFAH Connect
      </div>
    </aside>
  )
}
