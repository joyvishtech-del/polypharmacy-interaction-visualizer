import {
  Badge,
  HStack,
  Text,
  VStack,
  useColorModeValue,
} from '@chakra-ui/react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import type { AnalysisListItem, Severity } from '../../types';

const MotionDiv = motion.div;

interface AnalysisRowProps {
  item: AnalysisListItem;
}

const SEVERITY_COLOR: Record<Severity, string> = {
  red: 'red',
  yellow: 'yellow',
  green: 'green',
};

const SEVERITY_LABEL: Record<Severity, string> = {
  red: 'Severe',
  yellow: 'Moderate',
  green: 'Low',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function excerpt(text: string, max = 140): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

export function AnalysisRow({ item }: AnalysisRowProps): JSX.Element {
  const navigate = useNavigate();
  const bg = useColorModeValue('white', 'gray.800');
  const hoverBg = useColorModeValue('gray.50', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const subtle = useColorModeValue('gray.500', 'gray.400');

  const severity = item.max_severity;

  const handleOpen = (): void => {
    navigate(`/interactions/${item.id}`);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleOpen();
    }
  };

  return (
    <MotionDiv
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.995 }}
      transition={{ duration: 0.15 }}
      role="button"
      tabIndex={0}
      onClick={handleOpen}
      onKeyDown={handleKeyDown}
      aria-label={`Open analysis from ${formatDate(item.created_at)}`}
      style={{ cursor: 'pointer' }}
    >
      <HStack
        bg={bg}
        _hover={{ bg: hoverBg }}
        border="1px solid"
        borderColor={borderColor}
        borderRadius="xl"
        px={5}
        py={4}
        spacing={4}
        align="flex-start"
        justify="space-between"
      >
        <VStack align="flex-start" spacing={1} flex="1" minW={0}>
          <HStack spacing={3} flexWrap="wrap">
            <Text fontWeight="semibold" fontSize="sm" color={subtle}>
              {formatDate(item.created_at)}
            </Text>
            <Badge
              colorScheme={item.status === 'completed' ? 'green' : item.status === 'pending' ? 'yellow' : 'red'}
              textTransform="capitalize"
            >
              {item.status}
            </Badge>
          </HStack>
          <Text fontSize="md" noOfLines={2}>
            {excerpt(item.summary || 'Analysis pending…')}
          </Text>
        </VStack>

        <VStack align="flex-end" spacing={2} flexShrink={0}>
          <Badge colorScheme="purple" variant="subtle">
            {item.medication_count}{' '}
            {item.medication_count === 1 ? 'med' : 'meds'}
          </Badge>
          {severity ? (
            <Badge colorScheme={SEVERITY_COLOR[severity]}>
              {SEVERITY_LABEL[severity]}
            </Badge>
          ) : (
            <Badge colorScheme="gray" variant="outline">
              No interactions
            </Badge>
          )}
        </VStack>
      </HStack>
    </MotionDiv>
  );
}
