import { createContext, useContext } from "react";

export type Installation = {
  apiVersion: number;
  authenticationMode: "password" | "none";
  workSwitch: boolean;
  integrations: { shortcut: boolean; granola: boolean; codex: boolean };
};

export const legacyInstallation: Installation = {
  apiVersion: 1, authenticationMode: "password",
  workSwitch: true,
  integrations: { shortcut: true, granola: true, codex: true },
};
export const InstallationContext = createContext(legacyInstallation);
export const useInstallation = () => useContext(InstallationContext);

export function parseInstallation(value: unknown): Installation {
  if (!value || typeof value !== "object") throw new Error("The server returned invalid installation settings.");
  const record = value as Record<string, unknown>;
  const integrations = record.integrations as Record<string, unknown> | undefined;
  if (record.apiVersion !== 1 || !["password", "none"].includes(String(record.authenticationMode))
    || (record.workSwitch !== undefined && typeof record.workSwitch !== "boolean")
    || !integrations || ["shortcut", "granola", "codex"].some((key) => typeof integrations[key] !== "boolean")) {
    throw new Error("This server is not compatible with this client.");
  }
  return { ...record, workSwitch: record.workSwitch ?? true } as Installation;
}
