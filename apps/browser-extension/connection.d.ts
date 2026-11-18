export type Connection = { origin: string; authenticationMode: "password" | "none"; token?: string };
export function normalizeServerURL(value: string): string;
export function connection(): Promise<Connection | undefined>;
export function serverSettings(origin: string): Promise<{ authenticationMode: "password" | "none" }>;
