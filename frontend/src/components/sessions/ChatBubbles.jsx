import { safeJson, fmtDate } from '@/lib/utils'

function InteractiveBubble({ content }) {
  const payload = safeJson(content, null)
  if (!payload) return <span className="italic text-gray-500">[interactive]</span>

  const header = payload.header?.text || ''
  const body   = payload.body?.text   || ''
  const footer = payload.footer?.text || ''

  // list message rows
  const rows = payload.action?.sections?.flatMap(s => s.rows || []) || []
  // button message buttons
  const buttons = payload.action?.buttons?.map(b => b.reply || b) || []

  return (
    <div className="text-sm">
      {header && <p className="font-semibold mb-1">{header}</p>}
      {body   && <p className="whitespace-pre-wrap mb-1">{body}</p>}
      {rows.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {rows.map(r => (
            <li key={r.id} className="flex items-start gap-1 text-xs text-gray-700">
              <span className="font-medium min-w-[18px]">{r.id}.</span>
              <span>{r.title}{r.description ? <span className="text-gray-400 ml-1">— {r.description}</span> : ''}</span>
            </li>
          ))}
        </ul>
      )}
      {buttons.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {buttons.map(b => (
            <span key={b.id} className="text-xs bg-white border border-gray-300 rounded px-2 py-0.5">{b.title}</span>
          ))}
        </div>
      )}
      {footer && <p className="text-[10px] text-gray-400 mt-1">{footer}</p>}
    </div>
  )
}

function MessageContent({ msg }) {
  // Outbound interactive = list/button we sent (full JSON payload)
  if (msg.type === 'interactive' && msg.dir !== 'inbound') return <InteractiveBubble content={msg.content} />
  // Inbound interactive_reply = user tapped a list/button option
  if (msg.type === 'interactive_reply' || (msg.type === 'interactive' && msg.dir === 'inbound')) {
    return (
      <div className="flex items-center gap-1 text-sm">
        <span className="text-blue-500">☑</span>
        <span className="font-medium">{msg.content}</span>
      </div>
    )
  }
  if (msg.type === 'image')       return <span className="italic text-gray-500">📷 Image</span>
  if (msg.type !== 'text')        return <span className="italic text-gray-500">📄 {msg.type}</span>
  return <p className="whitespace-pre-wrap break-words">{msg.content}</p>
}

export default function ChatBubbles({ session }) {
  if (!session) return null

  const sessionData = safeJson(session.session_data, {})
  const history = sessionData._chat || safeJson(session.chat_history, [])

  if (!history.length) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-gray-400 text-sm">
        <p>No chat history yet.</p>
        <p className="text-xs mt-1">Messages will appear here once the n8n workflow writes chat_history.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 p-4 bg-rifah-bubble min-h-full">
      {history.map((msg, i) => {
        const isOut = msg.dir === 'outbound'
        return (
          <div key={msg.id || i} className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm shadow-sm ${isOut ? 'bg-rifah-light text-gray-900 rounded-br-none' : 'bg-white text-gray-900 rounded-bl-none'}`}>
              <MessageContent msg={{ ...msg, dir: isOut ? 'outbound' : 'inbound' }} />
              <div className="flex items-center justify-end gap-2 mt-1">
                {isOut && msg.step && <span className="text-[10px] text-gray-400 font-mono">{msg.step}</span>}
                <span className="text-[10px] text-gray-400">{msg.ts ? fmtDate(msg.ts) : ''}</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
