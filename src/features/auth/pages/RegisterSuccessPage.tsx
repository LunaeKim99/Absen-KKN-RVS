import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Button } from '@/components/ui/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import { getTodayInWIB } from '@/lib/kkn-utils';

export default function RegisterSuccessPage() {
  const today = format(getTodayInWIB(), 'EEEE, dd MMMM yyyy', { locale: id });

  return (
    <AuthLayout>
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="mt-4">Pendaftaran Berhasil</CardTitle>
          <CardDescription>
            Akun Anda sudah terdaftar dan sedang menunggu persetujuan admin.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Anda akan dapat melakukan absensi setelah akun disetujui.
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{today}</p>
          <Link to="/login">
            <Button variant="primary" className="w-full">
              Kembali ke Login
            </Button>
          </Link>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}