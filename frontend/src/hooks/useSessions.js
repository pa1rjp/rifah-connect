import { useQuery } from '@tanstack/react-query'
import { fetchSessions, fetchSession } from '@/lib/erpnext'

export function useSessions(filters = {}) {
  return useQuery({
    queryKey: ['sessions', filters],
    queryFn: () => fetchSessions(filters),
    refetchInterval: 30_000,
  })
}

export function useSession(docname) {
  return useQuery({
    queryKey: ['session', docname],
    queryFn: () => fetchSession(docname),
    enabled: !!docname,
    refetchInterval: 30_000,
  })
}
