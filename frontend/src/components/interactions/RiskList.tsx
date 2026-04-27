import {
  Badge,
  Heading,
  Text,
  VStack,
  HStack,
  useColorModeValue,
} from '@chakra-ui/react';
import { GlassCard } from '../ui/GlassCard';
import type { Risk } from '../../types';

interface RiskListProps {
  risks: Risk[];
}

/**
 * Risks are RANKED 1-3 by the AI -- rank does NOT imply clinical severity.
 * (Severity lives on the graph edges, color-coded red/yellow/green.) To avoid
 * implying a false link, we use a single brand accent here and let the rank
 * number do the priority signaling.
 */
const RANK_LABEL: Record<1 | 2 | 3, string> = {
  1: 'Top concern',
  2: 'Second concern',
  3: 'Third concern',
};

export function RiskList({ risks }: RiskListProps): JSX.Element {
  const subtle = useColorModeValue('gray.600', 'gray.300');
  const accent = useColorModeValue('purple.500', 'purple.300');
  const accentBg = useColorModeValue('purple.50', 'whiteAlpha.100');
  const accentBorder = useColorModeValue('purple.200', 'purple.700');
  const sorted = [...risks].sort((a, b) => a.rank - b.rank).slice(0, 3);

  return (
    <VStack spacing={4} align="stretch">
      <HStack justify="space-between" align="baseline">
        <Heading as="h2" size="md">
          Top risks
        </Heading>
        <Text fontSize="xs" color={subtle}>
          Ranked by the AI; severity is shown in the graph above.
        </Text>
      </HStack>
      {sorted.map((risk) => {
        const label = RANK_LABEL[risk.rank as 1 | 2 | 3] ?? `Risk #${risk.rank}`;
        return (
          <GlassCard
            key={risk.id}
            hoverable={false}
            borderLeft="4px solid"
            borderLeftColor={accentBorder}
          >
            <VStack align="stretch" spacing={2}>
              <HStack justify="space-between">
                <HStack spacing={3}>
                  <Badge
                    bg={accentBg}
                    color={accent}
                    fontSize="md"
                    px={3}
                    py={1}
                    borderRadius="full"
                    fontWeight="bold"
                  >
                    #{risk.rank}
                  </Badge>
                  <Heading as="h3" size="sm">
                    {risk.title}
                  </Heading>
                </HStack>
                <Text fontSize="xs" color={subtle} fontWeight="semibold">
                  {label}
                </Text>
              </HStack>
              <Text color={subtle}>{risk.plain_language_description}</Text>
            </VStack>
          </GlassCard>
        );
      })}
    </VStack>
  );
}
