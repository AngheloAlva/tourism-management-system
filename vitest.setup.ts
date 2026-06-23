import { vi } from "vitest"
import "dotenv/config"

// Even unit tests can transitively import next/cache via schemas referenced from action files.
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))
