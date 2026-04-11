import { useState } from 'react'
import { X, CheckCircle, XCircle } from 'lucide-react'
import { useApproveFreeMember, useRejectMember } from '@/hooks/useMembers'
import { useToast } from '@/components/shared/Toast'

export default function ReviewMemberModal({ member, onClose }) {
  const [note,   setNote]   = useState('')
  const [reason, setReason] = useState('')
  const [view,   setView]   = useState('main') // 'main' | 'reject'

  const approve = useApproveFreeMember()
  const reject  = useRejectMember()
  const toast   = useToast()

  if (!member) return null

  async function handleApprove() {
    try {
      await approve.mutateAsync({ docname: member.name, note })
      toast('Member approved as Active Free ✓', 'success')
      onClose()
    } catch (err) {
      toast(err?.response?.data?.exception || err?.message || 'Approval failed', 'error')
    }
  }

  async function handleReject() {
    try {
      await reject.mutateAsync({ docname: member.name, reason })
      toast('Member rejected', 'success')
      onClose()
    } catch (err) {
      toast(err?.response?.data?.exception || err?.message || 'Rejection failed', 'error')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-semibold text-gray-900">Review New Member</h2>
          <button onClick={onClose}><X size={18} className="text-gray-400 hover:text-gray-600" /></button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Member details */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-gray-500 text-xs">Name</span><p className="font-medium">{member.full_name || '—'}</p></div>
            <div><span className="text-gray-500 text-xs">Business</span><p className="font-medium">{member.business_name || '—'}</p></div>
            <div><span className="text-gray-500 text-xs">Phone</span><p className="font-medium">{member.whatsapp_number}</p></div>
            <div><span className="text-gray-500 text-xs">Industry</span><p className="font-medium">{member.industry || '—'}</p></div>
            <div><span className="text-gray-500 text-xs">City / State</span><p className="font-medium">{member.city_state || '—'}</p></div>
            <div><span className="text-gray-500 text-xs">Email</span><p className="font-medium">{member.email || '—'}</p></div>
            {member.rifah_id && (
              <div><span className="text-gray-500 text-xs">RIFAH ID</span><p className="font-mono text-xs font-medium">{member.rifah_id}</p></div>
            )}
            {member.registration_date && (
              <div><span className="text-gray-500 text-xs">Registered</span><p className="font-medium">{member.registration_date?.substring(0,10)}</p></div>
            )}
          </div>

          {view === 'main' ? (
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Admin notes (optional)"
              rows={2}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rifah-teal/30 resize-none"
            />
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-red-600 font-medium">Rejection reason</p>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Explain why this registration is rejected (shown in admin notes)"
                rows={3}
                autoFocus
                className="w-full text-sm border border-red-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-200 resize-none"
              />
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t flex gap-3 justify-between">
          {view === 'main' ? (
            <>
              <button
                onClick={() => setView('reject')}
                className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
              >
                <XCircle size={14} /> Reject
              </button>
              <div className="flex gap-2">
                <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">Cancel</button>
                <button
                  onClick={handleApprove}
                  disabled={approve.isPending}
                  className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-rifah-teal text-white font-medium hover:bg-rifah-dark disabled:opacity-50"
                >
                  <CheckCircle size={14} />
                  {approve.isPending ? 'Approving...' : 'Approve — Active Free'}
                </button>
              </div>
            </>
          ) : (
            <>
              <button onClick={() => setView('main')} className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">Back</button>
              <button
                onClick={handleReject}
                disabled={reject.isPending || !reason.trim()}
                className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50"
              >
                <XCircle size={14} />
                {reject.isPending ? 'Rejecting...' : 'Confirm Reject'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
