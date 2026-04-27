import { Box, HStack, Text, VStack, useColorModeValue } from '@chakra-ui/react';
import type { Severity } from '../../types';

interface LegendRowProps {
  color: string;
  label: string;
  meaning: string;
}

function LegendRow({ color, label, meaning }: LegendRowProps): JSX.Element {
  const subtle = useColorModeValue('gray.600', 'gray.300');
  return (
    <HStack spacing={3} align="flex-start">
      <Box
        flexShrink={0}
        w="28px"
        h="4px"
        bg={color}
        borderRadius="full"
        mt="9px"
      />
      <Box>
        <Text fontWeight="semibold" fontSize="sm">
          {label}
        </Text>
        <Text fontSize="xs" color={subtle}>
          {meaning}
        </Text>
      </Box>
    </HStack>
  );
}

const ROWS: { severity: Severity; row: LegendRowProps }[] = [
  {
    severity: 'red',
    row: {
      color: '#E53E3E',
      label: 'Severe',
      meaning: 'Clinically significant — discuss before next dose.',
    },
  },
  {
    severity: 'yellow',
    row: {
      color: '#D69E2E',
      label: 'Moderate',
      meaning: 'Worth a conversation; may need monitoring or adjustment.',
    },
  },
  {
    severity: 'green',
    row: {
      color: '#38A169',
      label: 'Low',
      meaning: 'Known interaction, typically benign at usual doses.',
    },
  },
];

export function SeverityLegend(): JSX.Element {
  const bg = useColorModeValue('whiteAlpha.900', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  return (
    <Box
      bg={bg}
      borderRadius="lg"
      border="1px solid"
      borderColor={borderColor}
      p={4}
      backdropFilter="blur(6px)"
    >
      <Text
        fontSize="xs"
        fontWeight="bold"
        textTransform="uppercase"
        letterSpacing="wide"
        mb={3}
        color={useColorModeValue('gray.500', 'gray.400')}
      >
        Edge color = severity
      </Text>
      <VStack spacing={3} align="stretch">
        {ROWS.map(({ severity, row }) => (
          <LegendRow key={severity} {...row} />
        ))}
      </VStack>
    </Box>
  );
}
