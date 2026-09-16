'use client';

import { useState } from 'react';
import { Save, SlidersHorizontal } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { Button, Card, Field, SkeletonRows } from '@/components/ui';
import { PageIn } from '@/components/motion';
import { useToast } from '@/components/toast';

const CATEGORY_LABELS: Record<string, string> = {
  FRAUDE: 'Détection de fraude',
  LIMITES: 'Limites de transaction',
  NOTIFICATIONS: 'Notifications',
  GENERAL: 'Général',
};

export default function AdminConfig() {
  const { data, loading, reload } = useApi(() => api.get('/admin/config'));
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const { push } = useToast();

  const save = async () => {
    setSaving(true);
    try {
      await api.post('/admin/config', { values });
      push('Configuration mise à jour. Le moteur de fraude utilise les nouveaux seuils.', 'success');
      setValues({});
      reload();
    } catch (e: any) {
      push(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const categories = [...new Set((data || []).map((c: any) => c.category))];

  return (
    <PageIn className="space-y-6">
      <div className="flex items-center justify-between rounded-2xl border border-violet-100 bg-violet-50/60 p-4">
        <div className="flex items-center gap-3">
          <SlidersHorizontal className="h-5 w-5 text-violet-600" />
          <p className="text-sm font-bold text-violet-700">
            Ces paramètres affectent l'ensemble du système : seuils de risque, limites globales, notifications.
          </p>
        </div>
        <Button onClick={save} loading={saving} disabled={!Object.keys(values).length}>
          <Save className="h-4 w-4" /> Enregistrer
        </Button>
      </div>

      {loading && !data ? (
        <Card><SkeletonRows n={6} /></Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {categories.map((cat: any) => (
            <Card key={cat} className="p-6">
              <p className="text-sm font-black text-navy-900">{CATEGORY_LABELS[cat] || cat}</p>
              <div className="mt-5 space-y-5">
                {data
                  .filter((c: any) => c.category === cat)
                  .map((c: any) => (
                    <Field key={c.key} label={c.key.replace(/_/g, ' ')} hint={c.description}>
                      <input
                        type="number"
                        className="input font-black"
                        defaultValue={c.value}
                        onBlur={(e) => {
                          if (e.target.value !== c.value) setValues((v) => ({ ...v, [c.key]: e.target.value }));
                        }}
                      />
                    </Field>
                  ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageIn>
  );
}
