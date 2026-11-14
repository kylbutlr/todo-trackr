export function buildProfile(value = process.env.TODO_TRACKR_BUILD_PROFILE ?? "public") {
  if (value !== "public" && value !== "personal") throw new Error(`Unknown Todo Trackr build profile: ${value}`);
  return value;
}
