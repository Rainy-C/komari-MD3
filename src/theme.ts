export function stored(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
export function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}
export function applyTheme(seed: string, appearance: string) {
  const dark =
    appearance === "dark" ||
    (appearance === "system" &&
      matchMedia("(prefers-color-scheme: dark)").matches);
  let accent =
    /^#[0-9a-f]{6}$/i.test(seed) && seed.toLowerCase() !== "#6750a4"
      ? seed
      : dark
        ? "#9cbbdf"
        : "#446b9e";
  if (dark) {
    const rgb = accent
      .slice(1)
      .match(/../g)!
      .map((v) => parseInt(v, 16));
    accent =
      "#" +
      rgb
        .map((v) =>
          Math.round(v + (255 - v) * 0.55)
            .toString(16)
            .padStart(2, "0"),
        )
        .join("");
  }
  const colors = dark
    ? {
        surface: "#282d34",
        "on-surface": "#e4e9ef",
        "on-surface-variant": "#b4becb",
        primary: accent,
        tertiary: "#a5c8ba",
        secondary: "#b4becb",
        error: "#f2aaaa",
        "outline-variant": "#414952",
        "secondary-container": "#343f4d",
        "on-secondary-container": "#e4e9ef",
        "error-container": "#4a3336",
        "on-error-container": "#ffd5d5",
      }
    : {
        surface: "#e9edf2",
        "on-surface": "#303c4c",
        "on-surface-variant": "#536277",
        primary: accent,
        tertiary: "#467761",
        secondary: "#536277",
        error: "#a23d48",
        "outline-variant": "#cbd2db",
        "secondary-container": "#dce5f0",
        "on-secondary-container": "#303c4c",
        "error-container": "#f1dfe1",
        "on-error-container": "#792b35",
      };
  for (const [role, value] of Object.entries(colors))
    document.documentElement.style.setProperty("--color-" + role, value);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
  document.documentElement.dataset.mode = dark ? "dark" : "light";
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", colors.surface);
}
