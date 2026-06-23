export const emailTheme = {
	colors: {
		black: "#0a0a0a",
		darkGray: "#374151",
		mediumGray: "#6b7280",
		lightGray: "#d1d5db",
		lineGray: "#e5e7eb",
		paperGray: "#f3f4f6",
		white: "#ffffff",
		accent: "#ff6900",
	},
	fontFamily: "Helvetica, Arial, sans-serif",
} as const

export const emailContainerStyle = {
	maxWidth: "760px",
	margin: "0 auto",
	backgroundColor: emailTheme.colors.paperGray,
	fontFamily: emailTheme.fontFamily,
	color: emailTheme.colors.darkGray,
	paddingBottom: "24px",
}

export const sectionTitleStyle = {
	fontSize: "12px",
	fontWeight: "700",
	letterSpacing: "2px",
	textTransform: "uppercase" as const,
	color: emailTheme.colors.mediumGray,
	margin: "0 0 12px",
}

export const tableCellHeaderStyle = {
	fontSize: "11px",
	fontWeight: "700",
	letterSpacing: "0.5px",
	textTransform: "uppercase" as const,
	color: emailTheme.colors.darkGray,
	padding: "0 0 8px",
	borderBottom: `1px solid ${emailTheme.colors.black}`,
}

export const tableCellStyle = {
	fontSize: "13px",
	color: emailTheme.colors.darkGray,
	padding: "10px 0",
	borderBottom: `1px solid ${emailTheme.colors.lineGray}`,
	verticalAlign: "top" as const,
}
