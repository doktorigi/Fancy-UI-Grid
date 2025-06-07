"use client"

import * as React from "react"
import { Moon, Sun, Laptop } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [currentIcon, setCurrentIcon] = React.useState(<Laptop className="h-5 w-5" />);

  React.useEffect(() => {
    if (theme === "light") {
      setCurrentIcon(<Sun className="h-5 w-5" />);
    } else if (theme === "dark") {
      setCurrentIcon(<Moon className="h-5 w-5" />);
    } else { // system
        // For system, we need to know the actual scheme.
        // This is a simplification; a more robust solution might involve checking window.matchMedia.
        // However, next-themes handles applying the correct class, so the button icon can reflect the 'system' choice.
        setCurrentIcon(<Laptop className="h-5 w-5" />);
    }
  }, [theme]);


  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="shrink-0">
          {/* This attempts to show the correct icon based on theme immediately */}
          {theme === 'light' && <Sun className="h-5 w-5" />}
          {theme === 'dark' && <Moon className="h-5 w-5" />}
          {theme === 'system' && <Laptop className="h-5 w-5" />}
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun className="mr-2 h-4 w-4" />
          <span>Light</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon className="mr-2 h-4 w-4" />
          <span>Dark</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <Laptop className="mr-2 h-4 w-4" />
          <span>System</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
