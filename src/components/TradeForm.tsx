import { Form, Modal, Select, Space, InputNumber, Tooltip, Button } from 'antd';
import { InfoCircleOutlined, SettingOutlined } from '@ant-design/icons';
import { useAccount, useChainId } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { useState, useEffect } from 'react';
import { useTokens } from '../hooks/useTokens';
import { useCalibrator } from '../hooks/useCalibrator';
import { useCompactSigner } from '../hooks/useCompactSigner';
import { useBroadcast } from '../hooks/useBroadcast';
import { GetQuoteParams } from '../types';

// Supported chains for output token
const SUPPORTED_CHAINS = [
  { id: 1, name: 'Ethereum' },
  { id: 10, name: 'Optimism' },
  { id: 8453, name: 'Base' },
];

interface TradeFormValues {
  inputToken: string;
  outputToken: string;
  inputAmount: string;
  slippageTolerance: number;
}

export function TradeForm() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { inputTokens, outputTokens } = useTokens();
  const { useQuote } = useCalibrator();
  const { signCompact } = useCompactSigner();
  const { broadcast } = useBroadcast();
  const [form] = Form.useForm<TradeFormValues>();
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [selectedOutputChain, setSelectedOutputChain] = useState<number | undefined>(undefined);
  const [quoteParams, setQuoteParams] = useState<GetQuoteParams>();
  const [isSigning, setIsSigning] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const { data: quote, isLoading, error } = useQuote(quoteParams);
  const [selectedInputToken, setSelectedInputToken] = useState<
    (typeof inputTokens)[0] | undefined
  >();
  const [selectedOutputToken, setSelectedOutputToken] = useState<
    (typeof outputTokens)[0] | undefined
  >();

  // Reset output chain if it matches the new chain
  useEffect(() => {
    if (selectedOutputChain === chainId) {
      setSelectedOutputChain(undefined);
      setSelectedOutputToken(undefined);
      form.setFieldsValue({ outputToken: undefined });
    }
  }, [chainId, selectedOutputChain, form]);

  // Initialize form with empty values
  useEffect(() => {
    if (form) {
      form.setFieldsValue({
        inputToken: '',
        outputToken: '',
        inputAmount: '',
        slippageTolerance: 0.5,
      });
    }
  }, [form]);

  // Handle form value changes
  const handleValuesChange = (
    _changedValues: Partial<TradeFormValues>,
    values: TradeFormValues
  ) => {
    // Update selected tokens
    const newInputToken = inputTokens.find(token => token.address === values.inputToken);
    const newOutputToken = outputTokens.find(token => token.address === values.outputToken);

    if (newInputToken !== selectedInputToken) {
      setSelectedInputToken(newInputToken);
    }

    if (newOutputToken !== selectedOutputToken) {
      setSelectedOutputToken(newOutputToken);
    }

    // Update quote params if we have all required values
    if (
      values.inputToken &&
      values.inputAmount &&
      values.outputToken &&
      selectedOutputChain &&
      newInputToken
    ) {
      const slippageTolerance = localStorage.getItem('slippageTolerance')
        ? Number(localStorage.getItem('slippageTolerance'))
        : 0.5;

      // Convert decimal input to token units
      const tokenUnits = parseUnits(values.inputAmount, newInputToken.decimals).toString();

      setQuoteParams({
        inputTokenChainId: chainId,
        inputTokenAddress: values.inputToken,
        inputTokenAmount: tokenUnits,
        outputTokenChainId: selectedOutputChain,
        outputTokenAddress: values.outputToken,
        slippageBips: Math.round(slippageTolerance * 100),
        allocatorId: '1223867955028248789127899354',
        resetPeriod: 600,
        isMultichain: true,
      });
    }
  };

  // Handle initial form submission to get quote
  const handleFormSubmit = () => {
    // Form submission now just validates the form
    // Quote is automatically fetched via useQuote when form values change
  };

  // Handle the actual swap after quote is received
  const handleSwap = async () => {
    try {
      setIsSigning(true);
      setStatusMessage('Requesting allocation...');

      // Ensure we have a quote
      if (!quote?.data || !quote.context) {
        throw new Error('No quote available');
      }

      // Create compact message from the quote data
      const mandate = {
        ...quote.data.mandate,
        salt: quote.data.mandate.salt.startsWith('0x')
          ? (quote.data.mandate.salt as `0x${string}`)
          : (`0x${quote.data.mandate.salt}` as `0x${string}`),
      };

      const compactMessage = {
        arbiter: quote.data.arbiter,
        sponsor: quote.data.sponsor,
        nonce: null, // Initialize as null, will be set from Smallocator response
        expires: quote.data.expires,
        id: quote.data.id,
        amount: quote.data.amount,
        mandate,
      };

      // Show allocation message before signing
      setStatusMessage('Allocation received — sign to confirm...');

      // Sign with user's wallet - this will handle getting smallocator signature first
      const { userSignature, smallocatorSignature, nonce } = await signCompact({
        chainId: quote.data.mandate.chainId.toString(),
        compact: compactMessage,
      });

      // Show broadcasting message
      setStatusMessage('Broadcasting intent...');

      // Prepare the broadcast payload
      const broadcastPayload = {
        chainId: quote.data.mandate.chainId.toString(),
        compact: {
          ...compactMessage,
          nonce,
        },
        sponsorSignature: userSignature,
        allocatorSignature: smallocatorSignature
      };

      // Log the complete broadcast payload
      console.log('Broadcasting payload:', {
        compact: broadcastPayload.compact,
        sponsorSignature: userSignature,
        allocatorSignature: smallocatorSignature,
        context: quote.context
      });

      // Broadcast the final signed compact
      const broadcastResponse = await broadcast(
        broadcastPayload.compact,
        broadcastPayload.sponsorSignature,
        broadcastPayload.allocatorSignature
      );

      if (!broadcastResponse.success) {
        throw new Error('Failed to broadcast trade');
      }

      // Reset form and status on success
      form.resetFields();
      setStatusMessage('');
    } catch (error) {
      console.error('Error executing swap:', error);
      setStatusMessage('');
    } finally {
      setIsSigning(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-lg">Connect your wallet to start trading</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto p-4">
      <Form
        form={form}
        onFinish={handleFormSubmit}
        onValuesChange={handleValuesChange}
        layout="vertical"
        className="flex flex-col gap-4"
        data-testid="trade-form"
      >
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-semibold">Swap</h1>
          <Button
            type="text"
            icon={<SettingOutlined />}
            onClick={() => setSettingsVisible(true)}
            aria-label="Settings"
          />
        </div>

        <div className="rounded-lg bg-gray-100 p-4 dark:bg-gray-800">
          <div className="mb-2 text-sm text-gray-500">Sell</div>
          <Space.Compact style={{ width: '100%' }}>
            <Form.Item name="inputAmount" noStyle>
              <InputNumber
                style={{ width: '60%' }}
                placeholder="0.0"
                min={0}
                variant="borderless"
                controls={false}
                stringMode
                precision={selectedInputToken?.decimals ?? 18}
                aria-label="Input Amount"
              />
            </Form.Item>
            <Form.Item name="inputToken" noStyle>
              <Select
                style={{ width: '40%' }}
                placeholder="Select token"
                options={inputTokens.map(token => ({
                  label: token.symbol,
                  value: token.address,
                }))}
                aria-label="Input Token"
                id="inputToken"
                data-testid="input-token-select"
              />
            </Form.Item>
          </Space.Compact>
          {selectedInputToken && <div className="mt-1 text-sm text-gray-500">${'0.00'}</div>}
        </div>

        <div className="flex justify-center">↓</div>

        <div className="rounded-lg bg-gray-100 p-4 dark:bg-gray-800">
          <div className="mb-2 text-sm text-gray-500">Buy</div>
          <Space.Compact style={{ width: '100%' }}>
            <div style={{ width: '60%' }} className="text-2xl" data-testid="quote-amount">
              {quote?.context?.quoteOutputAmountNet && selectedOutputToken
                ? formatUnits(
                    BigInt(quote.context.quoteOutputAmountNet),
                    selectedOutputToken.decimals
                  )
                : '0.00'}
            </div>
            <Space.Compact style={{ width: '40%' }}>
              <Select
                style={{ width: '60%', minWidth: '100px' }}
                placeholder="Chain"
                value={selectedOutputChain}
                onChange={value => {
                  setSelectedOutputChain(value);
                  // Clear the output token without triggering the form's onChange
                  setSelectedOutputToken(undefined);
                  form.setFieldsValue({ outputToken: undefined });
                }}
                options={SUPPORTED_CHAINS.filter(chain => chain.id !== chainId).map(chain => ({
                  label: chain.name,
                  value: chain.id,
                }))}
                aria-label="Output Chain"
              />
              <Form.Item name="outputToken" noStyle>
                <Select
                  style={{ width: '40%' }}
                  placeholder="Token"
                  disabled={!selectedOutputChain}
                  onChange={value => {
                    const token = outputTokens.find(t => t.address === value);
                    setSelectedOutputToken(token);
                  }}
                  options={outputTokens
                    .filter(token => token.chainId === selectedOutputChain)
                    .map(token => ({
                      label: token.symbol,
                      value: token.address,
                    }))}
                  aria-label="Output Token"
                  id="outputToken"
                  data-testid="output-token-select"
                />
              </Form.Item>
            </Space.Compact>
          </Space.Compact>
          {quote?.context?.dispensationUSD && (
            <div className="mt-1 text-sm text-gray-500">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Space>
                  <span>Settlement Cost: {quote.context.dispensationUSD}</span>
                  <Tooltip title="Estimated cost to a filler to dispatch a cross-chain message and claim the tokens being sold">
                    <InfoCircleOutlined />
                  </Tooltip>
                </Space>
                {quote?.data?.mandate?.minimumAmount && selectedOutputToken && (
                  <Space>
                    <span>
                      Minimum received:{' '}
                      {Number(
                        formatUnits(
                          BigInt(quote.data.mandate.minimumAmount),
                          selectedOutputToken.decimals
                        )
                      ).toString()}
                    </span>
                    <Tooltip title="The minimum amount you will receive; the final received amount increases based on the gas priority fee the filler provides">
                      <InfoCircleOutlined />
                    </Tooltip>
                  </Space>
                )}
              </Space>
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-lg bg-red-100 p-4 text-red-700">
            <div className="font-bold">Error</div>
            <div>{error.message}</div>
          </div>
        )}

        {statusMessage && (
          <div className="mt-4 text-center text-blue-600">
            {statusMessage}
          </div>
        )}

        <Form.Item>
          <Button
            type="primary"
            onClick={handleSwap}
            disabled={!isConnected || !quote?.data || isLoading || isSigning}
            loading={isSigning}
            block
          >
            {!isConnected
              ? 'Connect Wallet'
              : isSigning
              ? 'Signing...'
              : error
              ? 'Try Again'
              : 'Swap'}
          </Button>
        </Form.Item>
      </Form>

      <Modal
        title="Settings"
        open={settingsVisible}
        onCancel={() => setSettingsVisible(false)}
        footer={null}
      >
        <SettingsForm onClose={() => setSettingsVisible(false)} />
      </Modal>
    </div>
  );
}

function SettingsForm({ onClose }: { onClose: () => void }) {
  const [slippageTolerance, setSlippageTolerance] = useState(
    Number(localStorage.getItem('slippageTolerance')) || 0.5
  );

  const handleSubmit = () => {
    localStorage.setItem('slippageTolerance', slippageTolerance.toString());
    onClose();
  };

  return (
    <div className="py-4">
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Slippage Tolerance (%)</label>
        <InputNumber
          value={slippageTolerance}
          onChange={value => setSlippageTolerance(Number(value))}
          style={{ width: '100%' }}
          min={0}
          max={100}
          step={0.1}
          precision={1}
          aria-label="Slippage Tolerance"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button type="primary" onClick={handleSubmit}>
          Save
        </Button>
      </div>
    </div>
  );
}
