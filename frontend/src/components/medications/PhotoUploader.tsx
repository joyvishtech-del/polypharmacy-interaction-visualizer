import {
  Box,
  Button,
  HStack,
  Image,
  Input,
  Stack,
  Text,
  useColorModeValue,
} from '@chakra-ui/react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const MAX_BYTES = 10 * 1024 * 1024;

interface PhotoUploaderProps {
  onScan: (file: File) => Promise<void> | void;
  scanning?: boolean;
}

function isAcceptedType(type: string): boolean {
  return (ACCEPTED_TYPES as readonly string[]).includes(type);
}

export function PhotoUploader({
  onScan,
  scanning = false,
}: PhotoUploaderProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<boolean>(false);

  const baseBg = useColorModeValue('white', 'gray.800');
  const dragBg = useColorModeValue('purple.50', 'purple.900');
  const borderColor = useColorModeValue('gray.300', 'gray.600');
  const dragBorder = useColorModeValue('purple.400', 'purple.300');
  const subtleColor = useColorModeValue('gray.500', 'gray.400');

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleFile = useCallback((selected: File): void => {
    if (!isAcceptedType(selected.type)) {
      setError('Unsupported file type. Use JPEG, PNG, or WebP.');
      return;
    }
    if (selected.size > MAX_BYTES) {
      setError('File too large. Maximum size is 10 MB.');
      return;
    }
    setError(null);
    setFile(selected);
  }, []);

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const selected = event.target.files?.[0];
    if (selected) handleFile(selected);
    event.target.value = '';
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    setDragOver(false);
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) handleFile(dropped);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (): void => {
    setDragOver(false);
  };

  const triggerSelect = (): void => {
    inputRef.current?.click();
  };

  const submit = async (): Promise<void> => {
    if (!file) return;
    await onScan(file);
  };

  const reset = (): void => {
    setFile(null);
    setError(null);
  };

  return (
    <Stack spacing={4}>
      <Box
        as="div"
        role="button"
        tabIndex={0}
        onClick={triggerSelect}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            triggerSelect();
          }
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        bg={dragOver ? dragBg : baseBg}
        borderWidth="2px"
        borderStyle="dashed"
        borderColor={dragOver ? dragBorder : borderColor}
        borderRadius="2xl"
        px={6}
        py={10}
        textAlign="center"
        cursor="pointer"
        transition="all 0.15s ease"
        _hover={{ borderColor: dragBorder }}
      >
        <Stack spacing={2} align="center">
          <Text fontWeight="semibold">Drag and drop a bottle photo here</Text>
          <Text fontSize="sm" color={subtleColor}>
            or click to browse. JPEG, PNG, or WebP up to 10 MB.
          </Text>
        </Stack>
        <Input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          display="none"
          onChange={handleInputChange}
        />
      </Box>

      {error && (
        <Text color="red.500" fontSize="sm" role="alert">
          {error}
        </Text>
      )}

      {file && preview && (
        <HStack spacing={4} align="flex-start">
          <Image
            src={preview}
            alt="Selected medication bottle"
            boxSize="96px"
            objectFit="cover"
            borderRadius="lg"
            border="1px solid"
            borderColor={borderColor}
          />
          <Stack spacing={2} flex={1}>
            <Text fontWeight="medium" noOfLines={1}>
              {file.name}
            </Text>
            <Text fontSize="sm" color={subtleColor}>
              {(file.size / 1024).toFixed(0)} KB
            </Text>
            <HStack>
              <Button
                colorScheme="purple"
                onClick={submit}
                isLoading={scanning}
                loadingText="Scanning"
              >
                Scan photo
              </Button>
              <Button variant="ghost" onClick={reset} isDisabled={scanning}>
                Remove
              </Button>
            </HStack>
          </Stack>
        </HStack>
      )}
    </Stack>
  );
}
