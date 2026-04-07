import { useState } from 'react'
import { useGroups, useGroupMembers } from '@/hooks/useGroups'
import TierBadge from '@/components/shared/TierBadge'
import StatusBadge from '@/components/shared/StatusBadge'

export default function WhatsAppGroups() {
  const { data: groups = [], isLoading } = useGroups()
  const [selected, setSelected] = useState(null)

  return (
    <div className="flex gap-4 h-full">
      {/* Group list */}
      <div className="w-72 shrink-0 space-y-2 overflow-y-auto">
        {isLoading && <p className="text-sm text-gray-400">Loading...</p>}
        {groups.map(g => (
          <button
            key={g.name}
            onClick={() => setSelected(g)}
            className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
              selected?.name === g.name
                ? 'border-rifah-teal bg-rifah-teal/5'
                : 'border-gray-200 bg-white hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <p className="font-medium text-sm">{g.group_name}</p>
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${g.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {g.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <p className="text-xs text-gray-500">{[g.city, g.state].filter(Boolean).join(', ')}</p>
            {g.industry && <p className="text-xs text-gray-400 mt-0.5">{g.industry}</p>}
            <p className="text-xs text-gray-400 mt-1">{g.active_members || 0} members</p>
          </button>
        ))}
        {!isLoading && groups.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">No groups found</p>
        )}
      </div>

      {/* Members panel */}
      <div className="flex-1 bg-white rounded-xl border border-gray-200 overflow-hidden">
        {!selected
          ? <div className="flex items-center justify-center h-full text-sm text-gray-400">Select a group to view members</div>
          : <GroupMembers group={selected} />}
      </div>
    </div>
  )
}

function GroupMembers({ group }) {
  const { data: members = [], isLoading } = useGroupMembers(group.group_id)

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-4 border-b">
        <h2 className="font-semibold text-gray-900">{group.group_name}</h2>
        <p className="text-xs text-gray-500 mt-0.5">{[group.city, group.state, group.industry].filter(Boolean).join(' · ')} · {members.length} members</p>
      </div>
      <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
        {isLoading && <p className="text-sm text-gray-400 p-4">Loading...</p>}
        {members.map(m => (
          <div key={m.name} className="flex items-center gap-3 px-5 py-3">
            <div className="w-8 h-8 rounded-full bg-rifah-teal/10 flex items-center justify-center text-rifah-teal font-semibold text-sm">
              {(m.full_name || '?')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{m.full_name}</p>
              <p className="text-xs text-gray-400">{m.business_name} · {m.whatsapp_number}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <TierBadge tier={m.membership_tier} />
              <StatusBadge status={m.status} />
            </div>
          </div>
        ))}
        {!isLoading && members.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">No members assigned to this group</p>
        )}
      </div>
    </div>
  )
}
