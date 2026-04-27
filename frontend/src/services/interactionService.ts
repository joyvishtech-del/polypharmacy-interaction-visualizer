/**
 * Typed API wrappers for the Interactions module.
 * Endpoints are mounted at `/api/v1/interactions/...` (the base
 * `api` instance already includes `/api/v1`).
 */
import api from './api';
import type { Analysis } from '../types';

export type AnalysisResponse = Analysis;

export interface AnalyzeInteractionsPayload {
  medication_ids: number[];
}

export async function analyzeInteractions(
  payload: AnalyzeInteractionsPayload
): Promise<AnalysisResponse> {
  const { data } = await api.post<AnalysisResponse>(
    '/interactions/analyze',
    payload
  );
  return data;
}

export async function getAnalysis(id: number): Promise<AnalysisResponse> {
  const { data } = await api.get<AnalysisResponse>(`/interactions/${id}`);
  return data;
}

export async function deleteAnalysis(id: number): Promise<void> {
  await api.delete(`/interactions/${id}`);
}
