import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TradeForm } from '../components/TradeForm';
import { useAccount, useChainId } from 'wagmi';
import { useCalibrator } from '../hooks/useCalibrator';
import { useTokens } from '../hooks/useTokens';
import { useCustomTokens } from '../hooks/useCustomTokens';
import { TestWrapper } from './test-wrapper';
import type { UseAccountReturnType } from './test-types';
import type { CalibratorQuoteResponse } from '../types';
import React from 'react';

// Mock wagmi hooks
vi.mock('wagmi', () => ({
  useAccount: vi.fn(),
  useChainId: vi.fn(),
  createConfig: () => ({
    chains: [],
    transports: {},
  }),
  WagmiConfig: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock useCalibrator hook
vi.mock('../hooks/useCalibrator');

// Mock useTokens hook
vi.mock('../hooks/useTokens');

// Mock useCustomTokens hook
vi.mock('../hooks/useCustomTokens');

// Create mock form
const mockForm = {
  getFieldValue: vi.fn(),
  getFieldsValue: vi.fn(),
  setFieldsValue: vi.fn(),
  resetFields: vi.fn(),
  validateFields: vi.fn(),
};

interface FormState {
  inputAmount: string;
  inputToken: string;
  outputToken: string;
  slippageTolerance: number;
}

describe('TradeForm', () => {
  const mockAddress = '0x1234567890123456789012345678901234567890';
  const mockChainId = 1; // Ethereum mainnet
  const mockQuoteResponse: CalibratorQuoteResponse = {
    data: {
      arbiter: '0x1234567890123456789012345678901234567890',
      sponsor: '0x1234567890123456789012345678901234567890',
      nonce: null,
      expires: '1234567890',
      id: '1234567890',
      amount: '1000000000000000000',
      mandate: {
        chainId: 1,
        tribunal: '0x1234567890123456789012345678901234567890',
        recipient: '0x1234567890123456789012345678901234567890',
        expires: '1234567890',
        token: '0x1234567890123456789012345678901234567890',
        minimumAmount: '989904904981520408',
        baselinePriorityFee: '1000000000000000000',
        scalingFactor: '1000000000000000000',
        salt: '1234567890',
      },
      context: {
        dispensation: '2639000000000000',
        dispensationUSD: '$0.2639',
        spotOutputAmount: '1000000000000000000',
        quoteOutputAmountDirect: '1000000000000000000',
        quoteOutputAmountNet: '1000000000000000000',
        deltaAmount: '0',
        witnessHash: '0x1234567890123456789012345678901234567890',
      },
    },
  };

  const mockTokens = {
    WETH: {
      chainId: 1,
      address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      name: 'Wrapped Ether',
      symbol: 'WETH',
      decimals: 18,
      logoURI:
        'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png',
    },
    DAI: {
      chainId: 1,
      address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      name: 'Dai Stablecoin',
      symbol: 'DAI',
      decimals: 18,
      logoURI:
        'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x6B175474E89094C44Da98b954EedeAC495271d0F/logo.png',
    },
  } as const;

  beforeEach(() => {
    vi.resetAllMocks();

    // Create form state
    const formState: FormState = {
      inputAmount: '1.0',
      inputToken: mockTokens.WETH.address,
      outputToken: mockTokens.DAI.address,
      slippageTolerance: 0.5,
    };

    // Mock useTokens hook
    vi.mocked(useTokens).mockReturnValue({
      inputTokens: [mockTokens.WETH],
      outputTokens: [mockTokens.DAI],
    });

    // Mock useCustomTokens hook
    vi.mocked(useCustomTokens).mockReturnValue({
      customTokens: {},
      addCustomToken: vi.fn(),
      removeCustomToken: vi.fn(),
      getCustomTokens: vi.fn().mockReturnValue([]),
    });

    // Mock wagmi hooks
    vi.mocked(useAccount).mockReturnValue({
      address: mockAddress,
      addresses: [mockAddress],
      chain: undefined,
      chainId: mockChainId,
      connector: undefined,
      isConnected: true,
      isConnecting: false,
      isDisconnected: false,
      isReconnecting: false,
      status: 'connected',
    } as unknown as UseAccountReturnType);

    vi.mocked(useChainId).mockReturnValue(mockChainId);

    // Mock useCalibrator hook
    vi.mocked(useCalibrator).mockReturnValue({
      getQuote: vi.fn().mockResolvedValue(mockQuoteResponse),
      useQuote: vi.fn().mockReturnValue({
        data: mockQuoteResponse,
        isLoading: false,
        error: null,
      }),
    });

    // Reset form mocks with proper state tracking
    mockForm.getFieldValue.mockImplementation((field: keyof FormState) => formState[field]);
    mockForm.getFieldsValue.mockReturnValue(formState);
    mockForm.setFieldsValue.mockImplementation((values: Partial<FormState>) => {
      Object.assign(formState, values);
    });
    mockForm.resetFields.mockImplementation(() => {
      formState.inputAmount = '';
      formState.inputToken = '';
      formState.outputToken = '';
      formState.slippageTolerance = 0.5;
    });
    mockForm.validateFields.mockResolvedValue(formState);
  });

  it('should render correctly when disconnected', () => {
    // Mock disconnected state
    vi.mocked(useAccount).mockReturnValue({
      address: undefined,
      addresses: [],
      chain: undefined,
      chainId: undefined,
      connector: undefined,
      isConnected: false,
      isConnecting: false,
      isDisconnected: true,
      isReconnecting: false,
      status: 'disconnected',
    } as unknown as UseAccountReturnType);

    render(<TradeForm />, { wrapper: TestWrapper });

    expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
  });

  it('should handle form submission', async () => {
    render(<TradeForm />, { wrapper: TestWrapper });

    // Fill out form
    const inputAmount = screen.getByLabelText('Input Amount');
    fireEvent.change(inputAmount, { target: { value: '1.0' } });

    // Select input token
    const inputTokenSelect = screen.getByRole('combobox', { name: 'Input Token' });
    fireEvent.mouseDown(inputTokenSelect);
    fireEvent.click(screen.getByText('WETH - Wrapped Ether'));

    // Select output token
    const outputTokenSelect = screen.getByRole('combobox', { name: 'Output Token' });
    fireEvent.mouseDown(outputTokenSelect);
    fireEvent.click(screen.getByText('DAI - Dai Stablecoin'));

    // Submit form
    const submitButton = screen.getByText('Get Quote');
    fireEvent.click(submitButton);

    // Wait for loading state to finish
    await waitFor(() => {
      expect(screen.queryByText('Getting Quote...')).not.toBeInTheDocument();
    });

    // Check the quote amount
    await waitFor(() => {
      expect(screen.getByTestId('quote-amount')).toHaveTextContent('0.9899049049815204');
    });
  });

  it('should handle quote loading state', () => {
    // Mock loading state
    vi.mocked(useCalibrator).mockReturnValue({
      getQuote: vi.fn().mockResolvedValue(mockQuoteResponse),
      useQuote: vi.fn().mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      }),
    });

    render(<TradeForm />, { wrapper: TestWrapper });

    expect(screen.getByText('Getting Quote...')).toBeInTheDocument();
  });

  it('should handle quote error state', () => {
    // Mock error state
    vi.mocked(useCalibrator).mockReturnValue({
      getQuote: vi.fn().mockResolvedValue(mockQuoteResponse),
      useQuote: vi.fn().mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Failed to fetch quote'),
      }),
    });

    render(<TradeForm />, { wrapper: TestWrapper });

    expect(screen.getByText('Failed to fetch quote')).toBeInTheDocument();
  });
});
