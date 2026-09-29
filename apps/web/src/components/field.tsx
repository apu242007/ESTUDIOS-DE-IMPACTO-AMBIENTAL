export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      {label}
      {children}
      {error && (
        <span role="alert" className="text-sm font-normal text-destructive">
          {error}
        </span>
      )}
    </label>
  );
}
