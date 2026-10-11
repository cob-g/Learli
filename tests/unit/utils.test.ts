import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("Learli semantic class merging", () => {
  it("keeps a type role together with a text color", () => {
    expect(cn("text-page-title", "text-foreground")).toBe(
      "text-page-title text-foreground",
    );
  });
  it("replaces the generated radius with the semantic radius", () => {
    expect(cn("rounded-md", "rounded-control")).toBe("rounded-control");
  });
  it("merges semantic shadow and easing utilities without dropping other styles", () => {
    expect(cn("shadow-sm ease-in p-4", "shadow-float ease-enter")).toBe(
      "p-4 shadow-float ease-enter",
    );
  });
});
