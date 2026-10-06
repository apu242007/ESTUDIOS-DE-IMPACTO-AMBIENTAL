import { cn } from "cn"

/** Bloque gris que late mientras carga; lleva aria-hidden: el estado se anuncia con texto aparte. */
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-muted motion-reduce:animate-none", className)} {...props} />
}
