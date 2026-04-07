import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchMembers, fetchMember, approvePremium, suspendMember, assignGroups, updateAdminNotes } from '@/lib/erpnext'

export function useMembers(filters = {}) {
  return useQuery({ queryKey: ['members', filters], queryFn: () => fetchMembers(filters) })
}

export function useMember(docname) {
  return useQuery({ queryKey: ['member', docname], queryFn: () => fetchMember(docname), enabled: !!docname })
}

function useMemberMutation(fn) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: ['members'] }) })
}

export const useApprovePremium   = () => useMemberMutation(({ docname }) => approvePremium(docname))
export const useSuspendMember    = () => useMemberMutation(({ docname }) => suspendMember(docname))
export const useAssignGroups     = () => useMemberMutation(({ docname, groups }) => assignGroups(docname, groups))
export const useUpdateAdminNotes = () => useMemberMutation(({ docname, notes }) => updateAdminNotes(docname, notes))
