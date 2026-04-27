import { Box, Text, useColorModeValue, Icon, HStack } from '@chakra-ui/react';

function InfoIcon(): JSX.Element {
  return (
    <Icon viewBox="0 0 24 24" boxSize={4} aria-hidden>
      <path
        fill="currentColor"
        d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 5a1.5 1.5 0 1 1-1.5 1.5A1.5 1.5 0 0 1 12 7zm2 11h-4v-1h1v-5h-1v-1h3v6h1z"
      />
    </Icon>
  );
}

export function Disclaimer(): JSX.Element {
  const bg = useColorModeValue('yellow.50', 'yellow.900');
  const color = useColorModeValue('yellow.900', 'yellow.100');
  const border = useColorModeValue('yellow.200', 'yellow.700');

  return (
    <Box
      as="footer"
      bg={bg}
      color={color}
      borderTop="1px solid"
      borderColor={border}
      px={{ base: 4, md: 8 }}
      py={3}
      role="contentinfo"
    >
      <HStack
        maxW="1200px"
        mx="auto"
        spacing={3}
        align="flex-start"
        justify="center"
      >
        <InfoIcon />
        <Text fontSize="sm" textAlign="center">
          <strong>Informational only, not medical advice.</strong> Always
          consult a licensed healthcare professional before changing any
          medication.
        </Text>
      </HStack>
    </Box>
  );
}
