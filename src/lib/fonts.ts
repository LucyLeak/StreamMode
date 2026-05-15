export const fontOptions = [
  {
    value: "JetBrains Mono",
    label: "JetBrains Mono",
    family: 'var(--font-jetbrains-mono), "JetBrainsMono Nerd Font", "JetBrains Mono", monospace',
  },
  {
    value: "Roboto Mono",
    label: "Roboto Mono",
    family: 'var(--font-roboto-mono), "Roboto Mono", monospace',
  },
  {
    value: "Inter",
    label: "Inter",
    family: 'var(--font-inter), "Inter", Arial, sans-serif',
  },
  {
    value: "Nerd Font Mono",
    label: "Nerd Font Mono",
    family: '"JetBrainsMono Nerd Font", "CaskaydiaCove Nerd Font", "Cascadia Mono", monospace',
  },
  {
    value: "Cascadia Mono",
    label: "Cascadia Mono",
    family: '"Cascadia Mono", Consolas, monospace',
  },
] as const;

export function resolveFontFamily(value: unknown) {
  const selected = fontOptions.find((font) => font.value === value);
  return selected?.family ?? fontOptions[0].family;
}
