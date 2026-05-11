import { useDashboardData } from '@/hooks/useDashboardData';
import type { TedtErfassung } from '@/types/app';
import { LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { formatDate } from '@/lib/formatters';
import { useState, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { TedtErfassungDialog } from '@/components/dialogs/TedtErfassungDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import {
  IconAlertCircle, IconTool, IconRefresh, IconCheck,
  IconPlus, IconPencil, IconTrash, IconCalendar, IconClipboardList,
} from '@tabler/icons-react';
import { StatCard } from '@/components/StatCard';

const APPGROUP_ID = '6a01dcc8b0806f67430abbf7';
const REPAIR_ENDPOINT = '/claude/build/repair';

const STATUS_COLUMNS = [
  { key: 'offen', label: 'Offen', color: 'bg-amber-100 text-amber-800 border-amber-200', dotColor: 'bg-amber-400', headerBg: 'bg-amber-50 border-amber-200' },
  { key: 'in_bearbeitung', label: 'In Bearbeitung', color: 'bg-blue-100 text-blue-800 border-blue-200', dotColor: 'bg-blue-400', headerBg: 'bg-blue-50 border-blue-200' },
  { key: 'abgeschlossen', label: 'Abgeschlossen', color: 'bg-green-100 text-green-800 border-green-200', dotColor: 'bg-green-400', headerBg: 'bg-green-50 border-green-200' },
];

export default function DashboardOverview() {
  const {
    tedtErfassung,
    loading, error, fetchAll,
  } = useDashboardData();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<TedtErfassung | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TedtErfassung | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<string | undefined>(undefined);

  const byStatus = useMemo(() => {
    const map: Record<string, TedtErfassung[]> = { offen: [], in_bearbeitung: [], abgeschlossen: [] };
    for (const entry of tedtErfassung) {
      const key = entry.fields.status?.key ?? 'offen';
      if (map[key]) map[key].push(entry);
      else map['offen'].push(entry);
    }
    return map;
  }, [tedtErfassung]);

  const totalCount = tedtErfassung.length;
  const offenCount = byStatus['offen'].length;
  const doneCount = byStatus['abgeschlossen'].length;
  const today = new Date().toISOString().slice(0, 10);
  const overdueCount = tedtErfassung.filter(e => e.fields.datum && e.fields.datum < today && e.fields.status?.key !== 'abgeschlossen').length;

  const handleCreate = async (fields: TedtErfassung['fields']) => {
    await LivingAppsService.createTedtErfassungEntry(fields as any);
    fetchAll();
  };

  const handleUpdate = async (fields: TedtErfassung['fields']) => {
    if (!editRecord) return;
    await LivingAppsService.updateTedtErfassungEntry(editRecord.record_id, fields as any);
    fetchAll();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await LivingAppsService.deleteTedtErfassungEntry(deleteTarget.record_id);
    setDeleteTarget(null);
    fetchAll();
  };

  const openCreate = (statusKey?: string) => {
    setEditRecord(null);
    setDefaultStatus(statusKey);
    setDialogOpen(true);
  };

  const openEdit = (record: TedtErfassung) => {
    setEditRecord(record);
    setDefaultStatus(undefined);
    setDialogOpen(true);
  };

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  const statusOpt = LOOKUP_OPTIONS['tedt_erfassung']?.status?.find(o => o.key === defaultStatus);
  const dialogDefaultValues = editRecord
    ? editRecord.fields
    : defaultStatus && statusOpt
      ? { status: statusOpt }
      : undefined;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Erfassungen</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Alle Einträge nach Status verwalten</p>
        </div>
        <Button onClick={() => openCreate()} className="shrink-0">
          <IconPlus size={16} className="mr-2 shrink-0" />
          Neuer Eintrag
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Gesamt"
          value={String(totalCount)}
          description="Einträge insgesamt"
          icon={<IconClipboardList size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Offen"
          value={String(offenCount)}
          description="Noch nicht begonnen"
          icon={<IconCalendar size={18} className="text-amber-500" />}
        />
        <StatCard
          title="Abgeschlossen"
          value={String(doneCount)}
          description="Erfolgreich erledigt"
          icon={<IconCheck size={18} className="text-green-500" />}
        />
        <StatCard
          title="Überfällig"
          value={String(overdueCount)}
          description="Datum überschritten"
          icon={<IconAlertCircle size={18} className="text-destructive" />}
        />
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {STATUS_COLUMNS.map(col => {
          const cards = byStatus[col.key] ?? [];
          return (
            <div key={col.key} className="flex flex-col gap-3 min-w-0">
              {/* Column Header */}
              <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl border ${col.headerBg}`}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${col.dotColor}`} />
                  <span className="font-semibold text-sm truncate">{col.label}</span>
                  <span className="text-xs font-medium text-muted-foreground ml-1">{cards.length}</span>
                </div>
                <button
                  onClick={() => openCreate(col.key)}
                  className="p-1 rounded-lg hover:bg-black/5 transition-colors shrink-0"
                  title={`Neuen Eintrag in "${col.label}" erstellen`}
                >
                  <IconPlus size={16} className="text-muted-foreground" />
                </button>
              </div>

              {/* Cards */}
              <div className="flex flex-col gap-2 min-w-0">
                {cards.length === 0 && (
                  <button
                    onClick={() => openCreate(col.key)}
                    className="flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-muted-foreground/20 text-muted-foreground/50 hover:border-muted-foreground/40 hover:text-muted-foreground transition-colors text-sm"
                  >
                    <IconPlus size={14} />
                    Hinzufügen
                  </button>
                )}
                {cards.map(entry => {
                  const isOverdue = entry.fields.datum && entry.fields.datum < today && col.key !== 'abgeschlossen';
                  return (
                    <div
                      key={entry.record_id}
                      className="group rounded-xl border bg-card shadow-sm p-4 flex flex-col gap-2 min-w-0 overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => openEdit(entry)}
                    >
                      {/* Title */}
                      <div className="flex items-start justify-between gap-2 min-w-0">
                        <p className="font-semibold text-sm text-foreground truncate min-w-0 leading-snug">
                          {entry.fields.titel || <span className="text-muted-foreground italic">Ohne Titel</span>}
                        </p>
                        <div className="flex gap-1 shrink-0">
                          <button
                            onClick={e => { e.stopPropagation(); openEdit(entry); }}
                            className="p-1 rounded-md hover:bg-muted transition-colors"
                            title="Bearbeiten"
                          >
                            <IconPencil size={14} className="text-muted-foreground" />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); setDeleteTarget(entry); }}
                            className="p-1 rounded-md hover:bg-destructive/10 transition-colors"
                            title="Löschen"
                          >
                            <IconTrash size={14} className="text-destructive" />
                          </button>
                        </div>
                      </div>

                      {/* Description */}
                      {entry.fields.beschreibung && (
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {entry.fields.beschreibung}
                        </p>
                      )}

                      {/* Footer: date + status */}
                      <div className="flex items-center justify-between gap-2 flex-wrap mt-1">
                        {entry.fields.datum ? (
                          <span className={`inline-flex items-center gap-1 text-xs font-medium ${isOverdue ? 'text-destructive' : 'text-muted-foreground'}`}>
                            <IconCalendar size={12} className="shrink-0" />
                            {formatDate(entry.fields.datum)}
                          </span>
                        ) : (
                          <span />
                        )}
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${col.color}`}>
                          {col.label}
                        </span>
                      </div>

                      {/* Anmerkungen */}
                      {entry.fields.anmerkungen && (
                        <p className="text-xs text-muted-foreground/70 italic line-clamp-1 border-t border-border pt-1.5 mt-0.5">
                          {entry.fields.anmerkungen}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Dialog */}
      <TedtErfassungDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditRecord(null); setDefaultStatus(undefined); }}
        onSubmit={async (fields) => {
          if (editRecord) {
            await handleUpdate(fields as TedtErfassung['fields']);
          } else {
            await handleCreate(fields as TedtErfassung['fields']);
          }
        }}
        defaultValues={dialogDefaultValues as any}
        enablePhotoScan={AI_PHOTO_SCAN['TedtErfassung']}
        enablePhotoLocation={AI_PHOTO_LOCATION['TedtErfassung']}
      />

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Eintrag löschen"
        description={`Soll "${deleteTarget?.fields.titel || 'dieser Eintrag'}" wirklich gelöscht werden? Diese Aktion kann nicht rückgängig gemacht werden.`}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}
      </div>
    </div>
  );
}

function DashboardError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const [repairing, setRepairing] = useState(false);
  const [repairStatus, setRepairStatus] = useState('');
  const [repairDone, setRepairDone] = useState(false);
  const [repairFailed, setRepairFailed] = useState(false);

  const handleRepair = async () => {
    setRepairing(true);
    setRepairStatus('Reparatur wird gestartet...');
    setRepairFailed(false);

    const errorContext = JSON.stringify({
      type: 'data_loading',
      message: error.message,
      stack: (error.stack ?? '').split('\n').slice(0, 10).join('\n'),
      url: window.location.href,
    });

    try {
      const resp = await fetch(REPAIR_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ appgroup_id: APPGROUP_ID, error_context: errorContext }),
      });

      if (!resp.ok || !resp.body) {
        setRepairing(false);
        setRepairFailed(true);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const raw of lines) {
          const line = raw.trim();
          if (!line.startsWith('data: ')) continue;
          const content = line.slice(6);
          if (content.startsWith('[STATUS]')) {
            setRepairStatus(content.replace(/^\[STATUS]\s*/, ''));
          }
          if (content.startsWith('[DONE]')) {
            setRepairDone(true);
            setRepairing(false);
          }
          if (content.startsWith('[ERROR]') && !content.includes('Dashboard-Links')) {
            setRepairFailed(true);
          }
        }
      }
    } catch {
      setRepairing(false);
      setRepairFailed(true);
    }
  };

  if (repairDone) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center">
          <IconCheck size={22} className="text-green-500" />
        </div>
        <div className="text-center">
          <h3 className="font-semibold text-foreground mb-1">Dashboard repariert</h3>
          <p className="text-sm text-muted-foreground max-w-xs">Das Problem wurde behoben. Bitte laden Sie die Seite neu.</p>
        </div>
        <Button size="sm" onClick={() => window.location.reload()}>
          <IconRefresh size={14} className="mr-1" />Neu laden
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <IconAlertCircle size={22} className="text-destructive" />
      </div>
      <div className="text-center">
        <h3 className="font-semibold text-foreground mb-1">Fehler beim Laden</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          {repairing ? repairStatus : error.message}
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onRetry} disabled={repairing}>Erneut versuchen</Button>
        <Button size="sm" onClick={handleRepair} disabled={repairing}>
          {repairing
            ? <span className="inline-block w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-1" />
            : <IconTool size={14} className="mr-1" />}
          {repairing ? 'Reparatur läuft...' : 'Dashboard reparieren'}
        </Button>
      </div>
      {repairFailed && <p className="text-sm text-destructive">Automatische Reparatur fehlgeschlagen. Bitte kontaktieren Sie den Support.</p>}
    </div>
  );
}
