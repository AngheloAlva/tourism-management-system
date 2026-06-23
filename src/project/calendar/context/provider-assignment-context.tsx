"use client"

import { createContext, useContext, useReducer } from "react"
import type { ReactNode } from "react"

import type {
	ProviderAssignmentState,
	ProviderAssignmentAction,
} from "../types/provider-assignment.types"

// --- Initial State ---

const initialState: ProviderAssignmentState = {
	selection: {
		isSelectionMode: false,
		selectedEventIds: new Set(),
	},
	isToolbarOpen: false,
	activeConflicts: [],
	pendingAssignment: null,
}

// --- Reducer ---

function providerAssignmentReducer(
	state: ProviderAssignmentState,
	action: ProviderAssignmentAction
): ProviderAssignmentState {
	switch (action.type) {
		case "TOGGLE_SELECTION_MODE":
			return {
				...state,
				selection: {
					isSelectionMode: !state.selection.isSelectionMode,
					selectedEventIds: new Set(),
				},
			}

		case "SELECT_EVENT": {
			const next = new Set(state.selection.selectedEventIds)
			next.add(action.eventId)
			return {
				...state,
				selection: { ...state.selection, selectedEventIds: next },
			}
		}

		case "DESELECT_EVENT": {
			const next = new Set(state.selection.selectedEventIds)
			next.delete(action.eventId)
			return {
				...state,
				selection: { ...state.selection, selectedEventIds: next },
			}
		}

		case "SELECT_EVENTS": {
			const next = new Set(state.selection.selectedEventIds)
			for (const id of action.eventIds) {
				next.add(id)
			}
			return {
				...state,
				selection: { ...state.selection, selectedEventIds: next },
			}
		}

		case "CLEAR_SELECTION":
			return {
				...state,
				selection: { ...state.selection, selectedEventIds: new Set() },
			}

		case "TOGGLE_TOOLBAR":
			return {
				...state,
				isToolbarOpen: !state.isToolbarOpen,
			}

		case "SET_CONFLICTS":
			return {
				...state,
				activeConflicts: action.conflicts,
			}

		case "CLEAR_CONFLICTS":
			return {
				...state,
				activeConflicts: [],
			}

		case "SET_PENDING_ASSIGNMENT":
			return {
				...state,
				pendingAssignment: action.assignment,
			}

		case "CLEAR_PENDING_ASSIGNMENT":
			return {
				...state,
				pendingAssignment: null,
			}

		default:
			return state
	}
}

// --- Context ---

interface AssignmentContextValue {
	state: ProviderAssignmentState
	dispatch: React.Dispatch<ProviderAssignmentAction>
}

const AssignmentContext = createContext<AssignmentContextValue | null>(null)

// --- Provider Component ---

interface ProviderAssignmentProviderProps {
	children: ReactNode
}

export function ProviderAssignmentProvider({ children }: ProviderAssignmentProviderProps) {
	const [state, dispatch] = useReducer(providerAssignmentReducer, initialState)

	return (
		<AssignmentContext.Provider value={{ state, dispatch }}>
			{children}
		</AssignmentContext.Provider>
	)
}

// --- Hook ---

export function useProviderAssignment(): AssignmentContextValue {
	const context = useContext(AssignmentContext)

	if (!context) {
		throw new Error(
			"useProviderAssignment must be used within a ProviderAssignmentProvider. " +
				"Wrap your component tree with <ProviderAssignmentProvider>."
		)
	}

	return context
}
