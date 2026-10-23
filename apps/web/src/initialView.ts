export type InitialConnectionView = `connection:${"shortcut" | "granola"}` | "all";

export function initialConnectionView(search: string): InitialConnectionView | "inbox" {
  const requested = new URLSearchParams(search).get("view");
  return requested === "connection:shortcut" || requested === "connection:granola" || requested === "all"
    ? requested
    : "inbox";
}
