/**
 * Typed API wrappers for the Dashboard module.
 * Endpoints are mounted at `/api/v1/dashboard` (the shared axios instance
 * already includes `/api/v1`).
 */
import api from './api';
import type { DashboardSummary } from '../types';

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const { data } = await api.get<DashboardSummary>('/dashboard/summary');
  return data;
}

export const dashboardService = {
  getSummary: getDashboardSummary,
};
