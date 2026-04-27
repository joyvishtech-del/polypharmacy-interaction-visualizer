import { HStack, Icon, Text, VStack } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '../ui/GlassCard';
import { GradientButton } from '../ui/GradientButton';

interface NewAnalysisCTAProps {
  to?: string;
}

export function NewAnalysisCTA({
  to = '/interactions/new',
}: NewAnalysisCTAProps): JSX.Element {
  const navigate = useNavigate();

  return (
    <GlassCard hoverable={false}>
      <HStack justify="space-between" spacing={6} flexWrap="wrap">
        <VStack align="flex-start" spacing={1} flex="1" minW="220px">
          <Text fontSize="lg" fontWeight="semibold">
            Ready to check your medications?
          </Text>
          <Text fontSize="sm" color="gray.500">
            Run a fresh interaction analysis on your current medication list.
          </Text>
        </VStack>
        <GradientButton
          onClick={() => navigate(to)}
          aria-label="Start a new interaction analysis"
          leftIcon={
            <Icon viewBox="0 0 24 24" boxSize={4} aria-hidden>
              <path
                fill="currentColor"
                d="M12 4a1 1 0 0 1 1 1v6h6a1 1 0 1 1 0 2h-6v6a1 1 0 1 1-2 0v-6H5a1 1 0 1 1 0-2h6V5a1 1 0 0 1 1-1z"
              />
            </Icon>
          }
        >
          New analysis
        </GradientButton>
      </HStack>
    </GlassCard>
  );
}
