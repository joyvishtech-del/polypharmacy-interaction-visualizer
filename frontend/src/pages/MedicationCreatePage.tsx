import { Heading, Stack, useToast } from '@chakra-ui/react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageWrapper } from '../components/layout/PageWrapper';
import {
  MedicationForm,
  type MedicationFormSubmitValues,
} from '../components/medications/MedicationForm';
import { createMedication } from '../services/medicationService';

function extractMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Failed to create medication';
}

export function MedicationCreatePage(): JSX.Element {
  const navigate = useNavigate();
  const toast = useToast();
  const [submitting, setSubmitting] = useState<boolean>(false);

  const handleSubmit = async (values: MedicationFormSubmitValues): Promise<void> => {
    setSubmitting(true);
    try {
      await createMedication({
        name: values.name,
        dosage: values.dosage,
        frequency: values.frequency,
        start_date: values.start_date,
        notes: values.notes,
      });
      toast({
        title: 'Medication added',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      navigate('/medications');
    } catch (err) {
      toast({
        title: extractMessage(err),
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
      <Stack spacing={6} maxW="640px">
        <Heading as="h1" size="lg">
          Add medication
        </Heading>
        <MedicationForm
          mode="create"
          onSubmit={handleSubmit}
          submitting={submitting}
        />
      </Stack>
    </PageWrapper>
  );
}
