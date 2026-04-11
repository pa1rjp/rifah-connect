import { useState } from 'react'
import { X, CheckCircle } from 'lucide-react'
import { useApprovePremium } from '@/hooks/useMembers'
import { useToast } from '@/components/shared/Toast'

export default function ApprovePremiumModal({ member, onClose }) {
  const [notes, setNotes] = useState('')
  const approve = useApprovePremium()
  const toast = useToast()

  if (!member) return null

  async function handleApprove() {
    try {
      await approve.mutateAsync({ docname: member.name })
      toast('Member approved as Premium ✓', 'success')
      onClose()
    } catch (err) {
      const msg = err?.response?.data?.exception || err?.response?.data?.message || err?.message || 'Approval failed'
      toast(msg, 'error')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-semibold text-gray-900">Approve Premium Payment</h2>
          <button onClick={onClose}><X size={18} className="text-gray-400 hover:text-gray-600" /></button>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-gray-500">Name</span><p className="font-medium">{member.full_name}</p></div>
            <div><span className="text-gray-500">Business</span><p className="font-medium">{member.business_name}</p></div>
            <div><span className="text-gray-500">Phone</span><p className="font-medium">{member.whatsapp_number}</p></div>
            <div><span className="text-gray-500">Transaction ID</span><p className="font-medium">{member.payment_transaction_id || '—'}</p></div>
          </div>
          {member.payment_screenshot && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Payment Screenshot</p>
              <img src={member.payment_screenshot} alt="Payment" className="rounded-lg border max-h-64 w-full object-contain bg-gray-50" />
            </div>
          )}
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Admin notes (optional)"
            rows={2}
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rifah-teal/30 resize-none"
          />
        </div>
        <div className="px-6 py-4 border-t flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">Cancel</button>
          <button
            onClick={handleApprove}
            disabled={approve.isPending}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-rifah-teal text-white font-medium hover:bg-rifah-dark disabled:opacity-50"
          >
            <CheckCircle size={14} />
            {approve.isPending ? 'Approving...' : 'Approve Premium'}
          </button>
        </div>
      </div>
    </div>
  )
}
