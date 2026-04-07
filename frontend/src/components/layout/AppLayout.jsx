import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

const TITLES = {
  '/':          'Overview',
  '/sessions':  'Chat Sessions',
  '/members':   'Members',
  '/leads':     'Leads',
  '/approvals': 'Pending Approvals',
  '/groups':    'WhatsApp Groups',
}

export default function AppLayout() {
  const { pathname } = useLocation()
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar title={TITLES[pathname] || 'RIFAH Admin'} />
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
