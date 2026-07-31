import { cn } from '@/lib/utils';

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Memuat"
      className={cn(
        'inline-block h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-green-600',
        className,
      )}
    />
  );
}

export function LoadingScreen({ message }: { message?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-4">
      <Spinner className="h-10 w-10" />
      {message && <p className="text-sm text-gray-500">{message}</p>}
    </div>
  );
}
