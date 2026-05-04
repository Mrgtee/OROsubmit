import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'
import { BrandMark } from './components/BrandMark'
import {
  loadAdminSubmissions,
  loadPortalState,
  resetPortal,
  savePortalSettings,
  submitOroLink,
  verifyAdminPassword,
  type AdminSubmission,
  type PortalState,
} from './lib/portalApi'
import { hasSupabaseConfig, supabaseSetupMessage } from './lib/supabase'
import { getErrorMessage, isValidHttpUrl, normalizeUrl } from './lib/utils'

const fallbackPortal: PortalState = {
  title: 'Submit YouTube links',
  isOpen: false,
  maxSubmissions: 1,
  submissionCount: 0,
}

function App() {
  const [portal, setPortal] = useState<PortalState>(fallbackPortal)
  const [adminSubmissions, setAdminSubmissions] = useState<AdminSubmission[]>([])
  const [discordName, setDiscordName] = useState('')
  const [link, setLink] = useState('')
  const [submissionError, setSubmissionError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [adminVisible, setAdminVisible] = useState(false)
  const [adminAuthed, setAdminAuthed] = useState(false)
  const [adminPassword, setAdminPassword] = useState('')
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [draftTitle, setDraftTitle] = useState(fallbackPortal.title)
  const [draftMaxSubmissions, setDraftMaxSubmissions] = useState('1')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(hasSupabaseConfig)
  const [setupError, setSetupError] = useState('')

  const normalizedLink = useMemo(() => normalizeUrl(link), [link])
  const submissionsFull = portal.submissionCount >= portal.maxSubmissions
  const canSubmit = portal.isOpen && !submissionsFull && hasSupabaseConfig

  const syncDrafts = (nextPortal: PortalState) => {
    setDraftTitle(nextPortal.title)
    setDraftMaxSubmissions(String(nextPortal.maxSubmissions))
  }

  const refreshPortal = async () => {
    if (!hasSupabaseConfig) {
      setLoading(false)
      return
    }

    const nextPortal = await loadPortalState()
    setPortal(nextPortal)
    syncDrafts(nextPortal)
  }

  const refreshAdminSubmissions = async (passwordToUse = adminPassword) => {
    if (!passwordToUse) {
      setAdminSubmissions([])
      return
    }

    const submissions = await loadAdminSubmissions(passwordToUse)
    setAdminSubmissions(submissions)
  }

  useEffect(() => {
    async function loadInitialState() {
      try {
        await refreshPortal()
      } catch (error) {
        setSetupError(getErrorMessage(error))
      } finally {
        setLoading(false)
      }
    }

    void loadInitialState()
  }, [])

  const handleSubmission = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmissionError('')
    setSubmitted(false)

    if (!hasSupabaseConfig) {
      setSubmissionError(supabaseSetupMessage)
      return
    }

    if (!canSubmit) {
      setSubmissionError('Submissions are closed.')
      return
    }

    const cleanDiscordName = discordName.trim()

    if (!cleanDiscordName) {
      setSubmissionError('Enter your Discord name.')
      return
    }

    if (!isValidHttpUrl(normalizedLink)) {
      setSubmissionError('Enter a valid link.')
      return
    }

    setBusy(true)

    try {
      const result = await submitOroLink(cleanDiscordName, normalizedLink)

      setPortal({
        ...portal,
        isOpen: result.isOpen,
        maxSubmissions: result.maxSubmissions,
        submissionCount: result.submissionCount,
      })

      if (result.status === 'duplicate') {
        setSubmissionError('You already submitted.')
        return
      }

      if (result.status === 'closed') {
        setSubmissionError('Submissions are closed.')
        return
      }

      setSubmitted(true)
      setDiscordName('')
      setLink('')
    } catch (error) {
      setSubmissionError(getErrorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  const handleAdminLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPasswordError('')
    setBusy(true)

    try {
      const isValidPassword = await verifyAdminPassword(password)

      if (!isValidPassword) {
        setPasswordError('Wrong password.')
        return
      }

      setAdminPassword(password)
      setAdminAuthed(true)
      setPassword('')
      await refreshAdminSubmissions(password)
    } catch (error) {
      setPasswordError(getErrorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  const handleLogout = () => {
    setAdminPassword('')
    setAdminAuthed(false)
    setAdminVisible(false)
    setAdminSubmissions([])
  }

  const updateSettings = async (nextIsOpen: boolean) => {
    const maxSubmissions = Math.max(
      1,
      Number.parseInt(draftMaxSubmissions, 10) || 1,
    )

    setBusy(true)
    setPasswordError('')

    try {
      const nextPortal = await savePortalSettings(
        adminPassword,
        draftTitle.trim() || fallbackPortal.title,
        nextIsOpen,
        maxSubmissions,
      )

      setPortal(nextPortal)
      syncDrafts(nextPortal)
      await refreshAdminSubmissions()
    } catch (error) {
      setPasswordError(getErrorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  const handleReset = async () => {
    setBusy(true)
    setPasswordError('')

    try {
      const nextPortal = await resetPortal(adminPassword)
      setPortal(nextPortal)
      syncDrafts(nextPortal)
      setAdminSubmissions([])
      setDiscordName('')
      setLink('')
      setSubmissionError('')
      setSubmitted(false)
    } catch (error) {
      setPasswordError(getErrorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="page">
      <header className="topbar">
        <BrandMark />
        <button
          className="text-button"
          type="button"
          onClick={() => setAdminVisible((current) => !current)}
        >
          {adminVisible ? 'User' : 'Admin'}
        </button>
      </header>

      {!hasSupabaseConfig ? (
        <section className="submission-panel">
          <p className="message message-error">{supabaseSetupMessage}</p>
        </section>
      ) : !adminVisible ? (
        <section className="submission-panel" aria-label="Submission form">
          <h1>{loading ? 'Loading...' : portal.title}</h1>

          <form className="form" onSubmit={handleSubmission}>
            <label>
              <span>Discord name</span>
              <input
                value={discordName}
                onChange={(event) => {
                  setDiscordName(event.target.value)
                  setSubmitted(false)
                }}
                disabled={!canSubmit || busy || loading}
                placeholder="name#0000"
              />
            </label>

            <label>
              <span>Link</span>
              <input
                value={link}
                onChange={(event) => {
                  setLink(event.target.value)
                  setSubmitted(false)
                }}
                disabled={!canSubmit || busy || loading}
                placeholder="https://youtube.com/..."
              />
            </label>

            {submitted ? <p className="message message-submitted">Submitted</p> : null}

            {!canSubmit && !submitted && !loading ? (
              <p className="message message-closed">Submissions are closed.</p>
            ) : null}

            {submissionError || setupError ? (
              <p className="message message-error">
                {submissionError || setupError}
              </p>
            ) : null}

            <button
              className="primary-button"
              type="submit"
              disabled={!canSubmit || busy || loading}
            >
              {busy ? 'Submitting...' : 'Submit'}
            </button>
          </form>
        </section>
      ) : (
        <section
          className={`admin-panel ${!adminAuthed ? 'admin-panel-login' : ''}`}
          aria-label="Admin panel"
        >
          {!adminAuthed ? (
            <form className="form compact-form" onSubmit={handleAdminLogin}>
              <label>
                <span>Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={busy}
                />
              </label>
              {passwordError ? (
                <p className="message message-error">{passwordError}</p>
              ) : null}
              <button className="primary-button" type="submit" disabled={busy}>
                {busy ? 'Login...' : 'Login'}
              </button>
            </form>
          ) : (
            <div className="admin-content">
              <div className="admin-controls">
                <label>
                  <span>Title</span>
                  <input
                    value={draftTitle}
                    onChange={(event) => setDraftTitle(event.target.value)}
                    disabled={busy}
                  />
                </label>

                <label>
                  <span>Links needed</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={draftMaxSubmissions}
                    onChange={(event) =>
                      setDraftMaxSubmissions(event.target.value)
                    }
                    disabled={busy}
                  />
                </label>

                {passwordError ? (
                  <p className="message message-error">{passwordError}</p>
                ) : null}

                <div className="button-row">
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => void updateSettings(true)}
                    disabled={busy}
                  >
                    Open
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => void updateSettings(false)}
                    disabled={busy}
                  >
                    Close
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => void updateSettings(portal.isOpen)}
                    disabled={busy}
                  >
                    Save
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => void handleReset()}
                    disabled={busy}
                  >
                    Reset
                  </button>
                  <button className="text-button" type="button" onClick={handleLogout}>
                    Logout
                  </button>
                </div>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Discord</th>
                      <th>Link</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminSubmissions.length === 0 ? (
                      <tr>
                        <td colSpan={3}>No submissions.</td>
                      </tr>
                    ) : (
                      adminSubmissions.map((submission) => (
                        <tr key={submission.id}>
                          <td>{submission.position}</td>
                          <td>{submission.discordName}</td>
                          <td>
                            <a href={submission.link} target="_blank" rel="noreferrer">
                              {submission.link}
                            </a>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  )
}

export default App
