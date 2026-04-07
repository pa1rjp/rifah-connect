import { useQuery } from '@tanstack/react-query'
import { fetchGroups, fetchGroupMembers } from '@/lib/erpnext'

export function useGroups() {
  return useQuery({ queryKey: ['groups'], queryFn: fetchGroups })
}

export function useGroupMembers(groupId) {
  return useQuery({
    queryKey: ['groupMembers', groupId],
    queryFn: () => fetchGroupMembers(groupId),
    enabled: !!groupId,
  })
}
