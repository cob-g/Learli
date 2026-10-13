/**
 * Refraction for the home page's liquid glass: noise bends whatever is behind
 * a sheet, then a blur settles it. Browsers reference these from
 * `backdrop-filter`, which only Chromium supports for SVG filters; home.css
 * falls back to a plain frosted sheet everywhere else.
 */
export function GlassFilters() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="0"
      height="0"
      className="absolute"
    >
      <defs>
        {/* Broad, slow waves for panels. */}
        <filter
          id="learli-glass"
          x="0%"
          y="0%"
          width="100%"
          height="100%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.008 0.014"
            numOctaves="1"
            seed="7"
            result="noise"
          />
          <feGaussianBlur in="noise" stdDeviation="3" result="soft" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="soft"
            scale="46"
            xChannelSelector="R"
            yChannelSelector="B"
            result="bent"
          />
          <feGaussianBlur in="bent" stdDeviation="5" />
        </filter>
        {/* Tighter ripples for buttons. */}
        <filter
          id="learli-glass-fine"
          x="0%"
          y="0%"
          width="100%"
          height="100%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.04 0.05"
            numOctaves="1"
            seed="3"
            result="noise"
          />
          <feGaussianBlur in="noise" stdDeviation="2" result="soft" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="soft"
            scale="36"
            xChannelSelector="R"
            yChannelSelector="B"
            result="bent"
          />
          <feGaussianBlur in="bent" stdDeviation="3" />
        </filter>
      </defs>
    </svg>
  );
}
