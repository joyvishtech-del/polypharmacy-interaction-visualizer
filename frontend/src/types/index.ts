/**
 * Shared domain types for the Polypharmacy Interaction Visualizer frontend.
 * Mirrors backend Pydantic schemas; keep in sync with backend/app/schemas.
 */

export type Severity = 'red' | 'yellow' | 'green';

export type Source = 'manual' | 'ocr';

export type AnalysisStatus = 'pending' | 'completed' | 'failed';

export type UserRole = 'user' | 'admin';

export interface User {
  id: number;
  email: string;
  full_name: string | null;
  is_active: boolean;
  is_verified: boolean;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Medication {
  id: number;
  user_id: number;
  name: string;
  dosage: string;
  frequency: string;
  start_date: string | null;
  notes: string | null;
  source: Source;
  photo_url: string | null;
  ocr_raw_text: string | null;
  created_at: string;
  updated_at: string;
}

export interface InteractionEdge {
  id: number;
  analysis_id: number;
  drug_a: string;
  drug_b: string;
  severity: Severity;
  explanation: string;
}

export interface Risk {
  id: number;
  analysis_id: number;
  rank: 1 | 2 | 3;
  title: string;
  plain_language_description: string;
}

export interface DoctorQuestion {
  id: number;
  analysis_id: number;
  question: string;
  position: number;
}

export interface Analysis {
  id: number;
  user_id: number;
  summary: string;
  status: AnalysisStatus;
  created_at: string;
  completed_at: string | null;
  medications: Medication[];
  edges: InteractionEdge[];
  risks: Risk[];
  doctor_questions: DoctorQuestion[];
}

/**
 * Server response for /auth/login and /auth/refresh.
 *
 * The refresh token is delivered as an HttpOnly cookie and is intentionally
 * NOT exposed in the JSON body — only the short-lived access token comes
 * back here, kept in memory by the frontend.
 */
export interface AuthTokens {
  access_token: string;
  token_type: 'bearer';
}

export interface ApiError {
  detail: string;
  status_code?: number;
}

/**
 * Lightweight summary row returned by GET /api/v1/history.
 * `max_severity` is null for analyses with no edges yet (pending or empty).
 */
export interface AnalysisListItem {
  id: number;
  status: AnalysisStatus;
  summary: string;
  created_at: string;
  medication_count: number;
  max_severity: Severity | null;
}

export interface AnalysisListResponse {
  items: AnalysisListItem[];
  total: number;
  limit: number;
  offset: number;
}

export type RecentActivityType = 'med_added' | 'analysis_run';

export interface RecentActivityEvent {
  type: RecentActivityType;
  occurred_at: string;
  label: string;
  ref_id: number | null;
}

export interface DashboardSummary {
  medication_count: number;
  last_analysis_at: string | null;
  last_analysis_max_severity: Severity | null;
  recent_activity: RecentActivityEvent[];
}
