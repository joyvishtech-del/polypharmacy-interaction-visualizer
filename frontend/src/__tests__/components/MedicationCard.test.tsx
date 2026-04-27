import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChakraProvider } from '@chakra-ui/react';
import { MedicationCard } from '../../components/medications/MedicationCard';
import type { Medication } from '../../types';

const baseMed: Medication = {
  id: 1,
  user_id: 1,
  name: 'Aspirin',
  dosage: '100 mg',
  frequency: 'Daily',
  start_date: null,
  notes: null,
  source: 'manual',
  photo_url: null,
  ocr_raw_text: null,
  created_at: '2026-04-01T00:00:00Z',
  updated_at: '2026-04-01T00:00:00Z',
};

function renderCard(props: Partial<Parameters<typeof MedicationCard>[0]> = {}) {
  const onEdit = props.onEdit ?? vi.fn();
  const onDelete = props.onDelete ?? vi.fn();
  render(
    <ChakraProvider>
      <MedicationCard
        medication={props.medication ?? baseMed}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </ChakraProvider>
  );
  return { onEdit, onDelete };
}

describe('MedicationCard', () => {
  it('renders the name, dosage, and source badge', () => {
    renderCard();
    expect(screen.getByRole('heading', { name: 'Aspirin' })).toBeInTheDocument();
    expect(screen.getByText(/100 mg/)).toBeInTheDocument();
    expect(screen.getByText('Manual')).toBeInTheDocument();
  });

  it('shows the OCR badge when source is ocr', () => {
    renderCard({ medication: { ...baseMed, source: 'ocr' } });
    expect(screen.getByText('OCR')).toBeInTheDocument();
  });

  it('fires onDelete when the delete confirmation button is clicked', async () => {
    const user = userEvent.setup();
    const { onDelete } = renderCard();

    await user.click(screen.getByRole('button', { name: /Delete Aspirin/i }));
    // AlertDialog is now open with a confirm button labelled "Delete".
    const confirmButton = await screen.findByRole('button', {
      name: /^Delete$/,
    });
    await user.click(confirmButton);

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith(baseMed);
  });
});
