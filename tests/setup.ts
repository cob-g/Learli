import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(cleanup);

// next/font runs only inside Next's compiler; modules that load the app's
// fonts (layouts) get an inert font object under Vitest.
vi.mock("next/font/google", () => {
  const font = () => ({ className: "", variable: "", style: {} });
  return { Lexend: font, Literata: font, Newsreader: font };
});
