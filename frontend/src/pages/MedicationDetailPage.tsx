import {
  Alert,
  AlertIcon,
  Button,
  Center,
  HStack,
  Heading,
  Spinner,
  Stack,
  useToast,
} from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageWrapper } from '../components/layout/PageWrapper';
import {
  MedicationForm,
  type MedicationFormSubmitValues,
} from '../components/medications/MedicationForm';
import {
  deleteMedication,
  getMedication,
  updateMedication,
} from '../services/medicationService';
import type { Medication } from '../types';

function extractMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Operation failed';
}

export function MedicationDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const numericId = id ? Number.parseInt(id, 10) : Number.NaN;

  const [medication, setMedication] = useState<Medication | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    const load = async (): Promise<void> => {
      if (!Number.isFinite(numericId)) {
        setError('Invalid medication id');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const data = await getMedication(numericId);
        if (active) setMedication(data);
      } catch (err) {
        if (active) setError(extractMessage(err));
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [numericId]);

  const handleSubmit = async (values: MedicationFormSubmitValues): Promise<void> => {
    if (!Number.isFinite(numericId)) return;
    setSubmitting(true);
    try {
      const updated = await updateMedication(numericId, {
        name: values.name,
        dosage: values.dosage,
        frequency: values.frequency,
        start_date: values.start_date,
        notes: values.notes,
      });
      setMedication(updated);
      toast({
        title: 'Medication updated',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      navigate('/medications');
    } catch (err) {
      toast({
        title: 'Update failed',
        description: extractMessage(err),
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!Number.isFinite(numericId)) return;
    if (!window.confirm('Delete this medication? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await deleteMedication(numericId);
      toast({
        title: 'Medication deleted',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      navigate('/medications');
    } catch (err) {
      toast({
        title: 'Delete failed',
        description: extractMessage(err),
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <PageWrapper>
      <Stack spacing={6} maxW="640px">
        <HStack justify="space-between" flexWrap="wrap" gap={3}>
          <Heading as="h1" size="lg">
            Edit medication
          </Heading>
          {medication && (
            <Button
              colorScheme="red"
              variant="outline"
              onClick={handleDelete}
              isLoading={deleting}
              loadingText="Deleting"
            >
              Delete
            </Button>
          )}
        </HStack>

        {loading ? (
          <Center py={16}>
            <Spinner size="xl" color="purple.500" thickness="3px" />
          </Center>
        ) : error ? (
          <Alert status="error" borderRadius="md">
            <AlertIcon />
            {error}
          </Alert>
        ) : medication ? (
          <MedicationForm
            mode="edit"
            defaultValues={{
              name: medication.name,
              dosage: medication.dosage,
              frequency: medication.frequency,
              start_date: medication.start_date ?? '',
              notes: medication.notes ?? '',
            }}
            onSubmit={handleSubmit}
            submitting={submitting}
          />
        ) : null}
      </Stack>
    </PageWrapper>
  );
}
