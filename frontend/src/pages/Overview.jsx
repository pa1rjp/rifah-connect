import { useQuery } from '@tanstack/react-query'
import { Users, MessageSquare, Bell, TrendingUp, Star } from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { fetchKPIs, fetchMemberGrowth, fetchLeadVolume } from '@/lib/erpnext'
import { format, parseISO, subDays } from 'date-fns'

function KpiCard({ label, value, icon: Icon, color }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
      <div className={`p-3 rounded-xl ${color}`}><Icon size={20} className="text-white" /></div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value ?? '—'}</p>
        <p className="text-sm text-gray-500 mt-0.5">{label}</p>
      </div>
    </div>
  )
}

export default function Overview() {
  const { data: kpis } = useQuery({ queryKey: ['kpis'], queryFn: fetchKPIs, refetchInterval: 60_000 })
  const { data: growthRaw = [] } = useQuery({ queryKey: ['memberGrowth'], queryFn: fetchMemberGrowth })
  const { data: leadsRaw = [] }  = useQuery({ queryKey: ['leadVolume'],   queryFn: fetchLeadVolume })

  // Bucket member registrations by day (last 30 days)
  const growthData = (() => {
    const today = new Date()
    const days = Array.from({ length: 30 }, (_, i) => {
      const d = subDays(today, 29 - i)
      return { date: format(d, 'MMM d'), count: 0 }
    })
    growthRaw.forEach(m => {
      if (!m.registration_date) return
      try {
        const label = format(parseISO(m.registration_date), 'MMM d')
        const idx = days.findIndex(d => d.date === label)
        if (idx !== -1) days[idx].count++
      } catch {}
    })
    return days
  })()

  // Count leads by type
  const leadTypes = ['BUY','SELL','SERVICE NEED','SERVICE OFFER']
  const leadsData = leadTypes.map(t => ({ type: t, count: leadsRaw.filter(l => l.lead_type === t).length }))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard label="Active Members"    value={kpis?.activeMembers}   icon={Users}         color="bg-rifah-teal" />
        <KpiCard label="Premium Members"   value={kpis?.premiumMembers}  icon={Star}          color="bg-yellow-500" />
        <KpiCard label="Active Sessions"   value={kpis?.activeSessions}  icon={MessageSquare} color="bg-blue-500" />
        <KpiCard label="Pending Approvals" value={kpis?.pendingApprovals}icon={Bell}          color="bg-orange-500" />
        <KpiCard label="Leads Today"       value={kpis?.leadsToday}      icon={TrendingUp}    color="bg-green-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Member Registrations (Last 30 Days)</h2>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={growthData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Area type="monotone" dataKey="count" stroke="#128C7E" fill="#DCF8C6" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Lead Volume by Type</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={leadsData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="type" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#128C7E" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
