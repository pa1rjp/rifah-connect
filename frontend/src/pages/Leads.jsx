import { useState } from 'react'
import { useLeads, useMarkLeadPosted } from '@/hooks/useLeads'
import { useToast } from '@/components/shared/Toast'
import DataTable from '@/components/shared/DataTable'
import FilterBar from '@/components/shared/FilterBar'
import StatusBadge from '@/components/shared/StatusBadge'
import TierBadge from '@/components/shared/TierBadge'
import LeadActionModal from '@/components/leads/LeadActionModal'
import { fmtDate } from '@/lib/utils'
import { URGENCY_COLORS } from '@/lib/utils'

const STATUSES = ['Pending Review','Approved - Ready for Posting','Posted to Groups',
                  'Has Interested Vendors','Connected','Awaiting User Response','Rejected','Closed']
const TYPES    = ['BUY','SELL','SERVICE NEED','SERVICE OFFER']
const URGENCIES = ['URGENT','THIS WEEK','THIS MONTH','FLEXIBLE']

export default function Leads() {
  const [search,   setSearch]   = useState('')
  const [tier,     setTier]     = useState('')
  const [status,   setStatus]   = useState('')
  const [leadType, setLeadType] = useState('')
  const [urgency,  setUrgency]  = useState('')
  const [activeLead, setActiveLead] = useState(null)

  const { data = [], isLoading } = useLeads({ search, tier, status, leadType, urgency })
  const markPosted = useMarkLeadPosted()
  const toast      = useToast()

  const columns = [
    { key: 'lead_id',     label: 'Lead ID',  render: v => <span className="font-mono text-xs">{v}</span> },
    { key: 'member_name', label: 'Member' },
    { key: 'member_phone',label: 'Phone' },
    { key: 'tier',        label: 'Tier',     render: v => <TierBadge tier={v} /> },
    { key: 'lead_type',   label: 'Type',     render: v => <span className="text-xs font-medium">{v}</span> },
    { key: 'urgency',     label: 'Urgency',
      render: v => v ? <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${URGENCY_COLORS[v] || ''}`}>{v}</span> : '—' },
    { key: 'status',      label: 'Status',   render: v => <StatusBadge status={v} /> },
    { key: 'created_at',  label: 'Created',  render: v => fmtDate(v) },
    { key: '_actions', label: '', sortable: false,
      render: (_, r) => (
        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
          {r.status === 'Pending Review' && (
            <button onClick={() => setActiveLead(r)}
              className="text-xs px-2 py-1 rounded bg-rifah-teal text-white hover:bg-rifah-dark">Review</button>
          )}
          {r.status === 'Approved - Ready for Posting' && (
            <button onClick={() => markPosted.mutate({ docname: r.name }, {
              onSuccess: () => toast('Lead marked as posted ✓', 'success'),
              onError: err => toast(err?.response?.data?.exception || err?.message || 'Failed', 'error')
            })}
              className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700">Mark Posted</button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <FilterBar
        search={search} onSearch={setSearch}
        filters={[
          { label: 'Tier',     value: tier,     onChange: setTier,     options: ['FREE','PREMIUM'] },
          { label: 'Type',     value: leadType, onChange: setLeadType, options: TYPES },
          { label: 'Urgency',  value: urgency,  onChange: setUrgency,  options: URGENCIES },
          { label: 'Status',   value: status,   onChange: setStatus,   options: STATUSES },
        ]}
      />
      <div className="text-xs text-gray-400">{data.length} lead{data.length !== 1 ? 's' : ''}</div>
      {isLoading
        ? <p className="text-sm text-gray-400">Loading...</p>
        : <DataTable columns={columns} data={data} onRowClick={r => r.status === 'Pending Review' && setActiveLead(r)}
            emptyMsg="No leads match the current filters." />}

      <LeadActionModal lead={activeLead} onClose={() => setActiveLead(null)} />
    </div>
  )
}
