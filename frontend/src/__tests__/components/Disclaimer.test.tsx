import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { Disclaimer } from '../../components/ui/Disclaimer';

describe('Disclaimer', () => {
  it('renders the not-medical-advice copy', () => {
    render(
      <ChakraProvider>
        <Disclaimer />
      </ChakraProvider>
    );

    expect(
      screen.getByText(/Informational only, not medical advice\./i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Always consult a licensed healthcare professional before changing any medication\./i
      )
    ).toBeInTheDocument();
  });
});
