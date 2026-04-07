import { Search } from 'lucide-react'

export default function FilterBar({ search, onSearch, filters = [], className = '' }) {
  return (
    <div className={`flex flex-wrap gap-3 ${className}`}>
      {onSearch !== undefined && (
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search || ''}
            onChange={e => onSearch(e.target.value)}
            placeholder="Search..."
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rifah-teal/30"
          />
        </div>
      )}
      {filters.map(({ label, value, onChange, options }) => (
        <select
          key={label}
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-rifah-teal/30 bg-white"
        >
          <option value="">{label}: All</option>
          {options.map(o => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
        </select>
      ))}
    </div>
  )
}
