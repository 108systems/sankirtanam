"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/core/components/ui/select";
import {
  BOOKS_THEME_LABELS,
  BOOKS_THEME_NAMES,
  type BooksThemeName,
} from "@/core/lib/themes";

export function BooksThemeSelect() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const currentTheme = (theme as BooksThemeName | undefined) ?? "mayapur";

  return (
    <Select
      disabled={!mounted}
      onValueChange={(nextTheme) => setTheme(nextTheme)}
      value={currentTheme}
    >
      <SelectTrigger className="w-[150px] bg-background/70">
        <SelectValue placeholder="Theme" />
      </SelectTrigger>
      <SelectContent>
        {BOOKS_THEME_NAMES.map((themeName) => (
          <SelectItem key={themeName} value={themeName}>
            {BOOKS_THEME_LABELS[themeName]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
