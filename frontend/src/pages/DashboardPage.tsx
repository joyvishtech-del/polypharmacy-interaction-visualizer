import {
  Alert,
  AlertIcon,
  Center,
  Heading,
  SimpleGrid,
  Spinner,
  Text,
  VStack,
} from '@chakra-ui/react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { PageWrapper } from '../components/layout/PageWrapper';
import { StatCard } from '../components/dashboard/StatCard';
import { RecentActivity } from '../components/dashboard/RecentActivity';
import { NewAnalysisCTA } from '../components/dashboard/NewAnalysisCTA';
import { getDashboardSummary } from '../services/dashboardService';
import { useAuth } from '../hooks/useAuth';
import type { DashboardSummary, Severity } from '../types';

const SEVERITY_LABEL: Record<Severity, string> = {
  red: 'Severe',
  yellow: 'Moderate',
  green: 'Low',
};

const SEVERITY_ACCENT: Record<Severity, 'red' | 'yellow' | 'green'> = {
  red: 'red',
  yellow: 'yellow',
  green: 'green',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function DashboardPage(): JSX.Element {
  const { user } = useAuth();

  const { data, isLoading, isError, error } = useQuery<DashboardSummary, Error>({
    queryKey: ['dashboard', 'summary'],
    queryFn: getDashboardSummary,
  });

  const errorMessage = ((): string => {
    if (!isError) return '';
    if (axios.isAxiosError(error)) {
      const detail = (error.response?.data as { detail?: string } | undefined)
        ?.detail;
      return detail ?? error.message;
    }
    return error?.message ?? 'Failed to load dashboard';
  })();

  const greeting = user?.full_name
    ? `Welcome back, ${user.full_name.split(' ')[0]}`
    : 'Welcome back';

  return (
    <PageWrapper>
      <VStack spacing={6} align="stretch" maxW="6xl" mx="auto">
        <VStack spacing={1} align="flex-start">
          <Heading
            as="h1"
            size="xl"
            bgGradient="linear(to-r, brand.500, pink.500)"
            bgClip="text"
          >
            {greeting}
          </Heading>
          <Text color="gray.500">
            Here's a snapshot of your medications and recent activity.
          </Text>
        </VStack>

        {isLoading ? (
          <Center py={20}>
            <Spinner size="xl" color="purple.500" thickness="3px" />
          </Center>
        ) : isError ? (
          <Alert status="error" borderRadius="lg">
            <AlertIcon />
            {errorMessage}
          </Alert>
        ) : data ? (
          <>
            <SimpleGrid columns={{ base: 1, md: 3 }} spacing={5}>
              <StatCard
                label="Medications"
                value={data.medication_count}
                subtext={
                  data.medication_count === 0
                    ? 'No medications yet'
                    : 'In your active list'
                }
                accent="purple"
              />
              <StatCard
                label="Last analysis"
                value={formatDate(data.last_analysis_at)}
                subtext={
                  data.last_analysis_at
                    ? new Date(data.last_analysis_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Run one to get started'
                }
                accent="pink"
              />
              <StatCard
                label="Highest severity"
                value={
                  data.last_analysis_max_severity
                    ? SEVERITY_LABEL[data.last_analysis_max_severity]
                    : '—'
                }
                subtext={
                  data.last_analysis_max_severity
                    ? 'From your most recent analysis'
                    : 'No analyses yet'
                }
                accent={
                  data.last_analysis_max_severity
                    ? SEVERITY_ACCENT[data.last_analysis_max_severity]
                    : 'gray'
                }
              />
            </SimpleGrid>

            <NewAnalysisCTA />

            <RecentActivity events={data.recent_activity} limit={5} />
          </>
        ) : null}
      </VStack>
    </PageWrapper>
  );
}
