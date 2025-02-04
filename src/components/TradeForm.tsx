import { Form, Modal, Select, Space, InputNumber, Tooltip, Button } from 'antd';
import { InfoCircleOutlined, SettingOutlined } from '@ant-design/icons';
import { useAccount, useChainId } from 'wagmi';
import { formatUnits } from 'viem';
import { useState, useEffect } from 'react';
import { useTokens } from '../hooks/useTokens';
import { useCalibrator } from '../hooks/useCalibrator';
import { useCompactMessage } from '../hooks/useCompactMessage';
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
  const { assembleMessagePayload } = useCompactMessage();
  const { signCompact } = useCompactSigner();
  const { broadcast } = useBroadcast();
  const [form] = Form.useForm<TradeFormValues>();
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [selectedOutputChain, setSelectedOutputChain] = useState<number>(SUPPORTED_CHAINS[0].id);
  const [quoteParams, setQuoteParams] = useState<GetQuoteParams>();
  const [isSigning, setIsSigning] = useState(false);
  const { data: quote, isLoading, error } = useQuote(quoteParams);
  const [selectedInputToken, setSelectedInputToken] = useState<
    (typeof inputTokens)[0] | undefined
  >();
  const [selectedOutputToken, setSelectedOutputToken] = useState<
    (typeof outputTokens)[0] | undefined
  >();

  // Initialize form with empty values
  useEffect(() => {
    form.setFieldsValue({
      inputToken: '',
      outputToken: '',
      inputAmount: '',
      slippageTolerance: 0.5,
    });
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
    if (values.inputToken && values.inputAmount && values.outputToken && selectedOutputChain) {
      const slippageTolerance = localStorage.getItem('slippageTolerance')
        ? Number(localStorage.getItem('slippageTolerance'))
        : 0.5;

      setQuoteParams({
        inputTokenChainId: chainId,
        inputTokenAddress: values.inputToken,
        inputTokenAmount: values.inputAmount,
        outputTokenChainId: selectedOutputChain,
        outputTokenAddress: values.outputToken,
        slippageBips: Math.round(slippageTolerance * 100),
      });
    }
  };

  const handleFormSubmit = async (values: TradeFormValues) => {
    try {
      if (!selectedInputToken || !selectedOutputChain || !selectedOutputToken) return;

      // Get the slippage tolerance from local storage or use default
      const slippageTolerance = localStorage.getItem('slippageTolerance')
        ? Number(localStorage.getItem('slippageTolerance'))
        : 0.5;

      // Update quote params to trigger API call
      setQuoteParams({
        inputTokenChainId: chainId,
        inputTokenAddress: values.inputToken,
        inputTokenAmount: values.inputAmount,
        outputTokenChainId: selectedOutputChain,
        outputTokenAddress: values.outputToken,
        slippageBips: Math.round(slippageTolerance * 100),
      });

      // Wait for quote to be ready
      if (!quote?.data) return;

      // Assemble the compact message payload
      const payload = assembleMessagePayload({
        inputTokenAmount: quote.data.amount,
        inputTokenAddress: values.inputToken,
        outputTokenAddress: values.outputToken,
        chainId,
        expirationTime: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        tribunal: quote.data.mandate.tribunal,
        mandate: {
          recipient: quote.data.mandate.recipient,
          expires: quote.data.mandate.expires,
          token: quote.data.mandate.token,
          minimumAmount: quote.data.mandate.minimumAmount,
          baselinePriorityFee: quote.data.mandate.baselinePriorityFee,
          scalingFactor: quote.data.mandate.scalingFactor,
          salt: quote.data.mandate.salt as `0x${string}`,
        },
      });

      setIsSigning(true);

      // Get signatures from smallocator and user
      const { userSignature, smallocatorSignature } = await signCompact(payload);

      // Broadcast the signed compact
      await broadcast(payload, userSignature, smallocatorSignature);

      // Reset form
      form.resetFields();
    } catch (error) {
      console.error('Error submitting form:', error);
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
              {quote?.data?.mandate?.minimumAmount && selectedOutputToken
                ? Number(
                    formatUnits(
                      BigInt(quote.data.mandate.minimumAmount),
                      selectedOutputToken.decimals
                    )
                  ).toString()
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
                options={SUPPORTED_CHAINS.map(chain => ({
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
          {quote?.data?.context?.dispensationUSD && (
            <div className="mt-1 text-sm text-gray-500">
              <Space>
                <span>Fee: {quote.data.context.dispensationUSD}</span>
                <Tooltip title="Fee includes gas costs and protocol fees">
                  <InfoCircleOutlined />
                </Tooltip>
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

        <Form.Item
          noStyle
          shouldUpdate={(prev, curr) =>
            prev.inputToken !== curr.inputToken || prev.outputToken !== curr.outputToken
          }
        >
          {({ getFieldValue }) => (
            <Button
              type="primary"
              htmlType="submit"
              loading={isSigning || isLoading}
              disabled={!getFieldValue('inputToken') || !getFieldValue('outputToken')}
              block
            >
              {isSigning ? 'Signing...' : isLoading ? 'Getting Quote...' : 'Swap'}
            </Button>
          )}
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
