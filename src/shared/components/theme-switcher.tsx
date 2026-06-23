"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import * as React from "react"

import { Button } from "@/shared/components/ui/button"
import {
	DropdownMenu,
	DropdownMenuItem,
	DropdownMenuTrigger,
	DropdownMenuContent,
} from "@/shared/components/ui/dropdown-menu"

export function ThemeSwitcher() {
	const { setTheme } = useTheme()

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" size="icon">
					<Sun className="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
					<Moon className="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
					<span className="sr-only">Alternar Tema</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuItem onClick={() => setTheme("light")}>Tema Claro</DropdownMenuItem>
				<DropdownMenuItem onClick={() => setTheme("dark")}>Tema Oscuro</DropdownMenuItem>
				<DropdownMenuItem onClick={() => setTheme("system")}>Sistema</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
