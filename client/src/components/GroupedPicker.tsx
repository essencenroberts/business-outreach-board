import { useEffect, useState } from "react";
import clsx from "clsx";
import type { OptionGroup } from "../lib/options";

const OTHER = "__other";

/**
 * Dropdown with grouped options and a "Something else…" choice that reveals a text box.
 * `commit="change"` reports every keystroke (forms); `commit="blur"` reports when the text box
 * loses focus (auto-saving fields like the side panel).
 */
export function GroupedPicker({
  value,
  onChange,
  groups,
  placeholder,
  otherPlaceholder = "Type it here",
  required,
  ghost,
  commit = "change",
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  groups: OptionGroup[];
  placeholder: string;
  otherPlaceholder?: string;
  required?: boolean;
  ghost?: boolean;
  commit?: "change" | "blur";
  ariaLabel?: string;
}) {
  const known = groups.some((g) => g.options.includes(value));
  const [other, setOther] = useState(Boolean(value) && !known);
  const [text, setText] = useState(known ? "" : value);

  // Keep in sync when the value changes from outside (e.g. Claude filled it in, or another save).
  useEffect(() => {
    const isKnown = groups.some((g) => g.options.includes(value));
    if (value && !isKnown) {
      setOther(true);
      setText(value);
    } else if (isKnown) {
      setOther(false);
    }
  }, [value, groups]);

  const selectClass = ghost
    ? "field-ghost h-8 w-full cursor-pointer rounded-md px-1.5 text-sm"
    : "field h-8 w-full rounded-md px-2 text-sm";
  const inputClass = ghost ? "field-ghost h-8 w-full rounded-md px-2 text-sm" : "field mt-1.5 h-8 w-full rounded-md px-2.5 text-sm";

  return (
    <div className={clsx("w-full", ghost && "flex flex-col gap-0.5")}>
      <select
        aria-label={ariaLabel}
        required={required && !other}
        value={other ? OTHER : value}
        onChange={(e) => {
          const next = e.target.value;
          if (next === OTHER) {
            setOther(true);
            setText("");
            if (commit === "change") onChange("");
          } else {
            setOther(false);
            onChange(next);
          }
        }}
        className={clsx(selectClass, !other && !value && "text-faint")}
      >
        <option value="" disabled={required}>
          {placeholder}
        </option>
        {groups.map(({ group, options }) => (
          <optgroup key={group} label={group}>
            {options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </optgroup>
        ))}
        <option value={OTHER}>Something else…</option>
      </select>
      {other && (
        <input
          required={required}
          autoFocus={!value}
          value={text}
          placeholder={otherPlaceholder}
          aria-label={`${ariaLabel ?? "Value"} (custom)`}
          onChange={(e) => {
            setText(e.target.value);
            if (commit === "change") onChange(e.target.value);
          }}
          onBlur={() => {
            if (commit === "blur" && text.trim() !== value.trim()) onChange(text.trim());
          }}
          onKeyDown={(e) => {
            if (commit === "blur" && e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className={inputClass}
        />
      )}
    </div>
  );
}
