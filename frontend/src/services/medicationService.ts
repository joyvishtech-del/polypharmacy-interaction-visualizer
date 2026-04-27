/**
 * Typed API wrappers for the Medications module.
 * Endpoints are mounted at `/api/v1/medications/...` (the base
 * `api` instance already includes `/api/v1`).
 */
import api from './api';
import type { Medication } from '../types';

export interface MedicationCreatePayload {
  name: string;
  dosage: string;
  frequency: string;
  start_date?: string | null;
  notes?: string | null;
}

export type MedicationUpdatePayload = Partial<MedicationCreatePayload>;

export interface OcrCandidate {
  name: string | null;
  dosage: string | null;
  raw_text: string;
  photo_url: string;
}

export interface OcrConfirmPayload {
  name: string;
  dosage: string;
  frequency: string;
  start_date?: string | null;
  notes?: string | null;
  raw_text: string;
  photo_url: string;
}

export interface ListMedicationsParams {
  limit?: number;
  offset?: number;
}

export async function listMedications(
  params: ListMedicationsParams = {}
): Promise<Medication[]> {
  const { data } = await api.get<Medication[]>('/medications', { params });
  return data;
}

export async function getMedication(id: number): Promise<Medication> {
  const { data } = await api.get<Medication>(`/medications/${id}`);
  return data;
}

export async function createMedication(
  payload: MedicationCreatePayload
): Promise<Medication> {
  const { data } = await api.post<Medication>('/medications', payload);
  return data;
}

export async function updateMedication(
  id: number,
  payload: MedicationUpdatePayload
): Promise<Medication> {
  const { data } = await api.put<Medication>(`/medications/${id}`, payload);
  return data;
}

export async function deleteMedication(id: number): Promise<void> {
  await api.delete(`/medications/${id}`);
}

export async function scanMedicationPhoto(file: File): Promise<OcrCandidate> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post<OcrCandidate>('/medications/scan', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function confirmScannedMedication(
  payload: OcrConfirmPayload
): Promise<Medication> {
  const { data } = await api.post<Medication>(
    '/medications/scan/confirm',
    payload
  );
  return data;
}
