import { createContext, useContext, useState, useCallback } from 'react'
import { CheckCircle, XCircle, X } from 'lucide-react'

const ToastCtx = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const show = useCallback((msg, type = 'success') => {
    const id = Date.now()
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000)
  }, [])

  const remove = id => setToasts(t => t.filter(x => x.id !== id))

  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] space-y-2 max-w-sm">
        {toasts.map(t => (
          <div key={t.id} className={`flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg text-sm text-white ${
            t.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}>
            {t.type === 'success' ? <CheckCircle size={16} className="mt-0.5 shrink-0" /> : <XCircle size={16} className="mt-0.5 shrink-0" />}
            <span className="flex-1">{t.msg}</span>
            <button onClick={() => remove(t.id)}><X size={14} /></button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export const useToast = () => useContext(ToastCtx)
