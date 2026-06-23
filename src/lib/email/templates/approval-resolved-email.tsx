import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components"
import * as React from "react"
import { APPROVAL_ACTION_LABELS, APPROVAL_STATUS_LABELS } from "@/project/approvals/constants/approval-actions"
import { APPROVAL_ACTION, APPROVAL_STATUS } from "@/generated/prisma/enums"

interface ApprovalResolvedEmailProps {
  requesterName: string
  action: APPROVAL_ACTION
  targetLabel: string
  finalStatus: APPROVAL_STATUS
  resolvedByName: string | null
  resolutionNote?: string | null
  executionError?: string | null
  invalidationReason?: string | null
}

const STATUS_SUBJECTS: Partial<Record<APPROVAL_STATUS, string>> = {
  [APPROVAL_STATUS.EXECUTED]: "Tu solicitud fue aprobada y ejecutada",
  [APPROVAL_STATUS.REJECTED]: "Tu solicitud fue rechazada",
  [APPROVAL_STATUS.INVALIDATED]: "Tu solicitud quedó anulada (el recurso cambió)",
  [APPROVAL_STATUS.FAILED]: "Tu solicitud fue aprobada pero falló al ejecutarse",
  [APPROVAL_STATUS.EXPIRED]: "Tu solicitud expiró sin resolución",
}

const STATUS_COLORS: Partial<Record<APPROVAL_STATUS, string>> = {
  [APPROVAL_STATUS.EXECUTED]: "#22c55e",
  [APPROVAL_STATUS.REJECTED]: "#ef4444",
  [APPROVAL_STATUS.INVALIDATED]: "#94a3b8",
  [APPROVAL_STATUS.FAILED]: "#f97316",
  [APPROVAL_STATUS.EXPIRED]: "#94a3b8",
}

export function ApprovalResolvedEmail({
  requesterName,
  action,
  targetLabel,
  finalStatus,
  resolvedByName,
  resolutionNote,
  executionError,
  invalidationReason,
}: ApprovalResolvedEmailProps) {
  const actionLabel = APPROVAL_ACTION_LABELS[action] ?? action
  const statusLabel = APPROVAL_STATUS_LABELS[finalStatus] ?? finalStatus
  const subject = STATUS_SUBJECTS[finalStatus] ?? `Tu solicitud fue ${statusLabel.toLowerCase()}`
  const statusColor = STATUS_COLORS[finalStatus] ?? "#94a3b8"

  return (
    <Html lang="es">
      <Head />
      <Preview>{subject}</Preview>
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
            Actualización de solicitud de autorización
          </Heading>

          <Text style={{ color: "#475569", marginTop: 0 }}>
            Hola {requesterName}, te informamos que tu solicitud fue resuelta.
          </Text>

          <Section
            style={{
              backgroundColor: "#f8fafc",
              borderRadius: "8px",
              padding: "16px",
              border: `2px solid ${statusColor}`,
              marginBottom: "24px",
            }}
          >
            <Text
              style={{
                margin: 0,
                fontWeight: 700,
                fontSize: "16px",
                color: statusColor,
              }}
            >
              Estado: {statusLabel}
            </Text>
          </Section>

          <Hr style={{ borderColor: "#e2e8f0", margin: "24px 0" }} />

          <Section>
            <Text style={{ margin: "0 0 8px 0", color: "#64748b", fontSize: "13px" }}>
              ACCIÓN
            </Text>
            <Text style={{ margin: "0 0 16px 0", fontWeight: 600, color: "#1e293b" }}>
              {actionLabel}
            </Text>

            <Text style={{ margin: "0 0 8px 0", color: "#64748b", fontSize: "13px" }}>
              RECURSO
            </Text>
            <Text style={{ margin: "0 0 16px 0", color: "#1e293b" }}>{targetLabel}</Text>

            {resolvedByName && (
              <>
                <Text style={{ margin: "0 0 8px 0", color: "#64748b", fontSize: "13px" }}>
                  RESUELTO POR
                </Text>
                <Text style={{ margin: "0 0 16px 0", color: "#1e293b" }}>{resolvedByName}</Text>
              </>
            )}

            {resolutionNote && (
              <>
                <Text style={{ margin: "0 0 8px 0", color: "#64748b", fontSize: "13px" }}>
                  NOTA DEL ADMIN
                </Text>
                <Text
                  style={{
                    margin: "0 0 16px 0",
                    color: "#1e293b",
                    backgroundColor: "#f1f5f9",
                    padding: "12px",
                    borderRadius: "6px",
                  }}
                >
                  {resolutionNote}
                </Text>
              </>
            )}

            {executionError && (
              <>
                <Text style={{ margin: "0 0 8px 0", color: "#64748b", fontSize: "13px" }}>
                  ERROR DE EJECUCIÓN
                </Text>
                <Text
                  style={{
                    margin: "0 0 16px 0",
                    color: "#ef4444",
                    backgroundColor: "#fef2f2",
                    padding: "12px",
                    borderRadius: "6px",
                    fontSize: "13px",
                    fontFamily: "monospace",
                  }}
                >
                  {executionError}
                </Text>
              </>
            )}

            {invalidationReason && (
              <>
                <Text style={{ margin: "0 0 8px 0", color: "#64748b", fontSize: "13px" }}>
                  MOTIVO DE ANULACIÓN
                </Text>
                <Text
                  style={{
                    margin: "0 0 16px 0",
                    color: "#64748b",
                    backgroundColor: "#f8fafc",
                    padding: "12px",
                    borderRadius: "6px",
                  }}
                >
                  {invalidationReason}
                </Text>
              </>
            )}
          </Section>

          <Text style={{ color: "#94a3b8", fontSize: "12px", marginTop: "24px" }}>
            TurismoChileTours — Dashboard de gestión
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default ApprovalResolvedEmail
