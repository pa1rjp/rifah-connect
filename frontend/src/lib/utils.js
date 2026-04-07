import { format, formatDistanceToNow, parseISO } from 'date-fns'

export function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}

export function fmtDate(dt) {
  if (!dt) return '—'
  try { return format(parseISO(dt), 'dd MMM yyyy, hh:mm a') } catch { return dt }
}

export function fmtRelative(dt) {
  if (!dt) return '—'
  try { return formatDistanceToNow(parseISO(dt), { addSuffix: true }) } catch { return dt }
}

export function safeJson(str, fallback = null) {
  try { return JSON.parse(str || '{}') } catch { return fallback }
}

export const STATUS_COLORS = {
  'Active Free':            'bg-green-100 text-green-800',
  'Active Premium':         'bg-yellow-100 text-yellow-800',
  'Payment Uploaded':       'bg-blue-100 text-blue-800',
  'Pending Admin Review':   'bg-orange-100 text-orange-800',
  'Pending Payment':        'bg-purple-100 text-purple-800',
  'Suspended':              'bg-red-100 text-red-800',
  'Active':                 'bg-green-100 text-green-800',
  'Completed':              'bg-gray-100 text-gray-700',
  'Expired':                'bg-red-100 text-red-700',
  'Pending Review':         'bg-orange-100 text-orange-800',
  'Approved - Ready for Posting': 'bg-blue-100 text-blue-800',
  'Posted to Groups':       'bg-green-100 text-green-800',
  'Has Interested Vendors': 'bg-teal-100 text-teal-800',
  'Connected':              'bg-emerald-100 text-emerald-800',
  'Rejected':               'bg-red-100 text-red-800',
  'Closed':                 'bg-gray-100 text-gray-700',
  'Awaiting User Response': 'bg-yellow-100 text-yellow-800',
}

export const URGENCY_COLORS = {
  'URGENT':     'bg-red-100 text-red-700',
  'THIS WEEK':  'bg-orange-100 text-orange-700',
  'THIS MONTH': 'bg-yellow-100 text-yellow-700',
  'FLEXIBLE':   'bg-gray-100 text-gray-600',
}
