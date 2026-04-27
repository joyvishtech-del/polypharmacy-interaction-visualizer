import {
  Box,
  Heading,
  IconButton,
  ListItem,
  OrderedList,
  Text,
  VStack,
  useClipboard,
  useToast,
  useColorModeValue,
} from '@chakra-ui/react';
import { GlassCard } from '../ui/GlassCard';
import type { DoctorQuestion } from '../../types';

interface DoctorQuestionListProps {
  questions: DoctorQuestion[];
}

interface QuestionItemProps {
  question: DoctorQuestion;
}

function CopyIcon(): JSX.Element {
  return (
    <Box as="svg" viewBox="0 0 24 24" boxSize={4} aria-hidden>
      <path
        fill="currentColor"
        d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z"
      />
    </Box>
  );
}

function QuestionItem({ question }: QuestionItemProps): JSX.Element {
  const { onCopy, hasCopied } = useClipboard(question.question);
  const toast = useToast();

  const handleCopy = (): void => {
    onCopy();
    toast({
      title: 'Copied to clipboard',
      status: 'success',
      duration: 1500,
      isClosable: true,
    });
  };

  return (
    <ListItem mb={3}>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" gap={3}>
        <Text flex="1">{question.question}</Text>
        <IconButton
          aria-label={hasCopied ? 'Copied' : 'Copy question'}
          icon={<CopyIcon />}
          size="sm"
          variant="ghost"
          onClick={handleCopy}
        />
      </Box>
    </ListItem>
  );
}

export function DoctorQuestionList({
  questions,
}: DoctorQuestionListProps): JSX.Element {
  const subtle = useColorModeValue('gray.600', 'gray.300');
  const sorted = [...questions].sort((a, b) => a.position - b.position);

  return (
    <VStack spacing={4} align="stretch">
      <Heading as="h2" size="md">
        Questions for your doctor
      </Heading>
      <GlassCard hoverable={false}>
        {sorted.length === 0 ? (
          <Text color={subtle}>No questions generated.</Text>
        ) : (
          <OrderedList spacing={2} pl={4}>
            {sorted.map((q) => (
              <QuestionItem key={q.id} question={q} />
            ))}
          </OrderedList>
        )}
      </GlassCard>
    </VStack>
  );
}
