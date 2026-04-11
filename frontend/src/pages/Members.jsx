import { useState } from 'react'
import { useMembers, useSuspendMember } from '@/hooks/useMembers'
import { useToast } from '@/components/shared/Toast'
import DataTable from '@/components/shared/DataTable'
import FilterBar from '@/components/shared/FilterBar'
import StatusBadge from '@/components/shared/StatusBadge'
import TierBadge from '@/components/shared/TierBadge'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import ApprovePremiumModal from '@/components/members/ApprovePremiumModal'
import ReviewMemberModal from '@/components/members/ReviewMemberModal'
import AssignGroupsModal from '@/components/members/AssignGroupsModal'
import { fmtDate } from '@/lib/utils'

const STATUSES = ['Pending Admin Review','Active Free','Pending Payment','Payment Uploaded','Active Premium','Suspended']

export default function Members() {
  const [search, setSearch] = useState('')
  const [tier,   setTier]   = useState('')
  const [status, setStatus] = useState('')
  const [reviewMember,   setReviewMember]   = useState(null)
  const [approveMember,  setApproveMember]  = useState(null)
  const [assignMember,   setAssignMember]   = useState(null)
  const [suspendTarget,  setSuspendTarget]  = useState(null)

  const { data = [], isLoading } = useMembers({ search, tier, status })
  const suspend = useSuspendMember()
  const toast   = useToast()

  const columns = [
    { key: 'rifah_id',       label: 'RIFAH ID',     render: v => <span className="font-mono text-xs">{v}</span> },
    { key: 'full_name',      label: 'Name' },
    { key: 'business_name',  label: 'Business' },
    { key: 'whatsapp_number',label: 'Phone' },
    { key: 'city_state',     label: 'City' },
    { key: 'membership_tier',label: 'Tier',   render: v => <TierBadge tier={v} /> },
    { key: 'status',         label: 'Status', render: v => <StatusBadge status={v} /> },
    { key: 'registration_date', label: 'Registered', render: v => fmtDate(v) },
    { key: '_actions', label: '', sortable: false,
      render: (_, r) => (
        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
          {r.status === 'Pending Admin Review' && (
            <button onClick={() => setReviewMember(r)}
              className="text-xs px-2 py-1 rounded bg-amber-500 text-white hover:bg-amber-600">Review</button>
          )}
          {r.status === 'Payment Uploaded' && (
            <button onClick={() => setApproveMember(r)}
              className="text-xs px-2 py-1 rounded bg-rifah-teal text-white hover:bg-rifah-dark">Approve</button>
          )}
          <button onClick={() => setAssignMember(r)}
            className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50">Groups</button>
          {r.status !== 'Suspended' && (
            <button onClick={() => setSuspendTarget(r)}
              className="text-xs px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50">Suspend</button>
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
          { label: 'Tier',   value: tier,   onChange: setTier,   options: ['FREE','PREMIUM'] },
          { label: 'Status', value: status, onChange: setStatus, options: STATUSES },
        ]}
      />
      <div className="text-xs text-gray-400">{data.length} member{data.length !== 1 ? 's' : ''}</div>
      {isLoading
        ? <p className="text-sm text-gray-400">Loading...</p>
        : <DataTable columns={columns} data={data} emptyMsg="No members match the current filters." />}

      <ReviewMemberModal   member={reviewMember}  onClose={() => setReviewMember(null)} />
      <ApprovePremiumModal member={approveMember} onClose={() => setApproveMember(null)} />
      <AssignGroupsModal   member={assignMember}  onClose={() => setAssignMember(null)} />
      <ConfirmDialog
        open={!!suspendTarget}
        title="Suspend Member"
        message={`Suspend ${suspendTarget?.full_name} (${suspendTarget?.rifah_id})? They won't be able to use the bot.`}
        confirmLabel="Suspend"
        danger
        onConfirm={async () => {
          try {
            await suspend.mutateAsync({ docname: suspendTarget.name })
            toast('Member suspended', 'success')
          } catch (err) {
            toast(err?.response?.data?.exception || err?.message || 'Suspend failed', 'error')
          }
          setSuspendTarget(null)
        }}
        onCancel={() => setSuspendTarget(null)}
      />
    </div>
  )
}
