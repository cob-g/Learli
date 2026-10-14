import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { shareImage } from "@/lib/seo/metadata";

export const alt = shareImage.alt;
export const size = { width: shareImage.width, height: shareImage.height };
export const contentType = shareImage.type;

// The kit wordmark is 408 by 145; it is only placed and scaled here.
const wordmark = { width: 510, height: 181.25 };

/**
 * The card shown when a Learli link is shared: the kit's reverse wordmark on
 * navy, as on the brand kit's card front. The artwork is the original file. No
 * photograph is used, because the site's photographs are illustrations and
 * must not stand in for real tutors or learners.
 */
export default async function ShareImage() {
  const artwork = await readFile(
    join(process.cwd(), "public/brand/learli-wordmark-reverse.svg"),
    "base64",
  );
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#1E2A78",
      }}
    >
      {/* Drawn into the PNG, never rendered as part of a page. */}
      <img src={`data:image/svg+xml;base64,${artwork}`} alt="" {...wordmark} />
    </div>,
    size,
  );
}
