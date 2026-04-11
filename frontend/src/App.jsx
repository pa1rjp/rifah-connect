import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from '@/components/shared/Toast'
import AppLayout from '@/components/layout/AppLayout'
import Overview          from '@/pages/Overview'
import ChatSessions      from '@/pages/ChatSessions'
import Members           from '@/pages/Members'
import Leads             from '@/pages/Leads'
import PendingApprovals  from '@/pages/PendingApprovals'
import WhatsAppGroups    from '@/pages/WhatsAppGroups'

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } })

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index            element={<Overview />} />
            <Route path="sessions"  element={<ChatSessions />} />
            <Route path="members"   element={<Members />} />
            <Route path="leads"     element={<Leads />} />
            <Route path="approvals" element={<PendingApprovals />} />
            <Route path="groups"    element={<WhatsAppGroups />} />
          </Route>
        </Routes>
      </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  )
}
