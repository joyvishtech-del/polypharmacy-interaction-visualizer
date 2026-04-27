import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Badge,
  Button,
  HStack,
  Heading,
  IconButton,
  Stack,
  Text,
  useDisclosure,
} from '@chakra-ui/react';
import { useRef, useState } from 'react';
import type { Medication } from '../../types';
import { GlassCard } from '../ui/GlassCard';

interface MedicationCardProps {
  medication: Medication;
  onEdit: (medication: Medication) => void;
  onDelete: (medication: Medication) => Promise<void> | void;
}

function EditIcon(): JSX.Element {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function TrashIcon(): JSX.Element {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

export function MedicationCard({
  medication,
  onEdit,
  onDelete,
}: MedicationCardProps): JSX.Element {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  const sourceColor = medication.source === 'ocr' ? 'purple' : 'green';
  const sourceLabel = medication.source === 'ocr' ? 'OCR' : 'Manual';

  const confirmDelete = async (): Promise<void> => {
    setDeleting(true);
    try {
      await onDelete(medication);
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <GlassCard hoverable>
        <Stack spacing={3}>
          <HStack justify="space-between" align="flex-start">
            <Stack spacing={1}>
              <Heading as="h3" size="md">
                {medication.name}
              </Heading>
              <Text color="gray.600" fontSize="sm">
                {medication.dosage} &middot; {medication.frequency}
              </Text>
            </Stack>
            <Badge colorScheme={sourceColor} variant="subtle" rounded="full" px={3} py={1}>
              {sourceLabel}
            </Badge>
          </HStack>

          {medication.notes && (
            <Text fontSize="sm" color="gray.700" noOfLines={2}>
              {medication.notes}
            </Text>
          )}

          <HStack justify="flex-end" spacing={2}>
            <IconButton
              aria-label={`Edit ${medication.name}`}
              icon={<EditIcon />}
              size="sm"
              variant="ghost"
              onClick={() => onEdit(medication)}
            />
            <IconButton
              aria-label={`Delete ${medication.name}`}
              icon={<TrashIcon />}
              size="sm"
              variant="ghost"
              colorScheme="red"
              onClick={onOpen}
            />
          </HStack>
        </Stack>
      </GlassCard>

      <AlertDialog
        isOpen={isOpen}
        leastDestructiveRef={cancelRef}
        onClose={onClose}
        isCentered
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete medication
            </AlertDialogHeader>
            <AlertDialogBody>
              Are you sure you want to delete{' '}
              <Text as="span" fontWeight="semibold">
                {medication.name}
              </Text>
              ? This cannot be undone.
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onClose} isDisabled={deleting}>
                Cancel
              </Button>
              <Button
                colorScheme="red"
                onClick={confirmDelete}
                ml={3}
                isLoading={deleting}
                loadingText="Deleting"
              >
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </>
  );
}
