import { useState } from 'react'
import { CreditCard, FileText, CheckCircle, XCircle } from 'lucide-react'
import { useMembers } from '@/hooks/useMembers'
import { useLeads } from '@/hooks/useLeads'
import ApprovePremiumModal from '@/components/members/ApprovePremiumModal'
import LeadActionModal from '@/components/leads/LeadActionModal'
import TierBadge from '@/components/shared/TierBadge'
import { fmtRelative } from '@/lib/utils'

export default function PendingApprovals() {
  const { data: payments = [], isLoading: l1 } = useMembers({ status: 'Payment Uploaded' })
  const { data: leads    = [], isLoading: l2 } = useLeads({ tier: 'FREE', status: 'Pending Review' })
  const [approveMember, setApproveMember] = useState(null)
  const [activeLead,    setActiveLead]    = useState(null)

  const total = payments.length + leads.length

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="bg-orange-100 text-orange-700 text-xs font-bold px-2.5 py-1 rounded-full">
          {total} pending
        </div>
        <span className="text-sm text-gray-400">Auto-refreshes every 60 seconds</span>
      </div>

      {/* Premium Payment Verifications */}
      <section>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
          <CreditCard size={16} className="text-yellow-600" />
          Premium Payment Verifications ({payments.length})
        </h2>
        {l1 ? <p className="text-sm text-gray-400">Loading...</p> :
         payments.length === 0 ? <EmptyCard msg="No pending payment verifications" /> :
         <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
           {payments.map(m => (
             <div key={m.name} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
               <div className="flex items-start justify-between">
                 <div>
                   <p className="font-medium text-sm">{m.full_name}</p>
                   <p className="text-xs text-gray-500">{m.business_name}</p>
                   <p className="text-xs text-gray-400 mt-0.5">{m.whatsapp_number}</p>
                 </div>
                 <TierBadge tier="PREMIUM" />
               </div>
               {m.payment_transaction_id && (
                 <p className="text-xs bg-gray-50 rounded px-2 py-1 font-mono">UTR: {m.payment_transaction_id}</p>
               )}
               {m.payment_screenshot && (
                 <img src={m.payment_screenshot} alt="Payment" className="rounded-lg w-full h-28 object-cover border" />
               )}
               <p className="text-xs text-gray-400">{fmtRelative(m.registration_date)}</p>
               <button onClick={() => setApproveMember(m)}
                 className="w-full flex items-center justify-center gap-1.5 py-2 text-sm rounded-lg bg-rifah-teal text-white hover:bg-rifah-dark font-medium">
                 <CheckCircle size={14} /> Review & Approve
               </button>
             </div>
           ))}
         </div>}
      </section>

      {/* Free Lead Approvals */}
      <section>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
          <FileText size={16} className="text-orange-500" />
          Free Lead Approvals ({leads.length})
        </h2>
        {l2 ? <p className="text-sm text-gray-400">Loading...</p> :
         leads.length === 0 ? <EmptyCard msg="No leads pending review" /> :
         <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
           {leads.map(l => (
             <div key={l.name} className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
               <div className="flex items-start justify-between">
                 <span className="text-xs font-mono text-gray-400">{l.lead_id}</span>
                 <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                   l.urgency === 'URGENT' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                   {l.urgency}
                 </span>
               </div>
               <p className="font-medium text-sm">{l.title}</p>
               <p className="text-xs text-gray-500 line-clamp-2">{l.description}</p>
               <div className="flex items-center gap-2 text-xs text-gray-400">
                 <span>{l.member_name}</span>
                 <span>·</span>
                 <span>{l.lead_type}</span>
                 <span>·</span>
                 <span>{fmtRelative(l.created_at)}</span>
               </div>
               <div className="flex gap-2 pt-1">
                 <button onClick={() => setActiveLead(l)}
                   className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs rounded-lg bg-rifah-teal text-white hover:bg-rifah-dark">
                   <CheckCircle size={12} /> Review
                 </button>
               </div>
             </div>
           ))}
         </div>}
      </section>

      <ApprovePremiumModal member={approveMember} onClose={() => setApproveMember(null)} />
      <LeadActionModal     lead={activeLead}      onClose={() => setActiveLead(null)} />
    </div>
  )
}

function EmptyCard({ msg }) {
  return (
    <div className="bg-white rounded-xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-400">
      <CheckCircle size={24} className="mx-auto mb-2 text-green-400" />
      {msg}
    </div>
  )
}
