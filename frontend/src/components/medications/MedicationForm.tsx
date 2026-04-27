import {
  Box,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
  Stack,
  Textarea,
} from '@chakra-ui/react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { GlassCard } from '../ui/GlassCard';
import { GradientButton } from '../ui/GradientButton';

const medicationSchema = z.object({
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

export type MedicationFormValues = z.infer<typeof medicationSchema>;

export interface MedicationFormSubmitValues {
  name: string;
  dosage: string;
  frequency: string;
  start_date: string | null;
  notes: string | null;
}

interface MedicationFormProps {
  mode: 'create' | 'edit';
  defaultValues?: Partial<MedicationFormValues>;
  onSubmit: (values: MedicationFormSubmitValues) => Promise<void> | void;
  submitting?: boolean;
}

function normalize(values: MedicationFormValues): MedicationFormSubmitValues {
  return {
    name: values.name.trim(),
    dosage: values.dosage.trim(),
    frequency: values.frequency.trim(),
    start_date: values.start_date && values.start_date.length > 0 ? values.start_date : null,
    notes: values.notes && values.notes.length > 0 ? values.notes : null,
  };
}

export function MedicationForm({
  mode,
  defaultValues,
  onSubmit,
  submitting = false,
}: MedicationFormProps): JSX.Element {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<MedicationFormValues>({
    defaultValues: {
      name: defaultValues?.name ?? '',
      dosage: defaultValues?.dosage ?? '',
      frequency: defaultValues?.frequency ?? '',
      start_date: defaultValues?.start_date ?? '',
      notes: defaultValues?.notes ?? '',
    },
  });

  const submit = handleSubmit(async (raw) => {
    const parsed = medicationSchema.safeParse(raw);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === 'string') {
          setError(field as keyof MedicationFormValues, {
            type: 'validate',
            message: issue.message,
          });
        }
      }
      return;
    }
    await onSubmit(normalize(parsed.data));
  });

  const busy = submitting || isSubmitting;

  return (
    <GlassCard hoverable={false} as="form" onSubmit={submit} noValidate>
      <Stack spacing={4}>
        <FormControl isInvalid={Boolean(errors.name)} isRequired>
          <FormLabel htmlFor="med-name">Name</FormLabel>
          <Input
            id="med-name"
            placeholder="e.g. Lisinopril"
            autoComplete="off"
            {...register('name')}
          />
          <FormErrorMessage>{errors.name?.message}</FormErrorMessage>
        </FormControl>

        <FormControl isInvalid={Boolean(errors.dosage)} isRequired>
          <FormLabel htmlFor="med-dosage">Dosage</FormLabel>
          <Input
            id="med-dosage"
            placeholder="e.g. 10 mg"
            autoComplete="off"
            {...register('dosage')}
          />
          <FormErrorMessage>{errors.dosage?.message}</FormErrorMessage>
        </FormControl>

        <FormControl isInvalid={Boolean(errors.frequency)} isRequired>
          <FormLabel htmlFor="med-frequency">Frequency</FormLabel>
          <Input
            id="med-frequency"
            placeholder="e.g. Once daily"
            autoComplete="off"
            {...register('frequency')}
          />
          <FormErrorMessage>{errors.frequency?.message}</FormErrorMessage>
        </FormControl>

        <FormControl isInvalid={Boolean(errors.start_date)}>
          <FormLabel htmlFor="med-start-date">Start date</FormLabel>
          <Input
            id="med-start-date"
            type="date"
            {...register('start_date')}
          />
          <FormErrorMessage>{errors.start_date?.message}</FormErrorMessage>
        </FormControl>

        <FormControl isInvalid={Boolean(errors.notes)}>
          <FormLabel htmlFor="med-notes">Notes</FormLabel>
          <Textarea
            id="med-notes"
            rows={3}
            placeholder="Optional notes (e.g. take with food)"
            {...register('notes')}
          />
          <FormErrorMessage>{errors.notes?.message}</FormErrorMessage>
        </FormControl>

        <Box pt={2}>
          <GradientButton type="submit" isLoading={busy} loadingText="Saving">
            {mode === 'create' ? 'Add medication' : 'Save changes'}
          </GradientButton>
        </Box>
      </Stack>
    </GlassCard>
  );
}
