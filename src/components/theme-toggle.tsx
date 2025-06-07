
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
  // Initialize currentIcon with a default. This will be rendered on the server
  // and on the initial client render *before* the useEffect runs.
  const [currentIcon, setCurrentIcon] = React.useState(<Laptop className="h-5 w-5" />)

  React.useEffect(() => {
    // This effect runs only on the client after hydration.
    // Here, 'theme' from useTheme() should be the resolved theme.
    if (theme === "light") {
      setCurrentIcon(<Sun className="h-5 w-5" />);
    } else if (theme === "dark") {
      setCurrentIcon(<Moon className="h-5 w-5" />);
    } else { // 'system' or undefined defaults to Laptop icon
      setCurrentIcon(<Laptop className="h-5 w-5" />);
    }
  }, [theme]); // Re-run when theme changes


  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="shrink-0">
          {currentIcon} {/* Use the state variable here */}
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
