import { Bug } from 'lucide-react'
import { safeJson, fmtDate } from '@/lib/utils'

function stepColor(step) {
  if (!step) return 'bg-gray-100 text-gray-600'
  if (step === 'NEW')       return 'bg-blue-50  text-blue-700'
  if (step === 'MENU')      return 'bg-indigo-50 text-indigo-700'
  if (step.startsWith('Q')) return 'bg-purple-50 text-purple-700'
  if (step.includes('PAYMENT') || step.includes('PROCESSING')) return 'bg-amber-50 text-amber-700'
  if (step === 'COMPLETED') return 'bg-green-50 text-green-700'
  if (step.includes('LEAD') || step.includes('SEARCH') || step.includes('LOCATION') || step.includes('CATEGORY') || step.includes('URGENCY')) return 'bg-teal-50 text-teal-700'
  if (step.includes('SUPPORT')) return 'bg-rose-50 text-rose-700'
  return 'bg-gray-100 text-gray-600'
}

function actionBadge(action) {
  if (!action) return null
  return (
    <span className="text-[10px] font-mono bg-orange-50 text-orange-700 border border-orange-200 rounded px-1.5 py-0.5">
      {action}
    </span>
  )
}

export default function ExecLog({ session }) {
  if (!session) return null

  const sessionData = safeJson(session.session_data, {})
  const log = sessionData._execLog || []

  if (!log.length) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-gray-400 text-sm p-4 text-center">
        <Bug size={24} className="mb-2 opacity-30" />
        <p>No execution log yet.</p>
        <p className="text-xs mt-1">Log entries appear after the next message is processed.</p>
      </div>
    )
  }

  // Show newest first
  const entries = [...log].reverse()

  return (
    <div className="p-3 space-y-2 font-mono text-xs">
      {entries.map((e, i) => (
        <div key={i} className="border border-gray-100 rounded-lg p-2.5 bg-white shadow-sm space-y-1.5">

          {/* Timestamp + step transition */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-gray-400 text-[10px]">{e.ts ? fmtDate(e.ts) : '—'}</span>
            <div className="flex items-center gap-1">
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${stepColor(e.step)}`}>{e.step || '—'}</span>
              <span className="text-gray-300">→</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${stepColor(e.next)}`}>{e.next || '—'}</span>
            </div>
          </div>

          {/* Inbound message */}
          {e.msg && (
            <div className="flex gap-1.5 items-start">
              <span className="text-[10px] text-gray-400 w-12 shrink-0 pt-0.5">IN</span>
              <span className={`text-gray-800 break-all ${e.msgType === 'interactive_reply' ? 'text-blue-700' : ''}`}>
                {e.msgType === 'interactive_reply' ? `☑ ${e.msg}` : e.msg}
              </span>
            </div>
          )}

          {/* Response sent */}
          {e.response && (
            <div className="flex gap-1.5 items-start">
              <span className="text-[10px] text-gray-400 w-12 shrink-0 pt-0.5">OUT</span>
              <span className="text-gray-700 break-all">{e.response}</span>
            </div>
          )}

          {/* Action triggered */}
          {e.action && (
            <div className="flex gap-1.5 items-center">
              <span className="text-[10px] text-gray-400 w-12 shrink-0">ACT</span>
              {actionBadge(e.action)}
            </div>
          )}

          {/* Error */}
          {e.error && (
            <div className="flex gap-1.5 items-start mt-1 p-1.5 bg-red-50 rounded border border-red-200">
              <span className="text-[10px] text-red-400 w-12 shrink-0 pt-0.5">ERR</span>
              <span className="text-red-700 break-all">{e.error}</span>
            </div>
          )}

        </div>
      ))}
    </div>
  )
}
