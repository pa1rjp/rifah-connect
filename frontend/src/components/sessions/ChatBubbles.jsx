import { safeJson, fmtDate } from '@/lib/utils'

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
              {msg.type !== 'text'
                ? <span className="italic text-gray-500">[{msg.type === 'image' ? '📷 Image' : '📄 Document'}]</span>
                : <p className="whitespace-pre-wrap break-words">{msg.content}</p>}
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
