import { useState } from 'react'
import { X } from 'lucide-react'
import { useApproveLead, useRejectLead, useRequestInfo } from '@/hooks/useLeads'
import { useToast } from '@/components/shared/Toast'
import StatusBadge from '@/components/shared/StatusBadge'
import TierBadge from '@/components/shared/TierBadge'

export default function LeadActionModal({ lead, onClose }) {
  const [note, setNote] = useState('')
  const approve = useApproveLead()
  const reject  = useRejectLead()
  const request = useRequestInfo()
  const toast   = useToast()

  if (!lead) return null

  const isPending = approve.isPending || reject.isPending || request.isPending

  async function handle(action) {
    try {
      if (action === 'approve') await approve.mutateAsync({ docname: lead.name, note })
      if (action === 'reject')  await reject.mutateAsync({ docname: lead.name, reason: note })
      if (action === 'request') await request.mutateAsync({ docname: lead.name, note })
      const labels = { approve: 'Lead approved ✓', reject: 'Lead rejected', request: 'Info requested from member' }
      toast(labels[action], 'success')
      onClose()
    } catch (err) {
      const msg = err?.response?.data?.exception || err?.response?.data?.message || err?.message || 'Action failed'
      toast(msg, 'error')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="font-semibold text-gray-900">{lead.lead_id}</h2>
            <div className="flex items-center gap-2 mt-1">
              <TierBadge tier={lead.tier} />
              <StatusBadge status={lead.status} />
              <span className="text-xs text-gray-400">{lead.lead_type}</span>
            </div>
          </div>
          <button onClick={onClose}><X size={18} className="text-gray-400 hover:text-gray-600" /></button>
        </div>
        <div className="px-6 py-4 space-y-3 text-sm">
          <div><span className="text-gray-500">Member</span> <span className="font-medium ml-2">{lead.member_name} · {lead.member_phone}</span></div>
          <div><span className="text-gray-500">Title</span> <span className="font-medium ml-2">{lead.title}</span></div>
          <div><span className="text-gray-500">Description</span><p className="mt-1 text-gray-700 bg-gray-50 rounded-lg p-3">{lead.description}</p></div>
          <div className="flex gap-4">
            {lead.location && <span><span className="text-gray-500">Location</span> <span className="ml-1">{lead.location}</span></span>}
            {lead.urgency  && <span><span className="text-gray-500">Urgency</span> <span className="ml-1">{lead.urgency}</span></span>}
            {lead.budget   && <span><span className="text-gray-500">Budget</span> <span className="ml-1">{lead.budget}</span></span>}
          </div>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Admin note (shown to user on reject/request)"
            rows={2}
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rifah-teal/30 resize-none"
          />
        </div>
        <div className="px-6 py-4 border-t flex gap-2 justify-end flex-wrap">
          <button onClick={onClose} className="px-3 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">Cancel</button>
          <button onClick={() => handle('request')} disabled={isPending} className="px-3 py-2 text-sm rounded-lg bg-yellow-500 text-white hover:bg-yellow-600 disabled:opacity-50">Request Info</button>
          <button onClick={() => handle('reject')}  disabled={isPending} className="px-3 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">Reject</button>
          <button onClick={() => handle('approve')} disabled={isPending} className="px-3 py-2 text-sm rounded-lg bg-rifah-teal text-white font-medium hover:bg-rifah-dark disabled:opacity-50">Approve</button>
        </div>
      </div>
    </div>
  )
}
