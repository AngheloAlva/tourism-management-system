import { Resend } from "resend"

const resendApiKey = process.env.RESEND_API_KEY

export const resendClient = resendApiKey ? new Resend(resendApiKey) : null

export const resendFromEmail =
	process.env.RESEND_FROM_EMAIL || "Turismo Chile Tours <onboarding@resend.dev>"

export function canSendEmails() {
	return Boolean(resendClient)
}
