import { useRef, type ReactNode } from "react";
import { useStaggerIn } from "./useStaggerIn";

type StaggerGroupProps = {
  itemCount: number;
  resetKey?: string | null;
  className?: string;
  // A spot a guide tour can point at (data-tour).
  tour?: string;
  children: ReactNode;
};

const StaggerGroup = ({ itemCount, resetKey = null, className, tour, children }: StaggerGroupProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useStaggerIn(containerRef, itemCount, { resetKey });

  return (
    <div ref={containerRef} className={className} data-tour={tour}>
      {children}
    </div>
  );
};

export default StaggerGroup;
