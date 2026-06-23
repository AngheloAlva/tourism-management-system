import { randomBytes } from "node:crypto"

// Exclude visually ambiguous characters: O, 0, I, l, 1
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ"
const LOWER = "abcdefghijkmnopqrstuvwxyz"
const DIGIT = "23456789"
const SYMBOL = "!@#$%^&*()-_=+"
const ALPHABET = UPPER + LOWER + DIGIT + SYMBOL

/**
 * Generates a cryptographically secure temporary password.
 * Guarantees at least one character from each class (upper, lower, digit, symbol).
 * Excludes visually ambiguous characters (O, 0, I, l, 1).
 * Default length is 16 — exceeds the 8-char minimum of changePasswordSchema.
 */
export function generateTemporaryPassword(length = 16): string {
	const pickOne = (set: string): string => set[randomBytes(1)[0] % set.length]

	// Guarantee at least one character from each class
	const required = [pickOne(UPPER), pickOne(LOWER), pickOne(DIGIT), pickOne(SYMBOL)]

	const remaining: string[] = []
	const buf = randomBytes(length - required.length)
	for (let i = 0; i < buf.length; i++) {
		remaining.push(ALPHABET[buf[i] % ALPHABET.length])
	}

	const all = [...required, ...remaining]

	// Fisher–Yates shuffle using crypto randomness
	for (let i = all.length - 1; i > 0; i--) {
		const j = randomBytes(1)[0] % (i + 1)
		;[all[i], all[j]] = [all[j], all[i]]
	}

	return all.join("")
}
