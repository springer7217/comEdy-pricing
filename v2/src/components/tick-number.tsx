import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export function TickNumber({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const [display, setDisplay] = useState(value);
  const [bump, setBump] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      setDisplay(value);
      return;
    }
    setBump(true);
    const t = window.setTimeout(() => {
      setDisplay(value);
      setBump(false);
    }, 90);
    return () => window.clearTimeout(t);
  }, [value]);

  return (
    <span
      className={cn(
        "tabular inline-block transition-[opacity,transform,filter] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]",
        bump && "translate-y-1 opacity-0 blur-[2px]",
        className,
      )}
    >
      {display}
    </span>
  );
}
