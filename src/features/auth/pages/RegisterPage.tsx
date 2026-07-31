import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { registerSchema, type RegisterInput } from '@/validations';
import { getFieldErrors } from '@/features/auth/utils/form-errors';
import { useRegister } from '@/features/auth/hooks/useRegister';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Button } from '@/components/ui/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';

const FACULTIES = [
  'FKIP',
  'Teknik',
  'Ekonomi & Bisnis',
  'Hukum',
  'Kedokteran',
  'Pertanian',
  'Ilmu Sosial & Politik',
  'MIPA',
  'Lainnya',
] as const;

const EMPTY_FORM: RegisterInput = {
  name: '',
  nim: '',
  faculty: '',
  major: '',
  email: '',
  password: '',
  confirmPassword: '',
};

export default function RegisterPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { register, isPending } = useRegister();
  const [form, setForm] = useState<RegisterInput>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof RegisterInput, string>>
  >({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const name = e.target.name as keyof RegisterInput;
    setForm((prev) => ({ ...prev, [name]: e.target.value }));
if (fieldErrors[name]) {
        setFieldErrors((prev: Partial<Record<keyof RegisterInput, string>>) => {
          const next = { ...prev };
          delete next[name];
          return next;
        });
      }
    setSubmitError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const parsed = registerSchema.safeParse(form);
    if (!parsed.success) {
      setFieldErrors(getFieldErrors(parsed.error));
      return;
    }
    register(parsed.data, {
      onSuccess: () => {
        toast.success('Pendaftaran berhasil! Silakan cek email Anda.');
        navigate('/register/success');
      },
      onError: (err: unknown) => {
        setSubmitError(
          err instanceof Error ? err.message : 'Gagal mendaftar, silakan coba lagi',
        );
      },
    });
  };

  return (
    <AuthLayout>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Daftar Akun Baru</CardTitle>
          <CardDescription>Bergabung sebagai anggota KKN</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <Input
              label="Nama Lengkap"
              name="name"
              placeholder="Nama sesuai KTP"
              autoComplete="name"
              value={form.name}
              onChange={handleChange}
              error={fieldErrors.name}
            />

            <Input
              label="NIM"
              name="nim"
              placeholder="Contoh: 2201234567"
              inputMode="numeric"
              autoComplete="off"
              value={form.nim}
              onChange={handleChange}
              error={fieldErrors.nim}
            />

            <Select
              label="Fakultas"
              name="faculty"
              value={form.faculty}
              onChange={handleChange}
              error={fieldErrors.faculty}
            >
              <option value="">Pilih fakultas</option>
              {FACULTIES.map((faculty) => (
                <option key={faculty} value={faculty}>
                  {faculty}
                </option>
              ))}
            </Select>

            <Input
              label="Jurusan"
              name="major"
              placeholder="Contoh: Pendidikan Informatika"
              autoComplete="off"
              value={form.major}
              onChange={handleChange}
              error={fieldErrors.major}
            />

            <Input
              label="Email"
              type="email"
              name="email"
              placeholder="nama@email.com"
              autoComplete="email"
              value={form.email}
              onChange={handleChange}
              error={fieldErrors.email}
            />

            <div>
              <Input
                label="Password"
                type="password"
                name="password"
                placeholder="Minimal 8 karakter"
                autoComplete="new-password"
                value={form.password}
                onChange={handleChange}
                error={fieldErrors.password}
                hint={form.password && form.password.length < 8 ? 'Minimal 8 karakter' : undefined}
              />
            </div>

            <Input
              label="Konfirmasi Password"
              type="password"
              name="confirmPassword"
              placeholder="Ulangi password"
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={handleChange}
              error={fieldErrors.confirmPassword}
            />

            {submitError && (
              <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                {submitError}
              </p>
            )}

            <Button type="submit" className="w-full" loading={isPending}>
              <UserPlus className="h-4 w-4" />
              Daftar
            </Button>
          </form>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
