"use client"

import { useEffect, useState } from "react"

const STORAGE_KEY = "cal-grouped"

/**
 * Persists the calendar grouped-toggle state to localStorage.
 *
 * SSR-safe: initialises to `true` on the server and on the first client render,
 * then reads localStorage in a useEffect to avoid hydration mismatches.
 */
export function useGroupedToggle(): [boolean, (value: boolean) => void] {
	// Always start with `true` — synced from localStorage in useEffect
	const [isGrouped, setIsGrouped] = useState<boolean>(true)

	useEffect(() => {
		try {
			const stored = localStorage.getItem(STORAGE_KEY)
			if (stored !== null) {
				setIsGrouped(stored === "true")
			}
		} catch {
			// localStorage unavailable (private browsing, SSR edge case) — keep default
		}
	}, [])

	const toggleGrouped = (value: boolean) => {
		setIsGrouped(value)
		try {
			localStorage.setItem(STORAGE_KEY, String(value))
		} catch {
			// best-effort
		}
	}

	return [isGrouped, toggleGrouped]
}
