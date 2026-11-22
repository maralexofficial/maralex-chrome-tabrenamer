export const TAB_COLORS = Object.freeze([
  { id: "red", label: "Red", value: "#ef4444" },
  { id: "orange", label: "Orange", value: "#f97316" },
  { id: "yellow", label: "Yellow", value: "#eab308" },
  { id: "green", label: "Green", value: "#22c55e" },
  { id: "teal", label: "Teal", value: "#14b8a6" },
  { id: "blue", label: "Blue", value: "#3b82f6" },
  { id: "purple", label: "Purple", value: "#a855f7" },
  { id: "pink", label: "Pink", value: "#ec4899" },
]);
export function isValidTabColor(value) {
  return value === null || TAB_COLORS.some((color) => color.value === value);
}
