import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Box,
  FormControl,
  FormErrorMessage,
  FormLabel,
  HStack,
  Image,
  Input,
  Stack,
  Text,
  Textarea,
  useColorModeValue,
} from '@chakra-ui/react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { GlassCard } from '../ui/GlassCard';
import { GradientButton } from '../ui/GradientButton';
import type {
  OcrCandidate,
  OcrConfirmPayload,
} from '../../services/medicationService';

const ocrReviewSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  dosage: z.string().trim().min(1, 'Dosage is required'),
  frequency: z.string().trim().min(1, 'Frequency is required'),
  start_date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/u, 'Use format YYYY-MM-DD')
    .optional()
    .or(z.literal('')),
  notes: z.string().trim().max(2000, 'Notes too long').optional().or(z.literal('')),
});

type OcrReviewValues = z.infer<typeof ocrReviewSchema>;

interface OCRReviewFormProps {
  candidate: OcrCandidate;
  onConfirm: (payload: OcrConfirmPayload) => Promise<void> | void;
  submitting?: boolean;
}

export function OCRReviewForm({
  candidate,
  onConfirm,
  submitting = false,
}: OCRReviewFormProps): JSX.Element {
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const codeBg = useColorModeValue('gray.50', 'gray.700');

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<OcrReviewValues>({
    defaultValues: {
      name: candidate.name ?? '',
      dosage: candidate.dosage ?? '',
      frequency: '',
      start_date: '',
      notes: '',
    },
  });

  const submit = handleSubmit(async (raw) => {
    const parsed = ocrReviewSchema.safeParse(raw);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === 'string') {
          setError(field as keyof OcrReviewValues, {
            type: 'validate',
            message: issue.message,
          });
        }
      }
      return;
    }
    const v = parsed.data;
    const payload: OcrConfirmPayload = {
      name: v.name.trim(),
      dosage: v.dosage.trim(),
      frequency: v.frequency.trim(),
      start_date: v.start_date && v.start_date.length > 0 ? v.start_date : null,
      notes: v.notes && v.notes.length > 0 ? v.notes : null,
      raw_text: candidate.raw_text,
      photo_url: candidate.photo_url,
    };
    await onConfirm(payload);
  });

  const busy = submitting || isSubmitting;

  return (
    <GlassCard hoverable={false} as="form" onSubmit={submit} noValidate>
      <Stack spacing={5}>
        <HStack spacing={4} align="flex-start">
          <Image
            src={candidate.photo_url}
            alt="Scanned medication bottle"
            boxSize="120px"
            objectFit="cover"
            borderRadius="lg"
            border="1px solid"
            borderColor={borderColor}
            fallbackSrc=""
          />
          <Box flex={1}>
            <Text fontWeight="semibold">Confirm scanned details</Text>
            <Text fontSize="sm" color="gray.600">
              Review the auto-detected fields and complete any missing information.
            </Text>
          </Box>
        </HStack>

        <FormControl isInvalid={Boolean(errors.name)} isRequired>
          <FormLabel htmlFor="ocr-name">Name</FormLabel>
          <Input id="ocr-name" autoComplete="off" {...register('name')} />
          <FormErrorMessage>{errors.name?.message}</FormErrorMessage>
        </FormControl>

        <FormControl isInvalid={Boolean(errors.dosage)} isRequired>
          <FormLabel htmlFor="ocr-dosage">Dosage</FormLabel>
          <Input id="ocr-dosage" autoComplete="off" {...register('dosage')} />
          <FormErrorMessage>{errors.dosage?.message}</FormErrorMessage>
        </FormControl>

        <FormControl isInvalid={Boolean(errors.frequency)} isRequired>
          <FormLabel htmlFor="ocr-frequency">Frequency</FormLabel>
          <Input
            id="ocr-frequency"
            placeholder="e.g. Once daily"
            autoComplete="off"
            {...register('frequency')}
          />
          <FormErrorMessage>{errors.frequency?.message}</FormErrorMessage>
        </FormControl>

        <FormControl isInvalid={Boolean(errors.start_date)}>
          <FormLabel htmlFor="ocr-start-date">Start date</FormLabel>
          <Input id="ocr-start-date" type="date" {...register('start_date')} />
          <FormErrorMessage>{errors.start_date?.message}</FormErrorMessage>
        </FormControl>

        <FormControl isInvalid={Boolean(errors.notes)}>
          <FormLabel htmlFor="ocr-notes">Notes</FormLabel>
          <Textarea id="ocr-notes" rows={3} {...register('notes')} />
          <FormErrorMessage>{errors.notes?.message}</FormErrorMessage>
        </FormControl>

        <Accordion allowToggle>
          <AccordionItem border="1px solid" borderColor={borderColor} borderRadius="md">
            <h2>
              <AccordionButton>
                <Box as="span" flex="1" textAlign="left" fontSize="sm">
                  OCR raw text
                </Box>
                <AccordionIcon />
              </AccordionButton>
            </h2>
            <AccordionPanel pb={4}>
              <Box
                as="pre"
                bg={codeBg}
                p={3}
                borderRadius="md"
                fontSize="xs"
                whiteSpace="pre-wrap"
                wordBreak="break-word"
                maxH="240px"
                overflowY="auto"
              >
                {candidate.raw_text || '(empty)'}
              </Box>
            </AccordionPanel>
          </AccordionItem>
        </Accordion>

        <Box>
          <GradientButton type="submit" isLoading={busy} loadingText="Saving">
            Confirm and save
          </GradientButton>
        </Box>
      </Stack>
    </GlassCard>
  );
}
