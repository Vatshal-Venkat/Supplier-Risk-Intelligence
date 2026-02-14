"use client";

import { useEffect, useState } from "react";

type Props = {
  value: number;
  duration?: number;
};

export default function AnimatedCounter({ value, duration = 800 }: Props) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let start = 0;
    const increment = value / (duration / 16);

    const counter = setInterval(() => {
      start += increment;
      if (start >= value) {
        setDisplay(value);
        clearInterval(counter);
      } else {
        setDisplay(Math.floor(start));
      }
    }, 16);

    return () => clearInterval(counter);
  }, [value, duration]);

  return <span>{display}</span>;
}
