import {
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Box,
  useColorModeValue,
} from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { GlassCard } from '../ui/GlassCard';

interface StatCardProps {
  label: string;
  value: ReactNode;
  subtext?: ReactNode;
  accent?: 'purple' | 'pink' | 'green' | 'yellow' | 'red' | 'gray';
}

const ACCENT_GRADIENT: Record<
  NonNullable<StatCardProps['accent']>,
  string
> = {
  purple: 'linear(to-r, purple.500, pink.500)',
  pink: 'linear(to-r, pink.400, red.400)',
  green: 'linear(to-r, green.400, teal.500)',
  yellow: 'linear(to-r, yellow.400, orange.400)',
  red: 'linear(to-r, red.500, pink.500)',
  gray: 'linear(to-r, gray.500, gray.700)',
};

export function StatCard({
  label,
  value,
  subtext,
  accent = 'purple',
}: StatCardProps): JSX.Element {
  const labelColor = useColorModeValue('gray.600', 'gray.300');
  const subColor = useColorModeValue('gray.500', 'gray.400');

  return (
    <GlassCard hoverable>
      <Stat>
        <StatLabel color={labelColor} fontSize="sm" fontWeight="medium">
          {label}
        </StatLabel>
        <Box mt={2}>
          <StatNumber
            fontSize="3xl"
            fontWeight="bold"
            bgGradient={ACCENT_GRADIENT[accent]}
            bgClip="text"
            lineHeight="shorter"
          >
            {value}
          </StatNumber>
        </Box>
        {subtext && (
          <StatHelpText color={subColor} mt={1} mb={0}>
            {subtext}
          </StatHelpText>
        )}
      </Stat>
    </GlassCard>
  );
}
