import { VStack, Heading, Text, HStack } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import { PageWrapper } from '../components/layout/PageWrapper';
import { GlassCard } from '../components/ui/GlassCard';
import { GradientButton } from '../components/ui/GradientButton';

export function HomePage(): JSX.Element {
  return (
    <PageWrapper>
      <VStack spacing={8} py={{ base: 8, md: 16 }} align="center">
        <Heading
          as="h1"
          size="2xl"
          textAlign="center"
          bgGradient="linear(to-r, brand.500, pink.500)"
          bgClip="text"
        >
          Understand Your Medications
        </Heading>
        <Text fontSize="lg" maxW="2xl" textAlign="center" color="gray.600">
          Enter or scan your prescriptions and instantly see how they interact
          a colour-coded graph, the top three risks in plain language, and
          questions to ask your doctor.
        </Text>

        <GlassCard maxW="lg" w="100%">
          <VStack spacing={4} align="stretch">
            <Heading as="h2" size="md">
              Get started
            </Heading>
            <Text color="gray.600">
              Create an account to save your medication list and review past
              analyses.
            </Text>
            <HStack>
              <GradientButton as={RouterLink} to="/register">
                Create account
              </GradientButton>
              <GradientButton as={RouterLink} to="/login" variant="outline">
                Log in
              </GradientButton>
            </HStack>
          </VStack>
        </GlassCard>
      </VStack>
    </PageWrapper>
  );
}
