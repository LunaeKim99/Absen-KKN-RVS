import { type ReactNode } from 'react';
import { ClipboardCheck } from 'lucide-react';

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-green-50 via-white to-emerald-50 px-4 py-8">
      <div className="mb-8 flex flex-col items-center gap-2 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-600 shadow-lg">
          <ClipboardCheck className="h-7 w-7 text-white" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-bold text-gray-900">Absensi KKN</h1>
      </div>
      {children}
      <p className="mt-6 text-center text-xs text-gray-400">
        Sistem Absensi Kelompok KKN
      </p>
    </div>
  );
}
