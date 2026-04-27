import { Heading, Stack, Text, useToast } from '@chakra-ui/react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageWrapper } from '../components/layout/PageWrapper';
import { OCRReviewForm } from '../components/medications/OCRReviewForm';
import { PhotoUploader } from '../components/medications/PhotoUploader';
import {
  confirmScannedMedication,
  scanMedicationPhoto,
  type OcrCandidate,
  type OcrConfirmPayload,
} from '../services/medicationService';

function extractMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Something went wrong';
}

export function MedicationScanPage(): JSX.Element {
  const navigate = useNavigate();
  const toast = useToast();
  const [candidate, setCandidate] = useState<OcrCandidate | null>(null);
  const [scanning, setScanning] = useState<boolean>(false);
  const [confirming, setConfirming] = useState<boolean>(false);

  const handleScan = async (file: File): Promise<void> => {
    setScanning(true);
    try {
      const result = await scanMedicationPhoto(file);
      setCandidate(result);
    } catch (err) {
      toast({
        title: 'Scan failed',
        description: extractMessage(err),
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setScanning(false);
    }
  };

  const handleConfirm = async (payload: OcrConfirmPayload): Promise<void> => {
    setConfirming(true);
    try {
      await confirmScannedMedication(payload);
      toast({
        title: 'Medication saved',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      navigate('/medications');
    } catch (err) {
      toast({
        title: 'Save failed',
        description: extractMessage(err),
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setConfirming(false);
    }
  };

  return (
    <PageWrapper>
      <Stack spacing={6} maxW="720px">
        <Stack spacing={2}>
          <Heading as="h1" size="lg">
            Scan medication bottle
          </Heading>
          <Text color="gray.600">
            {candidate
              ? 'Step 2: review and confirm the scanned details.'
              : 'Step 1: upload a clear photo of the medication label.'}
          </Text>
        </Stack>

        {candidate ? (
          <OCRReviewForm
            candidate={candidate}
            onConfirm={handleConfirm}
            submitting={confirming}
          />
        ) : (
          <PhotoUploader onScan={handleScan} scanning={scanning} />
        )}
      </Stack>
    </PageWrapper>
  );
}
