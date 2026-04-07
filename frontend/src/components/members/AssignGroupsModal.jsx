import { useState } from 'react'
import { X } from 'lucide-react'
import { useGroups } from '@/hooks/useGroups'
import { useAssignGroups } from '@/hooks/useMembers'

export default function AssignGroupsModal({ member, onClose }) {
  const { data: groups = [] } = useGroups()
  const [selected, setSelected] = useState(member?.groups_assigned || '')
  const assign = useAssignGroups()

  function toggle(groupId) {
    const parts = selected.split(',').map(s => s.trim()).filter(Boolean)
    const idx = parts.indexOf(groupId)
    if (idx === -1) parts.push(groupId)
    else parts.splice(idx, 1)
    setSelected(parts.join(', '))
  }

  async function handleSave() {
    await assign.mutateAsync({ docname: member.name, groups: selected })
    onClose()
  }

  if (!member) return null

  const selectedSet = new Set(selected.split(',').map(s => s.trim()).filter(Boolean))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="font-semibold text-gray-900">Assign WhatsApp Groups</h2>
            <p className="text-xs text-gray-500 mt-0.5">{member.full_name} · {member.rifah_id}</p>
          </div>
          <button onClick={onClose}><X size={18} className="text-gray-400 hover:text-gray-600" /></button>
        </div>
        <div className="px-6 py-4 max-h-72 overflow-y-auto space-y-2">
          {groups.map(g => (
            <label key={g.group_id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedSet.has(g.group_id)}
                onChange={() => toggle(g.group_id)}
                className="accent-rifah-teal"
              />
              <div>
                <p className="text-sm font-medium">{g.group_name}</p>
                <p className="text-xs text-gray-400">{[g.city, g.state, g.industry].filter(Boolean).join(' · ')}</p>
              </div>
            </label>
          ))}
          {groups.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No groups found</p>}
        </div>
        <div className="px-6 py-4 border-t flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} disabled={assign.isPending} className="px-4 py-2 text-sm rounded-lg bg-rifah-teal text-white font-medium hover:bg-rifah-dark disabled:opacity-50">
            {assign.isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
