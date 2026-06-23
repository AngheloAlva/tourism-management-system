import { Resend } from "resend"

import { IS_DEMO } from "@/lib/demo"

const resendApiKey = process.env.RESEND_API_KEY

/**
 * In demo mode the Resend client is always null so that `canSendEmails()`
 * returns false and all email send paths no-op with "simulado en modo demo"
 * feedback — regardless of whether RESEND_API_KEY is present.
 */
export const resendClient = IS_DEMO ? null : (resendApiKey ? new Resend(resendApiKey) : null)

export const resendFromEmail =
	process.env.RESEND_FROM_EMAIL || "Turismo Chile Tours <onboarding@resend.dev>"

export function canSendEmails() {
	return Boolean(resendClient)
}
