import { useState } from 'react'
import { X } from 'lucide-react'
import { useSessions, useSession } from '@/hooks/useSessions'
import DataTable from '@/components/shared/DataTable'
import FilterBar from '@/components/shared/FilterBar'
import StatusBadge from '@/components/shared/StatusBadge'
import ChatBubbles from '@/components/sessions/ChatBubbles'
import { fmtRelative, safeJson } from '@/lib/utils'

const STEPS = ['NEW','MENU','Q1','Q2','Q3','Q4','Q5','Q6','DOC_UPLOAD','PRODUCT_UPLOAD',
               'TIER_SELECT','PROCESSING','COMPLETED','PAYMENT_WAIT','PAYMENT_PENDING',
               'EXISTING_CHOICE','LEAD_TYPE','SEARCH_METHOD','SUPPORT_CATEGORY']

export default function ChatSessions() {
  const [search, setSearch]   = useState('')
  const [status, setStatus]   = useState('')
  const [step,   setStep]     = useState('')
  const [active, setActive]   = useState(null)

  const { data = [], isLoading } = useSessions({ search, status, step })

  const columns = [
    { key: 'phone_number', label: 'Phone' },
    { key: '_name',  label: 'Name',     sortable: false,
      render: (_, r) => safeJson(r.session_data, {}).full_name || '—' },
    { key: '_biz',   label: 'Business', sortable: false,
      render: (_, r) => safeJson(r.session_data, {}).business_name || '—' },
    { key: 'current_step', label: 'Current Step',
      render: v => <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{v}</span> },
    { key: 'status', label: 'Status', render: v => <StatusBadge status={v} /> },
    { key: 'last_activity', label: 'Last Active', render: v => fmtRelative(v) },
  ]

  return (
    <div className="flex gap-4 h-full">
      <div className="flex-1 space-y-4 min-w-0">
        <FilterBar
          search={search} onSearch={setSearch}
          filters={[
            { label: 'Status', value: status, onChange: setStatus, options: ['Active','Completed','Expired'] },
            { label: 'Step',   value: step,   onChange: setStep,   options: STEPS },
          ]}
        />
        {isLoading
          ? <p className="text-sm text-gray-400">Loading...</p>
          : <DataTable columns={columns} data={data} onRowClick={setActive}
              emptyMsg="No sessions match the current filters." />}
      </div>

      {/* Slide-over chat panel */}
      {active && (
        <div className="w-96 shrink-0 bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-rifah-dark text-white">
            <div>
              <p className="font-medium text-sm">{active.phone_number}</p>
              <p className="text-xs text-white/60">{safeJson(active.session_data, {}).full_name || 'Unknown'} · {active.current_step}</p>
            </div>
            <button onClick={() => setActive(null)}><X size={16} /></button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <SessionChat docname={active.name} />
          </div>
        </div>
      )}
    </div>
  )
}

function SessionChat({ docname }) {
  const { data, isLoading } = useSession(docname)
  if (isLoading) return <p className="text-sm text-gray-400 p-4">Loading...</p>
  return <ChatBubbles session={data} />
}
