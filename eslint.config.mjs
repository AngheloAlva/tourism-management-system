import { dirname } from "path"
import { fileURLToPath } from "url"
import { FlatCompat } from "@eslint/eslintrc"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({
	baseDirectory: __dirname,
})

const eslintConfig = [
	...compat.extends("next/core-web-vitals", "next/typescript"),
	{
		ignores: [
			"node_modules/**",
			".next/**",
			"out/**",
			"build/**",
			"next-env.d.ts",
			"src/generated/**",
		],
	},
	// Relax rules inside test files
	{
		files: ["tests/**/*.ts", "tests/**/*.tsx"],
		languageOptions: {
			globals: {
				// Vitest globals (describe, it, expect, vi, etc.) are NOT enabled
				// globally in vitest.config.ts (globals: false), so tests import
				// them explicitly. This block suppresses no-unused-vars noise and
				// relaxes any rules that cause false positives in test context.
			},
		},
		rules: {
			"@typescript-eslint/no-explicit-any": "off",
			"@typescript-eslint/no-non-null-assertion": "off",
		},
	},
]

export default eslintConfig
