import {
  Alert,
  AlertIcon,
  Center,
  Heading,
  Spinner,
  Text,
  VStack,
} from '@chakra-ui/react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { PageWrapper } from '../components/layout/PageWrapper';
import { AnalysisRow } from '../components/history/AnalysisRow';
import { Pagination } from '../components/history/Pagination';
import { EmptyState } from '../components/ui/EmptyState';
import { GradientButton } from '../components/ui/GradientButton';
import { listHistory } from '../services/historyService';
import type { AnalysisListResponse } from '../types';

const PAGE_SIZE = 20;

export function HistoryListPage(): JSX.Element {
  const navigate = useNavigate();
  const [page, setPage] = useState<number>(1);
  const offset = (page - 1) * PAGE_SIZE;

  const { data, isLoading, isError, error, isFetching } = useQuery<
    AnalysisListResponse,
    Error
  >({
    queryKey: ['history', page],
    queryFn: () => listHistory({ limit: PAGE_SIZE, offset }),
    placeholderData: (prev) => prev,
  });

  const totalPages = data ? Math.max(Math.ceil(data.total / PAGE_SIZE), 1) : 1;
  const items = data?.items ?? [];

  const errorMessage = ((): string => {
    if (!isError) return '';
    if (axios.isAxiosError(error)) {
      const detail = (error.response?.data as { detail?: string } | undefined)
        ?.detail;
      return detail ?? error.message;
    }
    return error?.message ?? 'Failed to load history';
  })();

  return (
    <PageWrapper>
      <VStack spacing={6} align="stretch" maxW="4xl" mx="auto">
        <VStack spacing={2} align="flex-start">
          <Heading
            as="h1"
            size="xl"
            bgGradient="linear(to-r, brand.500, pink.500)"
            bgClip="text"
          >
            Analysis history
          </Heading>
          <Text color="gray.500">
            Review past interaction analyses you've run.
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
        ) : items.length === 0 ? (
          <EmptyState
            title="No analyses yet"
            description="Run your first interaction check to see it appear here."
            action={
              <GradientButton onClick={() => navigate('/interactions/new')}>
                New analysis
              </GradientButton>
            }
          />
        ) : (
          <>
            <VStack spacing={3} align="stretch">
              {items.map((item) => (
                <AnalysisRow key={item.id} item={item} />
              ))}
            </VStack>
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              isLoading={isFetching}
            />
          </>
        )}
      </VStack>
    </PageWrapper>
  );
}
