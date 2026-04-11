import { useState } from 'react'
import { X, MessageSquare, Bug } from 'lucide-react'
import { useSessions, useSession } from '@/hooks/useSessions'
import DataTable from '@/components/shared/DataTable'
import FilterBar from '@/components/shared/FilterBar'
import StatusBadge from '@/components/shared/StatusBadge'
import ChatBubbles from '@/components/sessions/ChatBubbles'
import ExecLog from '@/components/sessions/ExecLog'
import { fmtRelative, safeJson } from '@/lib/utils'

const STEPS = ['NEW','MENU','Q1','Q2','Q3','Q4','Q5','Q6','DOC_UPLOAD','PRODUCT_UPLOAD',
               'TIER_SELECT','PROCESSING','COMPLETED','PAYMENT_WAIT','PAYMENT_PENDING',
               'EXISTING_CHOICE','LEAD_TYPE','SEARCH_METHOD','SUPPORT_CATEGORY']

export default function ChatSessions() {
  const [search, setSearch]   = useState('')
  const [status, setStatus]   = useState('')
  const [step,   setStep]     = useState('')
  const [active, setActive]   = useState(null)
  const [tab,    setTab]      = useState('chat')   // 'chat' | 'log'

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

  function handleRowClick(row) {
    setActive(row)
    setTab('chat')
  }

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
          : <DataTable columns={columns} data={data} onRowClick={handleRowClick}
              emptyMsg="No sessions match the current filters." />}
      </div>

      {/* Slide-over panel */}
      {active && (
        <div className="w-96 shrink-0 bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-rifah-dark text-white">
            <div>
              <p className="font-medium text-sm">{active.phone_number}</p>
              <p className="text-xs text-white/60">{safeJson(active.session_data, {}).full_name || 'Unknown'} · {active.current_step}</p>
            </div>
            <button onClick={() => setActive(null)}><X size={16} /></button>
          </div>

          {/* Tabs */}
          <div className="flex border-b text-sm">
            <button
              onClick={() => setTab('chat')}
              className={`flex items-center gap-1.5 px-4 py-2 border-b-2 transition-colors ${tab === 'chat' ? 'border-rifah-dark text-rifah-dark font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              <MessageSquare size={13} /> Chat
            </button>
            <button
              onClick={() => setTab('log')}
              className={`flex items-center gap-1.5 px-4 py-2 border-b-2 transition-colors ${tab === 'log' ? 'border-rifah-dark text-rifah-dark font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              <Bug size={13} /> Debug Log
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            <SessionPanel docname={active.name} tab={tab} />
          </div>
        </div>
      )}
    </div>
  )
}

function SessionPanel({ docname, tab }) {
  const { data, isLoading } = useSession(docname)
  if (isLoading) return <p className="text-sm text-gray-400 p-4">Loading...</p>
  return tab === 'chat' ? <ChatBubbles session={data} /> : <ExecLog session={data} />
}
