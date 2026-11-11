import { vi } from "vitest";

// Integration tests execute on Node, outside Next's server-component resolver.
vi.mock("server-only", () => ({}));
