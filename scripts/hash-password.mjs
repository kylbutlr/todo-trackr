import { randomBytes, scryptSync } from "node:crypto";
import { pathToFileURL } from "node:url";

export function readHidden(prompt, input = process.stdin, output = process.stdout) {
  if (!input.isTTY) {
    throw new Error("Run this command in an interactive terminal.");
  }

  return new Promise((resolve, reject) => {
    let value = "";

    output.write(prompt);
    input.setRawMode(true);
    input.resume();
    input.setEncoding("utf8");

    const cleanup = () => {
      input.setRawMode(false);
      input.pause();
      input.removeListener("data", onData);
    };

    const onData = (chunk) => {
      // A paste can deliver the entire password and Enter in one data event.
      for (const character of chunk) {
        if (character === "\u0003") {
          cleanup();
          output.write("\n");
          reject(new Error("Cancelled."));
          return;
        }

        if (character === "\r" || character === "\n") {
          cleanup();
          output.write("\n");
          resolve(value);
          return;
        }

        if (character === "\u007f" || character === "\b") {
          value = Array.from(value).slice(0, -1).join("");
          continue;
        }

        value += character;
      }
    };

    input.on("data", onData);
  });
}

async function main() {
  const password = await readHidden("Todo Trackr password: ");

  if (password.length < 12) {
    throw new Error("Use a password with at least 12 characters.");
  }

  const confirmation = await readHidden("Confirm password: ");

  if (password !== confirmation) {
    throw new Error("Passwords do not match.");
  }

  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);

  process.stdout.write(`scrypt$${salt.toString("base64")}$${hash.toString("base64")}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
