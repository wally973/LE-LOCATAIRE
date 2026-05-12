"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export function DynamicChecklist({
  items,
  values,
  onChange,
}: {
  items: { id: string; label: string }[];
  values: Record<string, boolean>;
  onChange: (id: string, checked: boolean) => void;
}) {
  return (
    <div className="grid gap-4">
      {items.map((item) => (
        <div key={item.id} className="flex items-center space-x-3">
          <Checkbox
            id={item.id}
            checked={values[item.id] ?? false}
            onCheckedChange={(v) => onChange(item.id, !!v)}
          />
          <Label htmlFor={item.id} className="font-normal">
            {item.label}
          </Label>
        </div>
      ))}
    </div>
  );
}
