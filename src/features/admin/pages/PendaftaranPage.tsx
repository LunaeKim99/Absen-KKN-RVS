import { useState, useMemo } from 'react';
import {
  Search,
  XCircle,
  Ban,
  Eye,
  ShieldCheck,
} from 'lucide-react';
import { usePendaftaran, useApproveUser, useRejectUser, useSuspendUser } from '@/features/admin/hooks/usePendaftaran';
import { formatKknDate } from '@/lib/kkn-utils';
import type { Profile, ApprovalStatus } from '@/types/database';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';

const STATUS_TABS: { key: ApprovalStatus | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'SEMUA' },
  { key: 'PENDING', label: 'PENDING' },
  { key: 'APPROVED', label: 'APPROVED' },
  { key: 'REJECTED', label: 'REJECTED' },
  { key: 'SUSPENDED', label: 'SUSPENDED' },
];

function canApprove(status: ApprovalStatus): boolean {
  return status === 'PENDING';
}

function canReject(status: ApprovalStatus): boolean {
  return status === 'PENDING';
}

function canSuspend(status: ApprovalStatus): boolean {
  return status === 'APPROVED' || status === 'PENDING';
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function PendaftaranPage() {
  const [statusFilter, setStatusFilter] = useState<ApprovalStatus | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');

  const { toast } = useToast();
  const { data: registrations = [] } = usePendaftaran(
    statusFilter === 'ALL' ? undefined : statusFilter,
  );
  const approveUser = useApproveUser();
  const rejectUser = useRejectUser();
  const suspendUser = useSuspendUser();

  const filtered = useMemo(() => {
    if (!search.trim()) return registrations;
    const term = search.toLowerCase();
    return registrations.filter(
      (r) =>
        r.name.toLowerCase().includes(term) ||
        r.nim.toLowerCase().includes(term) ||
        r.email.toLowerCase().includes(term) ||
        r.faculty.toLowerCase().includes(term) ||
        r.major.toLowerCase().includes(term),
    );
  }, [registrations, search]);

  const detailProfile = registrations.find((r) => r.id === detailId) ?? null;

  const handleApprove = async (userId: string) => {
    try {
       await approveUser.mutateAsync({ userId });
       toast.success('Pendaftaran disetujui');
     } catch {
       toast.error('Gagal menyetujui pendaftaran');
     }
   };

   const handleReject = async () => {
     if (!rejectId || !rejectNotes.trim()) return;
     try {
       await rejectUser.mutateAsync({ userId: rejectId, notes: rejectNotes });
       setRejectId(null);
       setRejectNotes('');
       toast.success('Pendaftaran ditolak');
     } catch {
       toast.error('Gagal menolak pendaftaran');
     }
   };

   const handleSuspend = async (userId: string) => {
     try {
       await suspendUser.mutateAsync({ userId });
       toast.success('Pendaftaran ditangguhkan');
     } catch {
       toast.error('Gagal menangguhkan pendaftaran');
     }
   };

  const handleApproveClick = (r: Profile) => {
    if (canApprove(r.approval_status)) handleApprove(r.id);
  };

  const handleRejectClick = (r: Profile) => {
    if (canReject(r.approval_status)) {
      setRejectId(r.id);
      setRejectNotes('');
    }
  };

  const handleSuspendClick = (r: Profile) => {
    if (canSuspend(r.approval_status)) handleSuspend(r.id);
  };

  const actionButtons = (r: Profile) => {
    const actions: React.ReactNode[] = [];

    actions.push(
      <Button
        key="detail"
        variant="outline"
        size="sm"
        onClick={() => setDetailId(r.id)}
        className="min-w-[44px] min-h-[44px]"
        aria-label="Lihat detail"
      >
        <Eye className="h-4 w-4" />
      </Button>,
    );

    if (canApprove(r.approval_status)) {
      actions.push(
        <Button
          key="approve"
          variant="success"
          size="sm"
          onClick={() => handleApproveClick(r)}
          className="min-w-[44px] min-h-[44px]"
          loading={approveUser.isPending}
          aria-label="Setujui"
        >
          <ShieldCheck className="h-4 w-4" />
        </Button>,
      );
    }

    if (canReject(r.approval_status)) {
      actions.push(
        <Button
          key="reject"
          variant="danger"
          size="sm"
          onClick={() => handleRejectClick(r)}
          className="min-w-[44px] min-h-[44px]"
          aria-label="Tolak"
        >
          <XCircle className="h-4 w-4" />
        </Button>,
      );
    }

    if (canSuspend(r.approval_status)) {
      actions.push(
        <Button
          key="suspend"
          variant="outline"
          size="sm"
          onClick={() => handleSuspendClick(r)}
          className="min-w-[44px] min-h-[44px]"
          loading={suspendUser.isPending}
          aria-label="Tangguhkan"
        >
          <Ban className="h-4 w-4" />
        </Button>,
      );
    }

    return actions;
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Manajemen Pendaftaran" />

      {/* Status Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2" role="tablist">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={statusFilter === tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors min-h-[44px] ${
              statusFilter === tab.key
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700/50 dark:text-gray-300 dark:hover:bg-gray-700/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
        <Input
          placeholder="Cari nama, NIM, email, fakultas, jurusan..."
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
                <tr className="border-b bg-gray-50 dark:bg-gray-800/50">
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Nama</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">NIM</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Fakultas</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Jurusan</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Email</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Tanggal Daftar</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-300">Aksi</th>
                </tr>
              </thead>
              <tbody>
{filtered.map((r) => (
                  <tr key={r.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{r.name}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{r.nim}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{r.faculty}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{r.major}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{r.email}</td>
                  <td className="px-4 py-3">
                    <StatusBadge.ApprovalStatusBadge status={r.approval_status} />
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {formatKknDate(new Date(r.created_at))}
                  </td>
                  <td className="px-4 py-3 text-right">{actionButtons(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Mobile Cards */}
      <div className="space-y-3 md:hidden">
        {filtered.map((r) => (
          <Card key={r.id}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{r.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{r.nim}</p>
                </div>
                <StatusBadge.ApprovalStatusBadge status={r.approval_status} />
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-500">Fakultas</p>
                  <p className="text-gray-700 dark:text-gray-300">{r.faculty}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-500">Jurusan</p>
                  <p className="text-gray-700 dark:text-gray-300">{r.major}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-gray-400 dark:text-gray-500">Email</p>
                  <p className="text-gray-700 dark:text-gray-300">{r.email}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-500">Daftar</p>
                  <p className="text-gray-700 dark:text-gray-300">
                    {formatKknDate(new Date(r.created_at))}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">{actionButtons(r)}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detail Modal */}
      <Modal
        open={!!detailId}
        onClose={() => setDetailId(null)}
        title="Detail Pendaftaran"
      >
        {detailProfile && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-700 font-bold dark:bg-green-900/30 dark:text-green-400">
                {getInitials(detailProfile.name)}
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-gray-100">{detailProfile.name}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{detailProfile.nim} &middot; {detailProfile.email}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500">Fakultas</p>
                <p>{detailProfile.faculty}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500">Jurusan</p>
                <p>{detailProfile.major}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500">Status Persetujuan</p>
                <StatusBadge.ApprovalStatusBadge status={detailProfile.approval_status} />
              </div>
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500">Tanggal Daftar</p>
                <p>{formatKknDate(new Date(detailProfile.created_at))}</p>
              </div>
            </div>
            {(detailProfile.approved_by || detailProfile.approval_notes) && (
              <div className="space-y-2 border-t pt-4">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Riwayat Persetujuan</h4>
                {detailProfile.approved_by && (
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Disetujui oleh ID: {detailProfile.approved_by}
                  </p>
                )}
                {detailProfile.approved_at && (
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Pada: {formatKknDate(new Date(detailProfile.approved_at))}
                  </p>
                )}
                {detailProfile.approval_notes && (
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Catatan: {detailProfile.approval_notes}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Reject Modal */}
      <Modal
        open={!!rejectId}
        onClose={() => { setRejectId(null); setRejectNotes(''); }}
        title="Tolak Pendaftaran"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Alasan penolakan wajib diisi.
          </p>
          <textarea
            value={rejectNotes}
            onChange={(e) => setRejectNotes(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white p-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500"
            rows={3}
            placeholder="Tulis alasan penolakan..."
            aria-label="Alasan penolakan"
          />
          <div className="flex gap-2 justify-end">
            <Button
              variant="secondary"
              onClick={() => { setRejectId(null); setRejectNotes(''); }}
            >
              Batal
            </Button>
            <Button
              variant="danger"
              onClick={handleReject}
              disabled={!rejectNotes.trim() || rejectUser.isPending}
              loading={rejectUser.isPending}
            >
              Tolak
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}