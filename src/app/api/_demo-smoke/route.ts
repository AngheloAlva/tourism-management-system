// TEMPORARY — smoke test for PGlite runtime validation. Remove after spike.
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  if (process.env.DEMO_MODE !== "true") {
    return NextResponse.json({ ok: false, error: "DEMO_MODE not set" }, { status: 400 })
  }
  try {
    const { PGlite } = await import("@electric-sql/pglite")
    const db = new PGlite()
    await db.exec(`
      CREATE TABLE IF NOT EXISTS smoke_test (id SERIAL PRIMARY KEY, name TEXT NOT NULL);
      INSERT INTO smoke_test (name) VALUES ('hello');
    `)
    const result = await db.query<{ id: number; name: string }>("SELECT id, name FROM smoke_test")
    return NextResponse.json({ ok: true, count: result.rows.length, rows: result.rows })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
