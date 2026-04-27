import {
  Checkbox,
  CheckboxGroup,
  Stack,
  Text,
  VStack,
  useColorModeValue,
} from '@chakra-ui/react';
import { useMemo } from 'react';
import type { Medication } from '../../types';

interface MedicationPickerProps {
  medications: Medication[];
  selectedIds: number[];
  onChange: (selectedIds: number[]) => void;
}

export function MedicationPicker({
  medications,
  selectedIds,
  onChange,
}: MedicationPickerProps): JSX.Element {
  const subtle = useColorModeValue('gray.600', 'gray.300');

  const stringValues = useMemo(
    () => selectedIds.map((id) => String(id)),
    [selectedIds]
  );

  const handleChange = (next: (string | number)[]): void => {
    const ids = next.map((v) => Number(v)).filter((n) => Number.isFinite(n));
    onChange(ids);
  };

  if (medications.length === 0) {
    return (
      <Text color={subtle}>
        Add at least two medications before running an analysis.
      </Text>
    );
  }

  return (
    <CheckboxGroup value={stringValues} onChange={handleChange}>
      <VStack align="stretch" spacing={3}>
        {medications.map((med) => (
          <Stack
            key={med.id}
            direction="row"
            align="center"
            justify="space-between"
            borderWidth="1px"
            borderColor="gray.200"
            borderRadius="lg"
            px={4}
            py={3}
            _dark={{ borderColor: 'gray.700' }}
          >
            <Checkbox value={String(med.id)} colorScheme="purple">
              <Text fontWeight="medium">{med.name}</Text>
              <Text fontSize="sm" color={subtle}>
                {med.dosage} - {med.frequency}
              </Text>
            </Checkbox>
          </Stack>
        ))}
      </VStack>
    </CheckboxGroup>
  );
}
