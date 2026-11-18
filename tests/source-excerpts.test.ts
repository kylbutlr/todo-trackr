import { describe, expect, it } from "vitest";

import { generateSourceExcerpts, sourceExcerpt } from "../netlify/functions/lib/automation/source-excerpts.js";

describe("Source excerpt generator", () => {
  it("extracts two meaningful sentences from Shortcut Markdown", () => {
    expect(sourceExcerpt({
      title: "Prepare launch",
      description: `
## Request
Confirm every release step before launch. Assign a named owner to each step.

## Acceptance Criteria
- [ ] Publish the release notes.
`,
    })).toBe("Confirm every release step before launch. Assign a named owner to each step.");
  });

  it("removes Markdown controls, standalone links, and section labels", () => {
    expect(sourceExcerpt({
      title: "Navigation update",
      description: `
### Context
[Figma reference](https://figma.example/file)
- [ ] **Align** the desktop menu labels
- [ ] Keep the current mobile behavior
`,
    })).toBe("Align the desktop menu labels Keep the current mobile behavior");
  });

  it("omits an excerpt when no description is available", () => {
    expect(sourceExcerpt({ title: "Confirm client launch", description: "" }))
      .toBeNull();
  });

  it("removes observed Shortcut template labels and bare URLs", () => {
    expect(sourceExcerpt({
      title: "Search leveraging NEON",
      description: "OVERVIEW Juanse at Cie's current search experience runs on Shopify's native Search & Discovery app. Reference Parents: sc-482044 Primary reference: https://example.com/search",
    })).toBe("Juanse at Cie's current search experience runs on Shopify's native Search & Discovery app.");
    expect(sourceExcerpt({
      title: "PDP E2E readiness",
      description: "Objective Prepare the actual prAna Draft catalog for the August end-to-end testing milestone.",
    })).toBe("Prepare the actual prAna Draft catalog for the August end-to-end testing milestone.");
  });

  it("omits link-only environment and review instructions", () => {
    expect(sourceExcerpt({
      title: "Setup TRAIN Concierge Environment",
      description: "TRAIN = https://admin.shopify.com/store/example",
    })).toBeNull();
    expect(sourceExcerpt({
      title: "Ticketing sections",
      description: "Please review the scope as narrated by the Client - Notes: https://docs.google.com/document/example",
    })).toBeNull();
  });

  it("keeps useful scheduling text while removing ticket-id lists", () => {
    expect(sourceExcerpt({
      title: "Release: 8/17",
      description: "Date & Time: Monday, August 17th @10am PST Approved Tickets: sc-486390 sc-477852 sc-485932",
    })).toBe("Monday, August 17th @10am PST");
  });

  it("truncates long excerpts cleanly", () => {
    const excerpt = sourceExcerpt({
      title: "Long request",
      description: "Coordinate the complete launch plan with every stakeholder and document each dependency before the final review ".repeat(6),
    });

    expect(excerpt?.length).toBeLessThanOrEqual(240);
    expect(excerpt?.endsWith("…")).toBe(true);
  });

  it("generates excerpts without an external service", async () => {
    await expect(generateSourceExcerpts([
      { title: "Prepare launch", description: "Confirm each release step." },
    ])).resolves.toEqual(["Confirm each release step."]);
  });
});
