import { supabase, supabaseSetupMessage } from './supabase'

export type PortalState = {
  title: string
  isOpen: boolean
  maxSubmissions: number
  submissionCount: number
}

export type AdminSubmission = {
  id: string
  discordName: string
  link: string
  position: number
  submittedAt: string
}

export type SubmitResult = {
  status: 'accepted' | 'closed' | 'duplicate'
  submissionCount: number
  maxSubmissions: number
  isOpen: boolean
}

type PortalStateRow = {
  title: string
  is_open: boolean
  max_submissions: number
  submission_count: number
}

type AdminSubmissionRow = {
  id: string
  discord_name: string
  link: string
  submission_position: number
  submitted_at: string
}

type SubmitResultRow = {
  status: SubmitResult['status']
  submission_count: number
  max_submissions: number
  is_open: boolean
}

function getClient() {
  if (!supabase) {
    throw new Error(supabaseSetupMessage)
  }

  return supabase
}

function mapPortalState(row: PortalStateRow): PortalState {
  return {
    title: row.title,
    isOpen: row.is_open,
    maxSubmissions: row.max_submissions,
    submissionCount: row.submission_count,
  }
}

function mapAdminSubmission(row: AdminSubmissionRow): AdminSubmission {
  return {
    id: row.id,
    discordName: row.discord_name,
    link: row.link,
    position: row.submission_position,
    submittedAt: row.submitted_at,
  }
}

function mapSubmitResult(row: SubmitResultRow): SubmitResult {
  return {
    status: row.status,
    submissionCount: row.submission_count,
    maxSubmissions: row.max_submissions,
    isOpen: row.is_open,
  }
}

export async function loadPortalState() {
  const { data, error } = await getClient()
    .from('oro_portal_state')
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return mapPortalState(data as PortalStateRow)
}

export async function submitOroLink(discordName: string, link: string) {
  const { data, error } = await getClient().rpc('submit_oro_link', {
    input_discord_name: discordName,
    input_link: link,
  })

  if (error) {
    throw error
  }

  const row = (Array.isArray(data) ? data[0] : data) as SubmitResultRow
  return mapSubmitResult(row)
}

export async function verifyAdminPassword(password: string) {
  const { data, error } = await getClient().rpc('verify_admin_password', {
    input_password: password,
  })

  if (error) {
    throw error
  }

  return Boolean(data)
}

export async function loadAdminSubmissions(password: string) {
  const { data, error } = await getClient().rpc('list_admin_submissions', {
    input_password: password,
  })

  if (error) {
    throw error
  }

  return ((data ?? []) as AdminSubmissionRow[]).map(mapAdminSubmission)
}

export async function savePortalSettings(
  password: string,
  title: string,
  isOpen: boolean,
  maxSubmissions: number,
) {
  const { data, error } = await getClient().rpc('set_oro_settings', {
    input_password: password,
    input_title: title,
    input_is_open: isOpen,
    input_max_submissions: maxSubmissions,
  })

  if (error) {
    throw error
  }

  const row = (Array.isArray(data) ? data[0] : data) as PortalStateRow
  return mapPortalState(row)
}

export async function resetPortal(password: string) {
  const { data, error } = await getClient().rpc('reset_oro_portal', {
    input_password: password,
  })

  if (error) {
    throw error
  }

  const row = (Array.isArray(data) ? data[0] : data) as PortalStateRow
  return mapPortalState(row)
}
