import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Edit3, LogOut, Save, X } from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';
import { id } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';
import { useUpdateProfile } from '@/features/member/hooks/useProfile';
import { getFieldErrors } from '@/features/auth/utils/form-errors';
import { profileUpdateSchema } from '@/validations';
import { KKN_CONFIG } from '@/config/kkn';
import { PageHeader } from '@/components/ui/PageHeader';
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
import { StatusBadge } from '@/components/ui/StatusBadge';
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

interface EditForm {
  name: string;
  faculty: string;
  major: string;
}

export default function ProfilPage() {
  const navigate = useNavigate();
  const { user, profile, isLoading, signOut } = useAuth();
  const { toast } = useToast();
  const updateProfile = useUpdateProfile(user?.id ?? '');
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<EditForm>({ name: '', faculty: '', major: '' });
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof EditForm, string>>
  >({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({
        name: profile.name,
        faculty: profile.faculty,
        major: profile.major,
      });
    }
  }, [profile]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const name = e.target.name as keyof EditForm;
    setForm((prev) => ({ ...prev, [name]: e.target.value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
    setSubmitError(null);
  };

  const handleSave = () => {
    setSubmitError(null);
    const parsed = profileUpdateSchema.safeParse(form);
    if (!parsed.success) {
      setFieldErrors(getFieldErrors(parsed.error));
      return;
    }
    updateProfile.mutate(parsed.data, {
      onSuccess: () => {
        toast.success('Profil berhasil diperbarui');
        setIsEditing(false);
      },
      onError: (err) => {
        setSubmitError(
          err instanceof Error ? err.message : 'Gagal memperbarui profil',
        );
        toast.error('Gagal memperbarui profil');
      },
    });
  };

  const handleCancel = () => {
    if (profile) {
      setForm({
        name: profile.name,
        faculty: profile.faculty,
        major: profile.major,
      });
    }
    setFieldErrors({});
    setSubmitError(null);
    setIsEditing(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  if (isLoading || !profile) {
    return (
      <>
        <PageHeader title="Profil Saya" />
        <div className="py-8 text-center text-gray-500">
          Memuat profil...
        </div>
      </>
    );
  }

  const formattedDate = formatInTimeZone(
    profile.created_at,
    KKN_CONFIG.TIMEZONE,
    'dd MMMM yyyy',
    { locale: id },
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Profil Saya" />

      {/* Biodata card */}
      <Card>
        <CardHeader>
          <CardTitle>Biodata Diri</CardTitle>
          <CardDescription>Data pribadi Anda</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isEditing ? (
            <div className="space-y-4">
              <Input
                label="Nama Lengkap"
                name="name"
                value={form.name}
                onChange={handleChange}
                error={fieldErrors.name}
              />
              <Select
                label="Fakultas"
                name="faculty"
                value={form.faculty}
                onChange={handleChange}
                error={fieldErrors.faculty}
              >
                {FACULTIES.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </Select>
              <Input
                label="Jurusan"
                name="major"
                value={form.major}
                onChange={handleChange}
                error={fieldErrors.major}
              />
              {submitError && (
                <p className="text-sm text-red-600" role="alert">
                  {submitError}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <InfoRow label="Nama" value={profile.name} />
              <InfoRow label="NIM" value={profile.nim} />
              <InfoRow label="Fakultas" value={profile.faculty} />
              <InfoRow label="Jurusan" value={profile.major} />
              <InfoRow label="Email" value={profile.email} />
              <InfoRow
                label="Role"
                value={profile.role === 'ADMIN' ? 'Admin' : 'Anggota'}
              />
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Status Akun</span>
                <StatusBadge.ApprovalStatusBadge status={profile.approval_status} />
              </div>
              <InfoRow label="Tanggal Daftar" value={formattedDate} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit / Save actions */}
      {isEditing ? (
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={handleCancel}>
            <X className="h-4 w-4" />
            Batal
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={updateProfile.isPending}
            onClick={handleSave}
          >
            <Save className="h-4 w-4" />
            Simpan
          </Button>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
          <Edit3 className="h-4 w-4" />
          Edit Profil
        </Button>
      )}

      {/* Sign out */}
      <Button variant="danger" className="w-full" onClick={handleSignOut}>
        <LogOut className="h-4 w-4" />
        Keluar
      </Button>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}
