import { useCallback } from "react"

import { useProviderAssignment } from "../context/provider-assignment-context"

/**
 * Convenience hook for event selection (bulk assignment).
 * Wraps the ProviderAssignment context with selection-specific helpers.
 */
export function useEventSelection() {
	const { state, dispatch } = useProviderAssignment()

	const { isSelectionMode, selectedEventIds } = state.selection

	const toggleSelectionMode = useCallback(() => {
		dispatch({ type: "TOGGLE_SELECTION_MODE" })
	}, [dispatch])

	const toggleSelection = useCallback(
		(eventId: string) => {
			if (selectedEventIds.has(eventId)) {
				dispatch({ type: "DESELECT_EVENT", eventId })
			} else {
				dispatch({ type: "SELECT_EVENT", eventId })
			}
		},
		[dispatch, selectedEventIds]
	)

	const selectAll = useCallback(
		(eventIds: string[]) => {
			dispatch({ type: "SELECT_EVENTS", eventIds })
		},
		[dispatch]
	)

	const clearSelection = useCallback(() => {
		dispatch({ type: "CLEAR_SELECTION" })
	}, [dispatch])

	const isSelected = useCallback(
		(eventId: string): boolean => {
			return selectedEventIds.has(eventId)
		},
		[selectedEventIds]
	)

	return {
		isSelectionMode,
		selectedEventIds,
		selectedCount: selectedEventIds.size,
		toggleSelectionMode,
		toggleSelection,
		selectAll,
		clearSelection,
		isSelected,
	}
}
