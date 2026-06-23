/**
 * Unit tests for the path-based interaction guard logic.
 *
 * canCurrentUserInteractPaths is an async server action that calls auth + Prisma —
 * not directly unit-testable in a pure fashion. Instead, we test the pure core:
 *   getModuleKeyFromPath — path string → module key (null if unknown)
 *
 * This covers the key invariant that drives the guard: a sale-edit URL resolves
 * to a known module key, so the canInteract permission lookup succeeds.
 *
 * REQ-1: server-side page guard on both edit routes.
 */
import { describe, expect, it } from "vitest"
import { getModuleKeyFromPath } from "@/project/roles/constants/modules"

describe("getModuleKeyFromPath — sale/quote edit route resolution", () => {
  it("resolves /dashboard/registro-de-ventas to the sales module key", () => {
    const key = getModuleKeyFromPath("/dashboard/registro-de-ventas")
    expect(key).toBe("/registro-de-ventas")
  })

  it("resolves /dashboard/registro-de-ventas/{id} (edit route) to the sales module key", () => {
    const key = getModuleKeyFromPath("/dashboard/registro-de-ventas/abc123")
    expect(key).toBe("/registro-de-ventas")
  })

  it("resolves /dashboard/navegacion-cotizacion to the quotes module key", () => {
    const key = getModuleKeyFromPath("/dashboard/navegacion-cotizacion")
    expect(key).toBe("/navegacion-cotizacion")
  })

  it("resolves /dashboard/navegacion-cotizacion/{id} (edit route) to the quotes module key", () => {
    const key = getModuleKeyFromPath("/dashboard/navegacion-cotizacion/abc123")
    expect(key).toBe("/navegacion-cotizacion")
  })

  it("returns null for an unknown path", () => {
    const key = getModuleKeyFromPath("/dashboard/unknown-route")
    expect(key).toBeNull()
  })

  it("resolves root dashboard path to /inicio", () => {
    const key = getModuleKeyFromPath("/dashboard")
    expect(key).toBe("/inicio")
  })
})
