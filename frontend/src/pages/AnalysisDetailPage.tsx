import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Badge,
  Button,
  Center,
  Heading,
  HStack,
  Spinner,
  Text,
  Tooltip,
  useDisclosure,
  useToast,
  VStack,
} from '@chakra-ui/react';
import axios from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageWrapper } from '../components/layout/PageWrapper';
import { GlassCard } from '../components/ui/GlassCard';
import { Disclaimer } from '../components/ui/Disclaimer';
import { EmptyState } from '../components/ui/EmptyState';
import { InteractionGraph } from '../components/interactions/InteractionGraph';
import { RiskList } from '../components/interactions/RiskList';
import { DoctorQuestionList } from '../components/interactions/DoctorQuestionList';
import {
  deleteAnalysis,
  getAnalysis,
  type AnalysisResponse,
} from '../services/interactionService';
import type { AnalysisStatus } from '../types';

const STATUS_COLOR: Record<AnalysisStatus, string> = {
  pending: 'yellow',
  completed: 'green',
  failed: 'red',
};

export function AnalysisDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const analysisId = Number(id);

  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();

  const fetchAnalysis = useCallback(async (): Promise<AnalysisResponse | null> => {
    if (!Number.isFinite(analysisId)) {
      setErrorMessage('Invalid analysis id');
      setLoading(false);
      return null;
    }
    try {
      const data = await getAnalysis(analysisId);
      setAnalysis(data);
      setErrorMessage(null);
      return data;
    } catch (err: unknown) {
      const message = axios.isAxiosError(err)
        ? (err.response?.data as { detail?: string } | undefined)?.detail ??
          'Failed to load analysis'
        : 'Unexpected error';
      setErrorMessage(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [analysisId]);

  useEffect(() => {
    void fetchAnalysis();
  }, [fetchAnalysis]);

  // Poll while pending
  useEffect(() => {
    if (!analysis || analysis.status !== 'pending') return;
    const interval = window.setInterval(() => {
      void fetchAnalysis();
    }, 2000);
    return () => window.clearInterval(interval);
  }, [analysis, fetchAnalysis]);

  const handleDelete = async (): Promise<void> => {
    if (!analysis) return;
    setDeleting(true);
    try {
      await deleteAnalysis(analysis.id);
      toast({
        title: 'Analysis deleted',
        status: 'success',
        duration: 2500,
        isClosable: true,
      });
      navigate('/interactions');
    } catch (err: unknown) {
      const message = axios.isAxiosError(err)
        ? (err.response?.data as { detail?: string } | undefined)?.detail ??
          'Delete failed'
        : 'Unexpected error';
      toast({
        title: 'Delete failed',
        description: message,
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setDeleting(false);
      onClose();
    }
  };

  if (loading && !analysis) {
    return (
      <PageWrapper>
        <Center minH="40vh">
          <Spinner size="xl" color="purple.500" thickness="3px" />
        </Center>
      </PageWrapper>
    );
  }

  if (errorMessage && !analysis) {
    return (
      <PageWrapper>
        <EmptyState
          title="Could not load analysis"
          description={errorMessage}
          action={
            <Button onClick={() => navigate('/interactions')}>
              Back to analyses
            </Button>
          }
        />
      </PageWrapper>
    );
  }

  if (!analysis) {
    return (
      <PageWrapper>
        <EmptyState title="Analysis not found" />
      </PageWrapper>
    );
  }

  const statusColor = STATUS_COLOR[analysis.status];

  return (
    <PageWrapper hideDisclaimer>
      <VStack spacing={6} align="stretch" maxW="6xl" mx="auto">
        <HStack justify="space-between" wrap="wrap" gap={3}>
          <Heading
            as="h1"
            size="xl"
            bgGradient="linear(to-r, brand.500, pink.500)"
            bgClip="text"
          >
            Interaction analysis #{analysis.id}
          </Heading>
          <HStack>
            <Tooltip label="Export is coming post-MVP" hasArrow>
              <Button isDisabled variant="outline">
                Export
              </Button>
            </Tooltip>
            <Button
              colorScheme="red"
              variant="ghost"
              onClick={onOpen}
              isDisabled={deleting}
            >
              Delete
            </Button>
          </HStack>
        </HStack>

        <GlassCard hoverable={false}>
          <VStack align="stretch" spacing={3}>
            <HStack>
              <Badge
                colorScheme={statusColor}
                textTransform="capitalize"
                px={3}
                py={1}
                borderRadius="full"
              >
                {analysis.status}
              </Badge>
              <Text fontSize="sm" color="gray.500">
                Created {new Date(analysis.created_at).toLocaleString()}
              </Text>
              {analysis.completed_at && (
                <Text fontSize="sm" color="gray.500">
                  - Completed {new Date(analysis.completed_at).toLocaleString()}
                </Text>
              )}
            </HStack>
            <Text>{analysis.summary || 'Awaiting summary...'}</Text>
          </VStack>
        </GlassCard>

        <Disclaimer />

        {analysis.status === 'pending' && (
          <GlassCard hoverable={false}>
            <Center py={8}>
              <VStack spacing={3}>
                <Spinner size="lg" color="purple.500" thickness="3px" />
                <Text color="gray.600">
                  Analysis in progress. This page will update automatically.
                </Text>
              </VStack>
            </Center>
          </GlassCard>
        )}

        {analysis.status === 'failed' && (
          <EmptyState
            title="Analysis failed"
            description={
              analysis.summary ||
              'Something went wrong while analyzing these medications. Try again.'
            }
            action={
              <Button onClick={() => navigate('/interactions/new')}>
                Start a new analysis
              </Button>
            }
          />
        )}

        {analysis.status === 'completed' && (
          <>
            <GlassCard hoverable={false} p={0} overflow="hidden">
              <InteractionGraph
                medications={analysis.medications}
                edges={analysis.edges}
              />
            </GlassCard>
            <RiskList risks={analysis.risks} />
            <DoctorQuestionList questions={analysis.doctor_questions} />
          </>
        )}
      </VStack>

      <AlertDialog
        isOpen={isOpen}
        leastDestructiveRef={cancelRef}
        onClose={onClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete analysis
            </AlertDialogHeader>
            <AlertDialogBody>
              Are you sure? This action cannot be undone.
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onClose}>
                Cancel
              </Button>
              <Button
                colorScheme="red"
                onClick={() => {
                  void handleDelete();
                }}
                isLoading={deleting}
                ml={3}
              >
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </PageWrapper>
  );
}
