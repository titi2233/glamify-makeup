import { cn } from "@/lib/utils";

export type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn("skeleton-shimmer rounded-xl", className)}
      aria-hidden="true"
      {...props}
    />
  );
}
