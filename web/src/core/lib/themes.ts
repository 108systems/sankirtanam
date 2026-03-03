export type BooksThemeName =
  | "light"
  | "dark"
  | "mayapur"
  | "sanyasa"
  | "bhakti";

export const BOOKS_THEME_NAMES: BooksThemeName[] = [
  "mayapur",
  "light",
  "dark",
  "sanyasa",
  "bhakti",
];

export const DEFAULT_BOOKS_THEME: BooksThemeName = "mayapur";

export const BOOKS_THEME_LABELS: Record<BooksThemeName, string> = {
  mayapur: "Mayapur",
  light: "Light",
  dark: "Dark",
  sanyasa: "Sanyasa",
  bhakti: "Bhakti",
};
