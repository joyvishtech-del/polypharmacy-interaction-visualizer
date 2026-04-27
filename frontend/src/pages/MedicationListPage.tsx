import {
  Alert,
  AlertIcon,
  Button,
  Center,
  HStack,
  Heading,
  SimpleGrid,
  Spinner,
  Stack,
  useToast,
} from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { PageWrapper } from '../components/layout/PageWrapper';
import { EmptyState } from '../components/ui/EmptyState';
import { GradientButton } from '../components/ui/GradientButton';
import { MedicationCard } from '../components/medications/MedicationCard';
import { useMedications } from '../hooks/useMedications';
import type { Medication } from '../types';

export function MedicationListPage(): JSX.Element {
  const navigate = useNavigate();
  const toast = useToast();
  const { list, loading, error, optimisticDelete, refresh } = useMedications();

  const handleEdit = (medication: Medication): void => {
    navigate(`/medications/${medication.id}`);
  };

  const handleDelete = async (medication: Medication): Promise<void> => {
    try {
      await optimisticDelete(medication.id);
      toast({
        title: 'Medication deleted',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch {
      toast({
        title: 'Failed to delete medication',
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    }
  };

  return (
    <PageWrapper>
      <Stack spacing={6}>
        <HStack justify="space-between" align="center" flexWrap="wrap" gap={3}>
          <Heading as="h1" size="lg">
            My Medications
          </Heading>
          <HStack spacing={3}>
            <Button
              variant="outline"
              colorScheme="purple"
              onClick={() => navigate('/medications/scan')}
            >
              Scan Bottle
            </Button>
            <GradientButton onClick={() => navigate('/medications/new')}>
              + Add
            </GradientButton>
          </HStack>
        </HStack>

        {error && (
          <Alert status="error" borderRadius="md">
            <AlertIcon />
            {error}
            <Button ml="auto" size="sm" onClick={() => void refresh()}>
              Retry
            </Button>
          </Alert>
        )}

        {loading ? (
          <Center py={16}>
            <Spinner size="xl" color="purple.500" thickness="3px" />
          </Center>
        ) : list.length === 0 ? (
          <EmptyState
            title="No medications yet"
            description="Add your medications manually or scan a bottle photo to get started."
            action={
              <HStack spacing={3}>
                <Button
                  variant="outline"
                  colorScheme="purple"
                  onClick={() => navigate('/medications/scan')}
                >
                  Scan Bottle
                </Button>
                <GradientButton onClick={() => navigate('/medications/new')}>
                  + Add medication
                </GradientButton>
              </HStack>
            }
          />
        ) : (
          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={4}>
            {list.map((med) => (
              <MedicationCard
                key={med.id}
                medication={med}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </SimpleGrid>
        )}
      </Stack>
    </PageWrapper>
  );
}
