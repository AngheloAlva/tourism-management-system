import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components"
import * as React from "react"
import { APPROVAL_ACTION_LABELS } from "@/project/approvals/constants/approval-actions"
import { APPROVAL_ACTION } from "@/generated/prisma/enums"

interface ApprovalRequestedEmailProps {
  requesterName: string
  requesterEmail: string
  action: APPROVAL_ACTION
  targetLabel: string
  reason: string | null | undefined
  requestId: string
  appUrl: string
}

export function ApprovalRequestedEmail({
  requesterName,
  requesterEmail,
  action,
  targetLabel,
  reason,
  requestId,
  appUrl,
}: ApprovalRequestedEmailProps) {
  const actionLabel = APPROVAL_ACTION_LABELS[action] ?? action
  const inboxUrl = `${appUrl}/dashboard/autorizaciones`

  return (
    <Html lang="es">
      <Head />
      <Preview>Nueva solicitud de autorización: {actionLabel}</Preview>
      <Body style={{ fontFamily: "Arial, sans-serif", backgroundColor: "#f8fafc", margin: 0 }}>
        <Container
          style={{
            maxWidth: "560px",
            margin: "32px auto",
            backgroundColor: "#ffffff",
            borderRadius: "8px",
            padding: "32px",
            border: "1px solid #e2e8f0",
          }}
        >
          <Heading
            style={{ fontSize: "20px", fontWeight: 700, marginBottom: "8px", color: "#1e293b" }}
          >
            Nueva solicitud de autorización
          </Heading>

          <Text style={{ color: "#475569", marginTop: 0 }}>
            Se requiere tu aprobación para una acción en el sistema.
          </Text>

          <Hr style={{ borderColor: "#e2e8f0", margin: "24px 0" }} />

          <Section>
            <Text style={{ margin: "0 0 8px 0", color: "#64748b", fontSize: "13px" }}>
              ACCIÓN SOLICITADA
            </Text>
            <Text style={{ margin: "0 0 16px 0", fontWeight: 600, color: "#1e293b" }}>
              {actionLabel}
            </Text>

            <Text style={{ margin: "0 0 8px 0", color: "#64748b", fontSize: "13px" }}>
              RECURSO
            </Text>
            <Text style={{ margin: "0 0 16px 0", color: "#1e293b" }}>{targetLabel}</Text>

            <Text style={{ margin: "0 0 8px 0", color: "#64748b", fontSize: "13px" }}>
              SOLICITADO POR
            </Text>
            <Text style={{ margin: "0 0 16px 0", color: "#1e293b" }}>
              {requesterName} ({requesterEmail})
            </Text>

            {reason && (
              <>
                <Text style={{ margin: "0 0 8px 0", color: "#64748b", fontSize: "13px" }}>
                  MOTIVO
                </Text>
                <Text
                  style={{
                    margin: "0 0 16px 0",
                    color: "#1e293b",
                    backgroundColor: "#f1f5f9",
                    padding: "12px",
                    borderRadius: "6px",
                    borderLeft: "3px solid #3b82f6",
                  }}
                >
                  {reason}
                </Text>
              </>
            )}

            <Text style={{ margin: "0 0 8px 0", color: "#64748b", fontSize: "13px" }}>
              ID SOLICITUD
            </Text>
            <Text style={{ margin: "0 0 16px 0", color: "#94a3b8", fontSize: "12px" }}>
              {requestId}
            </Text>
          </Section>

          <Hr style={{ borderColor: "#e2e8f0", margin: "24px 0" }} />

          <Section style={{ textAlign: "center" }}>
            <Link
              href={inboxUrl}
              style={{
                backgroundColor: "#3b82f6",
                color: "#ffffff",
                padding: "12px 24px",
                borderRadius: "6px",
                textDecoration: "none",
                fontWeight: 600,
                display: "inline-block",
              }}
            >
              Ver solicitud en la bandeja
            </Link>
          </Section>

          <Text style={{ color: "#94a3b8", fontSize: "12px", marginTop: "24px" }}>
            TurismoChileTours — Dashboard de gestión
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default ApprovalRequestedEmail
