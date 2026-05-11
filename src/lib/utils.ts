export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
}

export function normalizeUrl(value: string) {
  const trimmed = value.trim()

  if (!trimmed) {
    return ''
  }

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`

  try {
    return new URL(candidate).toString()
  } catch {
    return trimmed
  }
}

export function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function cleanYouTubeVideoId(value: string) {
  const candidate = value.trim().split(/[?&#/]/)[0]

  return /^[a-zA-Z0-9_-]{11}$/.test(candidate) ? candidate : null
}

export function getYouTubeVideoId(value: string) {
  try {
    const url = new URL(value)
    const hostname = url.hostname.replace(/^www\./, '').toLowerCase()

    if (hostname === 'youtu.be') {
      return cleanYouTubeVideoId(url.pathname.split('/').filter(Boolean)[0] ?? '')
    }

    const isYouTubeHost =
      hostname === 'youtube.com' ||
      hostname === 'm.youtube.com' ||
      hostname === 'music.youtube.com' ||
      hostname === 'youtube-nocookie.com'

    if (!isYouTubeHost) {
      return null
    }

    const watchId = url.searchParams.get('v')

    if (watchId) {
      return cleanYouTubeVideoId(watchId)
    }

    const [firstSegment, secondSegment] = url.pathname.split('/').filter(Boolean)
    const videoPathSegments = new Set(['embed', 'live', 'shorts', 'v'])

    if (firstSegment && videoPathSegments.has(firstSegment) && secondSegment) {
      return cleanYouTubeVideoId(secondSegment)
    }

    return null
  } catch {
    return null
  }
}

export function buildYouTubeQueueUrl(videoIds: string[]) {
  return `https://www.youtube.com/watch_videos?video_ids=${videoIds.join(',')}`
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function buildSubmissionUrl(slug: string) {
  const origin =
    typeof window === 'undefined' ? 'http://localhost:5173' : window.location.origin

  return `${origin}/submit/${slug}`
}

export function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  if (typeof error === 'object' && error !== null) {
    const message = (error as { message?: unknown }).message

    if (typeof message === 'string' && message.trim()) {
      return message
    }
  }

  return 'Something went wrong. Please try again.'
}

export async function copyText(value: string) {
  if (!navigator.clipboard) {
    throw new Error('Clipboard access is not available in this browser.')
  }

  await navigator.clipboard.writeText(value)
}
