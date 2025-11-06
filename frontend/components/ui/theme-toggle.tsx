"use client"

import { useEffect, useState } from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"

interface ThemeToggleProps {
  className?: string
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const isDark = resolvedTheme === "dark"

  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return (
      <div className="w-16 h-8 rounded-full bg-gray-200 dark:bg-zinc-800 animate-pulse" />
    )
  }

  return (
    <div
      className={cn(
        "flex w-16 h-8 p-1 rounded-full cursor-pointer transition-all duration-300 shadow-sm",
        isDark
          ? "bg-zinc-800 border border-zinc-700"
          : "bg-gray-200 border border-gray-300",
        className
      )}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      role="button"
      tabIndex={0}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          setTheme(isDark ? "light" : "dark")
        }
      }}
    >
      <div className="flex justify-between items-center w-full relative">
        <div
          className={cn(
            "flex justify-center items-center w-6 h-6 rounded-full transition-all duration-300 z-10",
            isDark
              ? "transform translate-x-0 bg-zinc-950 shadow-md"
              : "transform translate-x-8 bg-white shadow-md"
          )}
        >
          {isDark ? (
            <Moon
              className="w-3.5 h-3.5 text-yellow-400"
              strokeWidth={2}
            />
          ) : (
            <Sun
              className="w-3.5 h-3.5 text-orange-500"
              strokeWidth={2}
            />
          )}
        </div>
        <div
          className={cn(
            "flex justify-center items-center w-6 h-6 rounded-full transition-opacity duration-300 absolute",
            isDark ? "opacity-30 left-8" : "opacity-30 left-0"
          )}
        >
          {isDark ? (
            <Sun
              className="w-3.5 h-3.5 text-gray-400"
              strokeWidth={2}
            />
          ) : (
            <Moon
              className="w-3.5 h-3.5 text-gray-600"
              strokeWidth={2}
            />
          )}
        </div>
      </div>
    </div>
  )
}
