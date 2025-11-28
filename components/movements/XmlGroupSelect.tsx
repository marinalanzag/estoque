"use client";

import { useEffect, useState } from "react";

export interface XmlGroupOption {
  key: string;
  label: string;
  importIds: string[];
}

interface XmlGroupSelectProps {
  options: XmlGroupOption[];
  name: string;
  className?: string;
  defaultValue?: string | null;
  disabledPlaceholder?: string;
}

function persistSelection(groupKey: string, importIds: string[]) {
  if (typeof document === "undefined") return;

  const maxAge = 60 * 60 * 24 * 365; // 1 ano

  if (!groupKey) {
    document.cookie = `selectedXmlGroupKey=; path=/; max-age=0`;
    document.cookie = `selectedXmlImportIds=; path=/; max-age=0`;
    return;
  }

  document.cookie = `selectedXmlGroupKey=${encodeURIComponent(
    groupKey
  )}; path=/; max-age=${maxAge}`;
  document.cookie = `selectedXmlImportIds=${encodeURIComponent(
    importIds.join(",")
  )}; path=/; max-age=${maxAge}`;
}

export default function XmlGroupSelect({
  options,
  name,
  className,
  defaultValue,
  disabledPlaceholder = "Nenhuma importação disponível",
}: XmlGroupSelectProps) {
  const [value, setValue] = useState(defaultValue ?? (options[0]?.key ?? ""));

  useEffect(() => {
    setValue(defaultValue ?? (options[0]?.key ?? ""));
  }, [defaultValue, options]);

  if (!options.length) {
    return (
      <select
        name={name}
        className={className}
        value=""
        disabled
      >
        <option value="">{disabledPlaceholder}</option>
      </select>
    );
  }

  return (
    <select
      name={name}
      className={className}
      value={value}
      onChange={(event) => {
        const newValue = event.target.value;
        setValue(newValue);
        const option = options.find((opt) => opt.key === newValue);
        persistSelection(newValue, option?.importIds ?? []);
      }}
    >
      {options.map((option) => (
        <option key={option.key} value={option.key}>
          {option.label}
        </option>
      ))}
    </select>
  );
}


