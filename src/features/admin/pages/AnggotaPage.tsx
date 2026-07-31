import { useState, useMemo } from 'react';
import { Search, Edit, User, UserCheck, UserX } from 'lucide-react';
import { useAnggota, useAnggotaAttendance, useToggleActive } from '@/features/admin/hooks/useAnggota';
import { useUpdateProfileMember } from '@/features/admin/hooks/usePendaftaran';
import type { AnggotaWithAttendance } from '@/features/admin/hooks/useAnggota';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/Toast';

function attendanceStats(member: AnggotaWithAttendance) {
  const hadir = member.attendance_count;
  const present = member.attendance_percentage;
  return { hadir, present };
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm text-gray-700">{value}</p>
    </div>
  );
}

export default function AnggotaPage() {
  const [search, setSearch] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState<{ name: string; faculty: string; major: string } | null>(null);
  const [deactivateId, setDeactivateId] = useState<string | null>(null);
  const [activateId, setActivateId] = useState<string | null>(null);

  const { toast } = useToast();
  const { data: members = [], isLoading } = useAnggota();
  const updateProfile = useUpdateProfileMember();
  const toggleActive = useToggleActive();

  // Attendance hooks for detail and edit members
  const detailAttendance = useAnggotaAttendance(detailId ?? '');

  const filtered = useMemo(() => {
    if (!search.trim()) return members;
    const term = search.toLowerCase();
    return members.filter((m) =>
      m.name.toLowerCase().includes(term) ||
      m.nim.toLowerCase().includes(term) ||
      m.faculty.toLowerCase().includes(term) ||
      m.major.toLowerCase().includes(term)
    );
  }, [members, search]);

  const detailMember = members.find((m) => m.id === detailId) ?? null;
  const editMember = members.find((m) => m.id === editId) ?? null;

  const handleOpenEdit = (member: AnggotaWithAttendance) => {
    setEditId(member.id);
    setEditData({ name: member.name, faculty: member.faculty, major: member.major });
  };

  const handleSaveEdit = async () => {
    if (!editId || !editData) return;
    try {
      await updateProfile.mutateAsync({
        userId: editId,
        name: editData.name,
        faculty: editData.faculty,
        major: editData.major,
      });
      setEditId(null);
      setEditData(null);
      toast.success('Profil anggota berhasil diperbarui');
    } catch {
      toast.error('Gagal memperbarui profil anggota');
    }
  };

  const handleToggleActive = async (userId: string, isActive: boolean) => {
    try {
      await toggleActive.mutateAsync({ userId, isActive });
      toast.success(isActive ? 'Anggota diaktifkan' : 'Anggota dinonaktifkan');
    } catch {
      toast.error(`Gagal ${isActive ? 'mengaktifkan' : 'menonaktifkan'} anggota`);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Manajemen Anggota" />

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="Cari nama, NIM, fakultas, jurusan..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Desktop Table */}
      <Card className="hidden md:block">
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Nama</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">NIM</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Fakultas</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Jurusan</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Jumlah Hadir</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">% Kehadiran</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">
                    Tidak ada anggota ditemukan
                  </td>
                </tr>
              ) : (
                filtered.map((m) => {
                  const stats = attendanceStats(m);
                  return (
                    <tr key={m.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{m.name}</td>
                      <td className="px-4 py-3 text-gray-600">{m.nim}</td>
                      <td className="px-4 py-3 text-gray-600">{m.faculty}</td>
                      <td className="px-4 py-3 text-gray-600">{m.major}</td>
                      <td className="px-4 py-3 text-green-700 font-medium">{stats.hadir}/40</td>
                      <td className="px-4 py-3">
                        <span className={`text-sm font-medium ${
                          stats.present >= 80 ? 'text-green-600' :
                          stats.present >= 60 ? 'text-amber-600' : 'text-red-600'
                        }`}>{stats.present}%</span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge.ApprovalStatusBadge status={m.approval_status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDetailId(m.id)}
                            className="min-w-[40px] min-h-[40px]"
                            aria-label="Detail"
                          >
                            <User className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEdit(m)}
                            className="min-w-[40px] min-h-[40px]"
                            aria-label="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {m.is_active ? (
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => setDeactivateId(m.id)}
                              className="min-w-[40px] min-h-[40px]"
                              aria-label="Nonaktifkan"
                            >
                              <UserX className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="success"
                              size="sm"
                              onClick={() => setActivateId(m.id)}
                              className="min-w-[40px] min-h-[40px]"
                              aria-label="Aktifkan"
                            >
                              <UserCheck className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Mobile Cards */}
      <div className="space-y-3 md:hidden">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="space-y-3 p-4">
                {Array.from({ length: 8 }).map((_, j) => (
                  <div key={j} className="h-4 w-32 animate-pulse rounded bg-gray-200" />
                ))}
              </CardContent>
            </Card>
          ))
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-500">
            Tidak ada anggota ditemukan
          </div>
        ) : (
          filtered.map((m) => {
            const stats = attendanceStats(m);
            return (
              <Card key={m.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{m.name}</p>
                      <p className="text-sm text-gray-500">{m.nim}</p>
                    </div>
                    <StatusBadge.ApprovalStatusBadge status={m.approval_status} />
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <InfoRow label="Fakultas" value={m.faculty} />
                    <InfoRow label="Jurusan" value={m.major} />
                    <InfoRow label="Jumlah Hadir" value={`${stats.hadir}/40`} />
                    <InfoRow label="% Kehadiran" value={`${stats.present}%`} />
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-20 rounded-full bg-gray-200">
                        <div
                          className={`h-2 rounded-full ${
                            stats.present >= 80 ? 'bg-green-600' :
                            stats.present >= 60 ? 'bg-amber-600' : 'bg-red-600'
                          }`}
                          style={{ width: `${stats.present}%` }}
                        />
                      </div>
                      <span className={`text-xs font-medium ${
                        stats.present >= 80 ? 'text-green-600' :
                        stats.present >= 60 ? 'text-amber-600' : 'text-red-600'
                      }`}>{stats.present}%</span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDetailId(m.id)}
                        className="min-w-[40px] min-h-[40px]"
                        aria-label="Detail"
                      >
                        <User className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEdit(m)}
                        className="min-w-[40px] min-h-[40px]"
                        aria-label="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {m.is_active ? (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => setDeactivateId(m.id)}
                          className="min-w-[40px] min-h-[40px]"
                          aria-label="Nonaktifkan"
                        >
                          <UserX className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="success"
                          size="sm"
                          onClick={() => setActivateId(m.id)}
                          className="min-w-[40px] min-h-[40px]"
                          aria-label="Aktifkan"
                        >
                          <UserCheck className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Detail Modal */}
      <Modal open={!!detailId} onClose={() => setDetailId(null)} title="Detail Anggota" size="lg">
        {detailMember && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-700 font-bold text-lg">
                {detailMember.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-lg">{detailMember.name}</p>
                <p className="text-sm text-gray-500">{detailMember.nim} • {detailMember.email}</p>
                <p className="text-sm text-gray-500">Status: {detailMember.is_active ? 'Aktif' : 'Nonaktif'}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <InfoRow label="Fakultas" value={detailMember.faculty} />
              <InfoRow label="Jurusan" value={detailMember.major} />
              <InfoRow label="Tanggal Daftar" value={detailMember.created_at} />
              <InfoRow label="Status Persetujuan" value={detailMember.approval_status} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-3">Riwayat Kehadiran</p>
              {detailAttendance.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-8 animate-pulse rounded bg-gray-200" />
                  ))}
                </div>
              ) : detailAttendance.data?.length === 0 ? (
                <p className="text-sm text-gray-500">Belum ada riwayat absensi</p>
              ) : (
                <div className="space-y-2">
                  {detailAttendance.data?.map((a) => (
                    <div key={a.id} className="flex items-center justify-between p-2 rounded bg-gray-50">
                      <div>
                        <p className="font-medium text-gray-900">{a.attendance_date}</p>
                        <p className="text-xs text-gray-500">{a.check_in_at}</p>
                      </div>
                      <StatusBadge.AttendanceStatusBadge status={a.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editId} onClose={() => { setEditId(null); setEditData(null); }} title="Edit Anggota">
        {editMember && editData && (
          <div className="space-y-4">
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama</label>
                <Input
                  value={editData.name}
                  onChange={(e) => setEditData({...editData, name: e.target.value})}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fakultas</label>
                <Input
                  value={editData.faculty}
                  onChange={(e) => setEditData({...editData, faculty: e.target.value})}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Jurusan</label>
                <Input
                  value={editData.major}
                  onChange={(e) => setEditData({...editData, major: e.target.value})}
                  className="w-full"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => { setEditId(null); setEditData(null); }}
              >
                Batal
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveEdit}
                loading={updateProfile.isPending}
              >
                Simpan
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Deactivate Dialog */}
      <ConfirmDialog
        open={!!deactivateId}
        onCancel={() => setDeactivateId(null)}
        onConfirm={() => deactivateId && handleToggleActive(deactivateId, false)}
        title="Nonaktifkan Anggota"
        description="Apakah Anda yakin ingin menonaktifkan anggota ini? Mereka tidak akan dapat melakukan absensi."
        confirmLabel="Nonaktifkan"
        cancelLabel="Batal"
      />

      {/* Activate Dialog */}
      <ConfirmDialog
        open={!!activateId}
        onCancel={() => setActivateId(null)}
        onConfirm={() => activateId && handleToggleActive(activateId, true)}
        title="Aktifkan Anggota"
        description="Apakah Anda yakin ingin mengaktifkan kembali anggota ini?"
        confirmLabel="Aktifkan"
        cancelLabel="Batal"
      />
    </div>
  );
}