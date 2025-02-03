import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TradeForm } from '../components/TradeForm'
import { useAccount, useChainId } from 'wagmi'
import { useCalibrator } from '../hooks/useCalibrator'
import { useTokens } from '../hooks/useTokens'
import { useCustomTokens } from '../hooks/useCustomTokens'
import { TestWrapper } from './test-wrapper'
import React from 'react'

// Mock wagmi hooks
vi.mock('wagmi', () => ({
  useAccount: vi.fn(),
  useChainId: vi.fn(),
  createConfig: () => ({
    chains: [],
    transports: {},
  }),
  WagmiConfig: ({ children }: { children: React.ReactNode }) => children,
}))

// Mock useCalibrator hook
vi.mock('../hooks/useCalibrator')

// Mock useTokens hook
vi.mock('../hooks/useTokens')

// Mock useCustomTokens hook
vi.mock('../hooks/useCustomTokens')

// Create mock form
const mockForm = {
  getFieldValue: vi.fn(),
  getFieldsValue: vi.fn(),
  setFieldsValue: vi.fn(),
  resetFields: vi.fn(),
  validateFields: vi.fn(),
}

describe('TradeForm', () => {
  const mockAddress = '0x1234567890123456789012345678901234567890'
  const mockChainId = 1 // Ethereum mainnet
  const mockQuoteResponse = {
    data: {
      minimumAmount: '1000000000000000000', // 1 ETH in wei
      fee: '2639000000000000', // Fee in wei
      dispensationUSD: '$0.2639',
    },
  }

  const mockTokens = {
    WETH: {
      chainId: 1,
      address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      name: 'Wrapped Ether',
      symbol: 'WETH',
      decimals: 18,
      logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png',
    },
    DAI: {
      chainId: 1,
      address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      name: 'Dai Stablecoin',
      symbol: 'DAI',
      decimals: 18,
      logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x6B175474E89094C44Da98b954EedeAC495271d0F/logo.png',
    },
  }

  beforeEach(() => {
    vi.resetAllMocks()
    
    // Create form state
    const formState = {
      inputAmount: '1.0',
      inputToken: mockTokens.WETH.address,
      outputToken: mockTokens.DAI.address,
      slippageTolerance: 0.5,
    }

    // Mock useTokens hook
    vi.mocked(useTokens).mockReturnValue({
      inputTokens: [mockTokens.WETH],
      outputTokens: [mockTokens.DAI],
      loading: false,
      error: null,
    })

    // Mock useCustomTokens hook
    vi.mocked(useCustomTokens).mockReturnValue({
      getCustomTokens: vi.fn().mockReturnValue([]),
    })

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
    } as unknown as UseAccountReturnType)
    
    vi.mocked(useChainId).mockReturnValue(mockChainId)

    // Mock useCalibrator hook
    vi.mocked(useCalibrator).mockReturnValue({
      useQuote: vi.fn().mockReturnValue({
        data: mockQuoteResponse,
        isLoading: false,
        error: null,
      }),
    })

    // Reset form mocks with proper state tracking
    mockForm.getFieldValue.mockImplementation((field: string) => formState[field])
    mockForm.getFieldsValue.mockReturnValue(formState)
    mockForm.setFieldsValue.mockImplementation((values: any) => {
      Object.assign(formState, values)
    })
    mockForm.resetFields.mockImplementation(() => {
      formState.inputAmount = ''
      formState.inputToken = ''
      formState.outputToken = ''
      formState.slippageTolerance = 0.5
    })
    mockForm.validateFields.mockResolvedValue(formState)
  })

  // Mock antd components
  vi.mock('antd', () => {
    const Form = ({ children, onFinish, initialValues, ...props }: any) => {
      return (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onFinish && onFinish(mockForm.getFieldsValue());
          }}
          {...props}
        >
          {children}
        </form>
      );
    };

    const useForm = () => [mockForm];

    const Item = ({ children, noStyle, name, ...props }: any) => {
      const childrenWithProps = React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child, { name });
        }
        return child;
      });

      return (
        <div {...props} style={noStyle ? {} : { marginBottom: 16 }}>
          {childrenWithProps}
        </div>
      );
    };

    const Space = ({ children, ...props }: any) => {
      return <div {...props}>{children}</div>;
    };

    const Compact = ({ children, ...props }: any) => {
      return <div {...props}>{children}</div>;
    };

    Space.Compact = Compact;

    const Card = ({ children, title, extra, ...props }: any) => {
      return (
        <div {...props}>
          <div>
            <span>{title}</span>
            {extra}
          </div>
          {children}
        </div>
      );
    };

    const Row = ({ children, ...props }: any) => {
      return <div {...props}>{children}</div>;
    };

    const Col = ({ children, ...props }: any) => {
      return <div {...props}>{children}</div>;
    };

    const Select = ({ children, suffixIcon, options, ...props }: any) => {
      // Remove boolean props that shouldn't be passed to DOM
      const { bordered, ...domProps } = props;
      return (
        <select {...domProps}>
          {options?.map((option: any) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    };

    const InputNumber = ({ stringMode, name, ...props }: any) => {
      // Remove boolean props that shouldn't be passed to DOM
      const { bordered, ...domProps } = props;
      return <input type="number" name={name} {...domProps} />;
    };

    const Button = ({ children, ...props }: any) => {
      return <button {...props}>{children}</button>;
    };

    const Modal = ({ children, title, ...props }: any) => {
      return (
        <div role="dialog" {...props}>
          <div>{title}</div>
          {children}
        </div>
      );
    };

    const Tooltip = ({ children, title, ...props }: any) => {
      return (
        <div title={title} {...props}>
          {children}
        </div>
      );
    };

    const Alert = ({ message, description, type, showIcon, ...props }: any) => {
      return (
        <div role="alert" {...props}>
          <div>{message}</div>
          {description && <div>{description}</div>}
        </div>
      );
    };

    return {
      Form: Object.assign(Form, { Item, useForm }),
      Card,
      Row,
      Col,
      Select,
      InputNumber,
      Button,
      Modal,
      Space: Object.assign(Space, { Compact }),
      Tooltip,
      Alert,
    };
  })

  it('should render correctly when wallet is connected', () => {
    render(<TradeForm />, { wrapper: TestWrapper })

    // Check basic form elements
    expect(screen.getByText('Swap')).toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: 'Input Amount' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Input Token' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Output Token' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Get Quote' })).toBeInTheDocument()
  })

  it('should disable form when wallet is not connected', () => {
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
    } as unknown as UseAccountReturnType)

    render(<TradeForm />, { wrapper: TestWrapper })

    expect(screen.getByRole('button', { name: 'Connect Wallet' })).toBeDisabled()
  })

  it('should open settings modal when settings button is clicked', async () => {
    render(<TradeForm />, { wrapper: TestWrapper })

    const settingsButton = screen.getByRole('button', { name: 'Settings' })
    fireEvent.click(settingsButton)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    // Check for the input by its name attribute
    expect(screen.getByRole('spinbutton', { name: 'Slippage Tolerance' })).toBeInTheDocument()
  })

  it('should update form values and fetch quote', async () => {
    render(<TradeForm />, { wrapper: TestWrapper })

    // Input amount
    const inputAmount = screen.getByRole('spinbutton', { name: 'Input Amount' })
    fireEvent.change(inputAmount, { target: { value: '1.0' } })

    // Input token
    const inputToken = screen.getByRole('combobox', { name: 'Input Token' })
    fireEvent.change(inputToken, { target: { value: mockTokens.WETH.address } })

    // Output token
    const outputToken = screen.getByRole('combobox', { name: 'Output Token' })
    fireEvent.change(outputToken, { target: { value: mockTokens.DAI.address } })

    // Submit form
    const submitButton = screen.getByRole('button', { name: 'Get Quote' })
    await waitFor(() => {
      expect(submitButton).toBeEnabled()
    })
    fireEvent.click(submitButton)

    // Wait for quote to be fetched and displayed
    await waitFor(() => {
      // Check if the quote amount is displayed
      const quoteAmount = screen.getByTestId('quote-amount')
      expect(quoteAmount).toHaveTextContent('1')

      // Check if the fee is displayed
      expect(screen.getByText('Fee: $0.2639')).toBeInTheDocument()
    })
  })

  it('should show loading state while fetching quote', async () => {
    vi.mocked(useCalibrator).mockReturnValue({
      useQuote: vi.fn().mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
      }),
    })

    render(<TradeForm />, { wrapper: TestWrapper })

    const submitButton = screen.getByRole('button', { name: 'Getting Quote...' })
    expect(submitButton).toBeDisabled()
  })

  it('should handle API errors gracefully', async () => {
    const errorMessage = 'Failed to fetch quote'
    vi.mocked(useCalibrator).mockReturnValue({
      useQuote: vi.fn().mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error(errorMessage),
      }),
    })

    render(<TradeForm />, { wrapper: TestWrapper })

    await waitFor(() => {
      expect(screen.getByText('Error')).toBeInTheDocument()
      expect(screen.getByText(errorMessage)).toBeInTheDocument()
    })
  })

  it('should render chain options correctly', async () => {
    render(<TradeForm />, { wrapper: TestWrapper })

    // Check if chain options are rendered correctly
    const chainSelect = screen.getByRole('combobox', { name: 'Output Chain' })
    fireEvent.mouseDown(chainSelect)
    expect(screen.getByText('Ethereum')).toBeInTheDocument()
    expect(screen.getByText('Optimism')).toBeInTheDocument()
    expect(screen.getByText('Base')).toBeInTheDocument()
  })
})
