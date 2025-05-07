import { cn } from "@/lib/utils"

function Skeleton({
  style,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-md bg-muted", className)}
      style={style}
      {...props}
    />
  )
}

export { Skeleton }
