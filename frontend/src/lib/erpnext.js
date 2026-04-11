import api from './api'

const enc = (v) => encodeURIComponent(JSON.stringify(v))

// ── Sessions ─────────────────────────────────────────────────────────────────
export async function fetchSessions({ status, step, dateFrom, dateTo, search } = {}) {
  const filters = []
  if (status)   filters.push(['status', '=', status])
  if (step)     filters.push(['current_step', '=', step])
  if (dateFrom) filters.push(['last_activity', '>=', dateFrom])
  if (dateTo)   filters.push(['last_activity', '<=', dateTo])
  if (search)   filters.push(['phone_number', 'like', `%${search}%`])

  const fields = ['name','phone_number','current_step','status','last_activity','session_data']
  const res = await api.get(`/resource/RIFAH Session?filters=${enc(filters)}&fields=${enc(fields)}&limit=200&order_by=last_activity+desc`)
  return res.data.data || []
}

export async function fetchSession(docname) {
  const res = await api.get(`/resource/RIFAH Session/${docname}`)
  return res.data.data
}

// ── Members ──────────────────────────────────────────────────────────────────
export async function fetchMembers({ tier, status, search } = {}) {
  const filters = []
  if (tier)   filters.push(['membership_tier', '=', tier])
  if (status) filters.push(['status', '=', status])
  if (search) filters.push(['full_name', 'like', `%${search}%`])

  const fields = ['name','rifah_id','full_name','whatsapp_number','business_name','city_state',
                  'industry','email','membership_tier','status','registration_date',
                  'rifahmart_url','groups_assigned','payment_transaction_id','payment_screenshot']
  const res = await api.get(`/resource/RIFAH Member?filters=${enc(filters)}&fields=${enc(fields)}&limit=200&order_by=registration_date+desc`)
  return res.data.data || []
}

export async function fetchMember(docname) {
  const res = await api.get(`/resource/RIFAH Member/${docname}`)
  return res.data.data
}

export async function approvePremium(docname) {
  const res = await api.put(`/resource/RIFAH Member/${docname}`, {
    status: 'Active Premium',
    payment_verified_on: new Date().toISOString().replace('T', ' ').substring(0, 19),
  })
  return res.data
}

export async function suspendMember(docname) {
  const res = await api.put(`/resource/RIFAH Member/${docname}`, { status: 'Suspended' })
  return res.data
}

export async function assignGroups(docname, groups) {
  const res = await api.put(`/resource/RIFAH Member/${docname}`, {
    groups_assigned: groups,
    groups_assigned_on: new Date().toISOString().replace('T', ' ').substring(0, 19),
  })
  return res.data
}

export async function updateAdminNotes(docname, notes) {
  const res = await api.put(`/resource/RIFAH Member/${docname}`, { admin_notes: notes })
  return res.data
}

// ── Leads ────────────────────────────────────────────────────────────────────
export async function fetchLeads({ tier, status, leadType, urgency, search, dateFrom } = {}) {
  const filters = []
  if (tier)     filters.push(['tier', '=', tier])
  if (status)   filters.push(['status', '=', status])
  if (leadType) filters.push(['lead_type', '=', leadType])
  if (urgency)  filters.push(['urgency', '=', urgency])
  if (dateFrom) filters.push(['created_at', '>=', dateFrom])
  if (search)   filters.push(['title', 'like', `%${search}%`])

  const fields = ['name','lead_id','member_id','member_name','member_phone','tier','status',
                  'lead_type','title','description','location','urgency','budget','created_at',
                  'approved_by','approved_at','ai_qualification','interested_vendors']
  const res = await api.get(`/resource/RIFAH Lead?filters=${enc(filters)}&fields=${enc(fields)}&limit=200&order_by=created_at+desc`)
  return res.data.data || []
}

export async function approveLead(docname, adminNote = '') {
  const res = await api.put(`/resource/RIFAH Lead/${docname}`, {
    status: 'Approved - Ready for Posting',
    approved_by: 'Admin',
    approved_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
    ...(adminNote && { admin_notes: adminNote }),
  })
  return res.data
}

export async function rejectLead(docname, reason = '') {
  const res = await api.put(`/resource/RIFAH Lead/${docname}`, {
    status: 'Rejected',
    ...(reason && { admin_notes: reason }),
  })
  return res.data
}

export async function requestMoreInfo(docname, note) {
  const res = await api.put(`/resource/RIFAH Lead/${docname}`, {
    status: 'Awaiting User Response',
    admin_notes: note,
  })
  return res.data
}

export async function markLeadPosted(docname) {
  const res = await api.put(`/resource/RIFAH Lead/${docname}`, { status: 'Posted to Groups' })
  return res.data
}

// ── Groups ───────────────────────────────────────────────────────────────────
export async function fetchGroups() {
  const fields = ['name','group_id','group_name','group_jid','is_active','active_members','city','state','industry']
  const res = await api.get(`/resource/RIFAH WhatsApp Group?fields=${enc(fields)}&limit=100&order_by=group_name+asc`)
  return res.data.data || []
}

export async function fetchGroupMembers(groupId) {
  const filters = [['groups_assigned', 'like', `%${groupId}%`]]
  const fields  = ['name','rifah_id','full_name','whatsapp_number','business_name','membership_tier','status']
  const res = await api.get(`/resource/RIFAH Member?filters=${enc(filters)}&fields=${enc(fields)}&limit=200`)
  return res.data.data || []
}

// ── KPIs ─────────────────────────────────────────────────────────────────────
export async function fetchKPIs() {
  const [activeMembers, premiumMembers, activeSessions, pendingPayments, pendingLeads, leadsToday] =
    await Promise.all([
      api.get(`/resource/RIFAH Member?filters=${enc([['status','in',['Active Free','Active Premium']]])}&fields=${enc(['name'])}&limit=500`),
      api.get(`/resource/RIFAH Member?filters=${enc([['status','=','Active Premium']])}&fields=${enc(['name'])}&limit=500`),
      api.get(`/resource/RIFAH Session?filters=${enc([['status','=','Active']])}&fields=${enc(['name'])}&limit=500`),
      api.get(`/resource/RIFAH Member?filters=${enc([['status','=','Payment Uploaded']])}&fields=${enc(['name'])}&limit=500`),
      api.get(`/resource/RIFAH Lead?filters=${enc([['status','=','Pending Review'],['tier','=','FREE']])}&fields=${enc(['name'])}&limit=500`),
      api.get(`/resource/RIFAH Lead?filters=${enc([['created_at','>=', new Date().toISOString().substring(0,10)]])}&fields=${enc(['name'])}&limit=500`),
    ])
  return {
    activeMembers:   (activeMembers.data.data   || []).length,
    premiumMembers:  (premiumMembers.data.data   || []).length,
    activeSessions:  (activeSessions.data.data   || []).length,
    pendingApprovals:(pendingPayments.data.data  || []).length + (pendingLeads.data.data || []).length,
    leadsToday:      (leadsToday.data.data       || []).length,
  }
}

export async function fetchMemberGrowth() {
  const fields = ['name','registration_date','membership_tier']
  const res = await api.get(`/resource/RIFAH Member?fields=${enc(fields)}&limit=500&order_by=registration_date+asc`)
  return res.data.data || []
}

export async function fetchLeadVolume() {
  const fields = ['name','lead_type','created_at']
  const res = await api.get(`/resource/RIFAH Lead?fields=${enc(fields)}&limit=500`)
  return res.data.data || []
}
