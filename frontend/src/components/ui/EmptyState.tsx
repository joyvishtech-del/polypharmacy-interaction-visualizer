import {
  VStack,
  Heading,
  Text,
  Box,
  useColorModeValue,
} from '@chakra-ui/react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
}: EmptyStateProps): JSX.Element {
  const bg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const subtleColor = useColorModeValue('gray.500', 'gray.400');

  return (
    <Box
      bg={bg}
      borderRadius="2xl"
      border="1px dashed"
      borderColor={borderColor}
      px={8}
      py={12}
      textAlign="center"
    >
      <VStack spacing={4}>
        {icon && <Box fontSize="4xl">{icon}</Box>}
        <Heading as="h3" size="md">
          {title}
        </Heading>
        {description && (
          <Text color={subtleColor} maxW="md">
            {description}
          </Text>
        )}
        {action && <Box pt={2}>{action}</Box>}
      </VStack>
    </Box>
  );
}
