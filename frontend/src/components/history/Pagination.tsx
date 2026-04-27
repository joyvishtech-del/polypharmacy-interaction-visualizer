import { Button, HStack, Text, useColorModeValue } from '@chakra-ui/react';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
  isLoading = false,
}: PaginationProps): JSX.Element {
  const subtle = useColorModeValue('gray.600', 'gray.400');
  const safeTotal = Math.max(totalPages, 1);
  const isFirst = page <= 1;
  const isLast = page >= safeTotal;

  const handlePrev = (): void => {
    if (!isFirst) onPageChange(page - 1);
  };
  const handleNext = (): void => {
    if (!isLast) onPageChange(page + 1);
  };

  return (
    <HStack
      justify="center"
      spacing={6}
      py={4}
      role="navigation"
      aria-label="Pagination"
    >
      <Button
        onClick={handlePrev}
        isDisabled={isFirst || isLoading}
        variant="outline"
        size="sm"
        aria-label="Previous page"
      >
        Prev
      </Button>
      <Text fontSize="sm" color={subtle} aria-live="polite">
        Page {page} of {safeTotal}
      </Text>
      <Button
        onClick={handleNext}
        isDisabled={isLast || isLoading}
        variant="outline"
        size="sm"
        aria-label="Next page"
      >
        Next
      </Button>
    </HStack>
  );
}
