export const palette: Record<string, string> = {
  blue: "#2563eb",
  violet: "#8b5cf6",
  green: "#14b8a6",
  orange: "#f59e0b",
};
export function colorName(value: string) {
  return palette[value]
    ? value
    : Object.keys(palette).find(
        (key) => palette[key] === value.toLowerCase(),
      ) || "blue";
}
