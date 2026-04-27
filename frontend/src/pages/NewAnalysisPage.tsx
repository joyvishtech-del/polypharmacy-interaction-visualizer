import {
  Center,
  Heading,
  HStack,
  Spinner,
  Text,
  useToast,
  VStack,
} from '@chakra-ui/react';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageWrapper } from '../components/layout/PageWrapper';
import { GlassCard } from '../components/ui/GlassCard';
import { GradientButton } from '../components/ui/GradientButton';
import { EmptyState } from '../components/ui/EmptyState';
import { MedicationPicker } from '../components/interactions/MedicationPicker';
import { listMedications } from '../services/medicationService';
import { analyzeInteractions } from '../services/interactionService';
import type { Medication } from '../types';

export function NewAnalysisPage(): JSX.Element {
  const navigate = useNavigate();
  const toast = useToast();
  const [medications, setMedications] = useState<Medication[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loadingMeds, setLoadingMeds] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    const load = async (): Promise<void> => {
      try {
        const meds = await listMedications({ limit: 200 });
        if (!cancelled) {
          setMedications(meds);
        }
      } catch (err: unknown) {
        if (cancelled) return;
        const message = axios.isAxiosError(err)
          ? (err.response?.data as { detail?: string } | undefined)?.detail ??
            'Failed to load medications'
          : 'Unexpected error';
        toast({
          title: 'Could not load medications',
          description: message,
          status: 'error',
          duration: 4000,
          isClosable: true,
        });
      } finally {
        if (!cancelled) setLoadingMeds(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  const canSubmit = selectedIds.length >= 2 && !submitting;

  const handleRun = async (): Promise<void> => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const analysis = await analyzeInteractions({ medication_ids: selectedIds });
      navigate(`/interactions/${analysis.id}`);
    } catch (err: unknown) {
      const message = axios.isAxiosError(err)
        ? (err.response?.data as { detail?: string } | undefined)?.detail ??
          'Failed to start analysis'
        : 'Unexpected error';
      toast({
        title: 'Analysis failed',
        description: message,
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageWrapper>
      <VStack spacing={6} align="stretch" maxW="3xl" mx="auto">
        <Heading
          as="h1"
          size="xl"
          bgGradient="linear(to-r, brand.500, pink.500)"
          bgClip="text"
        >
          New interaction analysis
        </Heading>
        <Text color="gray.600">
          Select two or more medications to analyze for potential interactions.
        </Text>

        <GlassCard hoverable={false}>
          {loadingMeds ? (
            <Center py={12}>
              <Spinner size="lg" color="purple.500" thickness="3px" />
            </Center>
          ) : medications.length < 2 ? (
            <EmptyState
              title="Not enough medications"
              description="You need at least two saved medications before you can run an interaction analysis."
              action={
                <GradientButton onClick={() => navigate('/medications')}>
                  Manage medications
                </GradientButton>
              }
            />
          ) : (
            <VStack align="stretch" spacing={5}>
              <MedicationPicker
                medications={medications}
                selectedIds={selectedIds}
                onChange={setSelectedIds}
              />
              <HStack justify="space-between">
                <Text fontSize="sm" color="gray.500">
                  {selectedIds.length} selected (minimum 2)
                </Text>
                <GradientButton
                  onClick={handleRun}
                  isDisabled={!canSubmit}
                  isLoading={submitting}
                  loadingText="Analyzing"
                >
                  Run Analysis
                </GradientButton>
              </HStack>
            </VStack>
          )}
        </GlassCard>
      </VStack>
    </PageWrapper>
  );
}
