const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i

function normalizeCandidate(candidate: string | null | undefined) {
	if (!candidate) return null

	const normalized = candidate.trim().toLowerCase()

	if (!normalized) return null

	return normalized
}

export function isValidEmail(candidate: string | null | undefined) {
	const normalized = normalizeCandidate(candidate)
	if (!normalized) return false

	return emailRegex.test(normalized)
}

export function extractEmails(input: string | null | undefined) {
	const normalized = normalizeCandidate(input)
	if (!normalized) return []

	return normalized
		.split(/[;,\s]+/)
		.map((part) => part.trim())
		.filter((part) => Boolean(part) && isValidEmail(part))
}

export function getFirstValidEmail(candidates: Array<string | null | undefined>) {
	for (const candidate of candidates) {
		const emails = extractEmails(candidate)
		if (emails.length > 0) {
			return emails[0]
		}
	}

	return null
}

export function getFirstAgencyEmail(contactEmails: string[]) {
	for (const email of contactEmails) {
		const normalizedEmail = getFirstValidEmail([email])
		if (normalizedEmail) {
			return normalizedEmail
		}
	}

	return null
}

export function dedupeEmails(emails: string[]) {
	return Array.from(new Set(emails.map((email) => email.trim().toLowerCase()))).filter(Boolean)
}
