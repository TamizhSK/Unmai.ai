"use client";

import { Moon, SunDim } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

type props = {
  className?: string;
};

export const AnimatedThemeToggler = ({ className }: props) => {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [mounted, setMounted] = useState(false);
  
  // Ensure component is mounted to prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);
  
  const isDarkMode = mounted ? resolvedTheme === "dark" : false;

  const changeTheme = async () => {
    if (!buttonRef.current) return;

    // Check if startViewTransition is supported
    if (!document.startViewTransition) {
      // Fallback for browsers that don't support View Transitions API
      setTheme(isDarkMode ? "light" : "dark");
      return;
    }

    await document.startViewTransition(() => {
      flushSync(() => {
        setTheme(isDarkMode ? "light" : "dark");
      });
    }).ready;

    const { top, left, width, height } =
      buttonRef.current.getBoundingClientRect();
    const y = top + height / 2;
    const x = left + width / 2;

    const right = window.innerWidth - left;
    const bottom = window.innerHeight - top;
    const maxRad = Math.hypot(Math.max(left, right), Math.max(top, bottom));

    document.documentElement.animate(
      {
        clipPath: [
          `circle(0px at ${x}px ${y}px)`,
          `circle(${maxRad}px at ${x}px ${y}px)`,
        ],
      },
      {
        duration: 700,
        easing: "ease-in-out",
        pseudoElement: "::view-transition-new(root)",
      },
    );
  };

  // Show a consistent loading state until mounted to prevent hydration mismatch
  if (!mounted) {
    return (
      <button 
        className={cn(
          "relative p-2 rounded-full bg-muted hover:bg-muted/80 transition-all duration-200 hover:scale-105",
          className
        )}
        aria-label="Toggle theme"
        disabled
      >
        <div className="relative w-5 h-5">
          <SunDim className="absolute inset-0 h-5 w-5 rotate-0 scale-100 transition-all duration-300" />
          <Moon className="absolute inset-0 h-5 w-5 rotate-90 scale-0 transition-all duration-300" />
        </div>
      </button>
    );
  }

  return (
    <button 
      ref={buttonRef} 
      onClick={changeTheme} 
      className={cn(
        "relative p-2 rounded-full bg-muted hover:bg-muted/80 transition-all duration-200 hover:scale-105",
        className
      )}
      aria-label="Toggle theme"
    >
      <div className="relative w-5 h-5">
        <SunDim 
          className={cn(
            "absolute inset-0 h-5 w-5 rotate-0 scale-100 transition-all duration-300",
            isDarkMode && "-rotate-90 scale-0"
          )} 
        />
        <Moon 
          className={cn(
            "absolute inset-0 h-5 w-5 rotate-90 scale-0 transition-all duration-300",
            isDarkMode && "rotate-0 scale-100"
          )} 
        />
      </div>
    </button>
  );
};
