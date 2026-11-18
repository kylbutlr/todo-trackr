import { EventEmitter } from "node:events";
import { expect, it, vi } from "vitest";
import { readHidden } from "../scripts/hash-password.mjs";

function terminal() {
  const input = Object.assign(new EventEmitter(), { isTTY: true, setRawMode: vi.fn(), resume: vi.fn(), pause: vi.fn(), setEncoding: vi.fn() });
  return { input, output: { write: vi.fn() } };
}

it("accepts a pasted password and Enter in the same input chunk without echoing it", async () => {
  const { input, output } = terminal();
  const pending = readHidden("Password: ", input, output);
  input.emit("data", "a-pasted-test-password\r");
  expect(await pending).toBe("a-pasted-test-password");
  expect(output.write.mock.calls).toEqual([["Password: "], ["\n"]]);
  expect(input.setRawMode.mock.calls).toEqual([[true], [false]]);
  expect(input.listenerCount("data")).toBe(0);
});

it("handles deletion within a pasted chunk and restores the terminal on cancellation", async () => {
  const { input, output } = terminal();
  const pending = readHidden("Password: ", input, output);
  input.emit("data", "abc\u007fd\n");
  expect(await pending).toBe("abd");
  const cancelled = readHidden("Password: ", input, output);
  input.emit("data", "private\u0003");
  await expect(cancelled).rejects.toThrow("Cancelled");
  expect(input.listenerCount("data")).toBe(0);
});
