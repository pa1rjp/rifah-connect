import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchLeads, approveLead, rejectLead, requestMoreInfo, markLeadPosted } from '@/lib/erpnext'

export function useLeads(filters = {}) {
  return useQuery({ queryKey: ['leads', filters], queryFn: () => fetchLeads(filters) })
}

function useLeadMutation(fn) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }) })
}

export const useApproveLead    = () => useLeadMutation(({ docname, note })   => approveLead(docname, note))
export const useRejectLead     = () => useLeadMutation(({ docname, reason }) => rejectLead(docname, reason))
export const useRequestInfo    = () => useLeadMutation(({ docname, note })   => requestMoreInfo(docname, note))
export const useMarkLeadPosted = () => useLeadMutation(({ docname })         => markLeadPosted(docname))
