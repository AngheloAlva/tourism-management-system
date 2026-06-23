import { Geist } from "next/font/google"
import { Toaster } from "sonner"

import { QueryProvider } from "@/shared/providers/query-provider"
import { ThemeProvider } from "@/shared/providers/theme-provider"

import "./globals.css"

import type { Metadata } from "next"
import { cn } from "@/lib/utils"

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" })

export const metadata: Metadata = {
	title: "TurismoChileTours Dashboard",
	description: "Dashboard de TurismoChileTours",
}

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode
}>) {
	return (
		<html
			lang="es"
			translate="no"
			suppressHydrationWarning
			className={cn("font-sans notranslate", geist.variable)}
		>
			<head>
				<meta name="google" content="notranslate" />
			</head>
			<body className={`${geist.variable} antialiased`}>
				<QueryProvider>
					<ThemeProvider
						enableSystem
						attribute="class"
						defaultTheme="system"
						disableTransitionOnChange
					>
						{children}

						<Toaster position="top-center" richColors />
					</ThemeProvider>
				</QueryProvider>
			</body>
		</html>
	)
}
