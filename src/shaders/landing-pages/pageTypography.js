import { useMemo } from "react";

const clamp01 = (value) => Math.min(1, Math.max(0, value));

function normalizeHex(value, fallback) {
  if (typeof value !== "string") return fallback;
  const match = value.trim().match(/^#([\da-f]{3}|[\da-f]{6})$/i);
  if (!match) return fallback;
  const hex = match[1].toLowerCase();
  return `#${hex.length === 3 ? hex.replace(/./g, (c) => c + c) : hex}`;
}

function hexToHsl(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  return {
    h: (((r === max ? (g - b) / d % 6 : r === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60) + 360) % 360,
    s,
    l,
  };
}

function hslToHex({ h, s, l }) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(h / 60 % 2 - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return `#${[r + m, g + m, b + m].map((v) => Math.round(clamp01(v) * 255).toString(16).padStart(2, "0")).join("")}`;
}

function colorShift(from, to) {
  const a = hexToHsl(from);
  const b = hexToHsl(to);
  return {
    hue: b.h - a.h,
    saturation: a.s > 0.01 ? Math.min(3, b.s / a.s) : 1,
    lightness: a.l > 0.01 ? Math.min(3, b.l / a.l) : 1,
  };
}

function pickFont(value, fonts) {
  return fonts.find((font) => font.value === value) ?? fonts[0];
}

/*
 * Weights are authored as strings, but a caller writing `headingWeight={600}`
 * passes a number. Comparing those directly would fail and silently fall back
 * to the recipe default, so both sides are normalised to strings first.
 */
function pickWeight(value, weights, fallback) {
  if (value === undefined || value === null) return fallback;
  const wanted = String(value);
  return weights.includes(wanted) ? wanted : fallback;
}

function clampToRange(value, [min, max, fallback]) {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function fontHrefFor(fonts) {
  const specs = [...new Set(fonts.map((font) => font.google).filter(Boolean))];
  if (!specs.length) return undefined;
  return `https://fonts.googleapis.com/css2?${specs.map((spec) => `family=${spec}`).join("&")}&display=swap`;
}

export function splitTypographyProps(props) {
  const { headingFont, bodyFont, headingWeight, bodyWeight, primaryColor, headingSize, bodySize, headingLetterSpacing, ...rest } = props;
  return [{ headingFont, bodyFont, headingWeight, bodyWeight, primaryColor, headingSize, bodySize, headingLetterSpacing }, rest];
}

export function usePageTypography(recipe, props) {
  const { headingFont, bodyFont, headingWeight, bodyWeight, primaryColor, headingSize, bodySize, headingLetterSpacing } = props;
  return useMemo(() => {
    const heading = pickFont(headingFont, recipe.headingFonts);
    const body = pickFont(bodyFont, recipe.bodyFonts);
    const primary = normalizeHex(primaryColor, recipe.primaryColor);
    const untouched = primary === recipe.primaryColor;
    const shift = colorShift(recipe.primaryColor, primary);

    const retone = (hex) => {
      if (untouched) return hex;
      const hsl = hexToHsl(normalizeHex(hex, hex));
      return hslToHex({
        h: (hsl.h + shift.hue + 360) % 360,
        s: clamp01(hsl.s * shift.saturation),
        l: clamp01(hsl.l * shift.lightness),
      });
    };

    const retoneRgba = (color) => {
      if (untouched) return color;
      const match = color.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/i);
      if (!match) return color;
      const hex = `#${[match[1], match[2], match[3]].map((v) => Math.round(Number(v)).toString(16).padStart(2, "0")).join("")}`;
      const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(retone(hex).slice(i, i + 2), 16));
      return match[4] === undefined ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${match[4]})`;
    };

    const filter = (baseHex = recipe.primaryColor) => {
      if (untouched) return "none";
      const delta = colorShift(baseHex, retone(baseHex));
      return [
        `hue-rotate(${delta.hue.toFixed(2)}deg)`,
        `saturate(${Math.max(0, delta.saturation).toFixed(3)})`,
        `brightness(${Math.min(2, Math.max(0.2, delta.lightness)).toFixed(3)})`,
      ].join(" ");
    };

    const resolved = {
      heading: heading.stack,
      body: body.stack,
      headingWeight: pickWeight(headingWeight, recipe.headingWeights, recipe.headingWeight),
      bodyWeight: pickWeight(bodyWeight, recipe.bodyWeights, recipe.bodyWeight),
      primary,
      headingSize: clampToRange(headingSize, recipe.headingSize),
      bodySize: clampToRange(bodySize, recipe.bodySize),
      headingLetterSpacing: clampToRange(headingLetterSpacing, recipe.headingLetterSpacing),
      retone,
      retoneRgba,
      filter,
    };

    return {
      css: recipe.css(resolved),
      fontHref: fontHrefFor([heading, body]),
      inlineStyles: recipe.inlineStyles?.(resolved),
    };
  }, [recipe, headingFont, bodyFont, headingWeight, bodyWeight, primaryColor, headingSize, bodySize, headingLetterSpacing]);
}

const TYPOGRAPHY_STYLE_ID = "threeui-page-typography";
const TYPOGRAPHY_FONT_ID = "threeui-page-typography-fonts";
const CUSTOMIZATION_MESSAGE_TYPE = "threeui-page-customization";

/**
 * Opaque srcDoc frames cannot expose contentDocument to React. This bridge is
 * appended only to the derived srcDoc string and applies the same live style
 * contract from inside the sandbox, leaving the packaged HTML file untouched.
 */
export const PAGE_CUSTOMIZATION_BRIDGE = `<script>
window.addEventListener("message", function (event) {
  var detail = event.data;
  if (!detail || detail.type !== "${CUSTOMIZATION_MESSAGE_TYPE}") return;
  var head = document.head;
  if (!head) return;

  var link = document.getElementById("${TYPOGRAPHY_FONT_ID}");
  if (detail.fontHref) {
    if (!link) {
      link = document.createElement("link");
      link.id = "${TYPOGRAPHY_FONT_ID}";
      link.rel = "stylesheet";
      head.appendChild(link);
    }
    if (link.getAttribute("href") !== detail.fontHref) link.href = detail.fontHref;
  } else if (link) {
    link.remove();
  }

  var style = document.getElementById("${TYPOGRAPHY_STYLE_ID}");
  if (!detail.css) {
    if (style) style.remove();
    return;
  }
  if (!style) {
    style = document.createElement("style");
    style.id = "${TYPOGRAPHY_STYLE_ID}";
  }
  if (style.textContent !== detail.css) style.textContent = detail.css;
  head.appendChild(style);
});
</script>`;

/**
 * Delivers the same customization to a frame whose document cannot be reached
 * from here, by posting it to the bridge installed above.
 */
export function postPageCustomization(frame, customization) {
  const target = frame?.contentWindow;
  if (!target) return;
  target.postMessage(
    {
      type: CUSTOMIZATION_MESSAGE_TYPE,
      css: customization?.css,
      fontHref: customization?.fontHref,
    },
    "*",
  );
}

/**
 * Appended to the frame's own head rather than written into the document, so
 * the packaged file stays byte-exact. Re-appending on every update keeps the
 * sheet last in the head, which is what lets it win against the page's own
 * rules at equal specificity without a single !important.
 */
export function applyPageCustomization(frame, customization) {
  const document = frame?.contentDocument;
  if (!document?.head) return;

  const existingLink = document.getElementById(TYPOGRAPHY_FONT_ID);
  if (customization?.fontHref) {
    const link = existingLink ?? document.createElement("link");
    link.id = TYPOGRAPHY_FONT_ID;
    link.rel = "stylesheet";
    if (link.getAttribute("href") !== customization.fontHref) link.href = customization.fontHref;
    if (!existingLink) document.head.append(link);
  } else {
    existingLink?.remove();
  }

  if (!customization?.css) {
    document.getElementById(TYPOGRAPHY_STYLE_ID)?.remove();
    return;
  }

  const style = document.getElementById(TYPOGRAPHY_STYLE_ID) ?? document.createElement("style");
  style.id = TYPOGRAPHY_STYLE_ID;
  if (style.textContent !== customization.css) style.textContent = customization.css;
  document.head.append(style);

  for (const override of customization.inlineStyles ?? []) {
    for (const element of document.querySelectorAll(override.selector)) {
      for (const [property, value] of Object.entries(override.styles)) {
        element.style.setProperty(property, value);
      }
    }
  }
}
