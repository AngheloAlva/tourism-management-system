import type { DIET_TYPE } from "@/generated/prisma/enums"

export const DIET_LABELS: Record<DIET_TYPE, string> = {
	NORMAL: "—",
	VEGETARIAN: "Vegetariano",
	VEGAN: "Vegano",
	CELIAC: "Celíaco",
	OTHER: "Otro",
}

export function formatDiet(
	diet: DIET_TYPE | null | undefined,
	dietOther: string | null | undefined
): string {
	if (diet === null || diet === undefined || diet === "NORMAL") {
		return "—"
	}
	if (diet === "OTHER" && dietOther && dietOther.trim() !== "") {
		return dietOther
	}
	return DIET_LABELS[diet]
}

export function formatAllergies(allergies: string[] | null | undefined): string {
	if (!allergies || allergies.length === 0) {
		return "—"
	}
	return allergies.join(", ")
}
