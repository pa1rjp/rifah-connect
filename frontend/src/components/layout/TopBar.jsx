import { RefreshCw } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'

export default function TopBar({ title }) {
  const qc = useQueryClient()
  return (
    <header className="h-14 border-b border-gray-200 bg-white flex items-center px-6 gap-4 shrink-0">
      <h1 className="text-base font-semibold text-gray-900 flex-1">{title}</h1>
      <button
        onClick={() => qc.invalidateQueries()}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
      >
        <RefreshCw size={12} /> Refresh
      </button>
    </header>
  )
}
