import { useCallback, useEffect, useRef, useState } from 'react';
import type { Medication } from '../types';
import {
  createMedication,
  deleteMedication,
  listMedications,
  type MedicationCreatePayload,
} from '../services/medicationService';

interface UseMedicationsResult {
  list: Medication[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  optimisticAdd: (payload: MedicationCreatePayload) => Promise<Medication>;
  optimisticDelete: (id: number) => Promise<void>;
}

function extractMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'Failed to load medications';
}

export function useMedications(): UseMedicationsResult {
  const [list, setList] = useState<Medication[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef<boolean>(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const data = await listMedications();
      if (mounted.current) {
        setList(data);
      }
    } catch (err) {
      if (mounted.current) {
        setError(extractMessage(err));
      }
    } finally {
      if (mounted.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const optimisticAdd = useCallback(
    async (payload: MedicationCreatePayload): Promise<Medication> => {
      const created = await createMedication(payload);
      setList((prev) => [created, ...prev]);
      return created;
    },
    []
  );

  const optimisticDelete = useCallback(async (id: number): Promise<void> => {
    const snapshot = list;
    setList((prev) => prev.filter((m) => m.id !== id));
    try {
      await deleteMedication(id);
    } catch (err) {
      setList(snapshot);
      throw err;
    }
  }, [list]);

  return { list, loading, error, refresh, optimisticAdd, optimisticDelete };
}
