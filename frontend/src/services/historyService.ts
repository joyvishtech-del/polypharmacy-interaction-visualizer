/**
 * Typed API wrappers for the History module.
 * Endpoints are mounted at `/api/v1/history` (the shared axios instance
 * already includes `/api/v1`).
 */
import api from './api';
import type {
  Analysis,
  AnalysisListItem,
  AnalysisListResponse,
} from '../types';

export interface ListHistoryParams {
  limit?: number;
  offset?: number;
}

export async function listHistory(
  params: ListHistoryParams = {}
): Promise<AnalysisListResponse> {
  const { data } = await api.get<AnalysisListResponse>('/history', { params });
  return data;
}

export async function getHistoryItem(id: number): Promise<Analysis> {
  const { data } = await api.get<Analysis>(`/history/${id}`);
  return data;
}

export const historyService = {
  list: listHistory,
  get: getHistoryItem,
};

export type { AnalysisListItem };
