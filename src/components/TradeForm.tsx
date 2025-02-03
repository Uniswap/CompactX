import { useState } from 'react';
import { Card, Form, InputNumber, Select, Modal, Button, Space, Alert } from 'antd';
import { useAccount, useChainId } from 'wagmi';
import { SettingOutlined } from '@ant-design/icons';
import { useCustomTokens } from '../hooks/useCustomTokens';
import { useCalibrator } from '../hooks/useCalibrator';

interface Token {
  chainId: number;
  address: string;
  name: string;
  symbol: string;
  decimals: number;
}

// Hardcoded list of tokens per chain
const TOKENS_BY_CHAIN: Record<number, Token[]> = {
  1: [
    {
      chainId: 1,
      address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      name: 'Wrapped Ether',
      symbol: 'WETH',
      decimals: 18,
    },
    {
      chainId: 1,
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 6,
    },
    {
      chainId: 1,
      address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      name: 'Dai Stablecoin',
      symbol: 'DAI',
      decimals: 18,
    },
  ],
  // Add more chains as needed
};

// Supported chains for output token
const SUPPORTED_CHAINS = [
  { id: 1, name: 'Ethereum' },
  { id: 137, name: 'Polygon' },
  { id: 42161, name: 'Arbitrum' },
  // Add more chains as needed
];

export interface TradeFormValues {
  inputAmount: string;
  inputToken: string;
  outputToken: string;
  outputChain: number;
  slippageTolerance: number;
}

export function TradeForm() {
  const { isConnected } = useAccount();
  const { getCustomTokens } = useCustomTokens();
  const { useQuote } = useCalibrator();
  const [form] = Form.useForm<TradeFormValues>();
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [selectedOutputChain, setSelectedOutputChain] = useState(useChainId());
  const [quoteParams, setQuoteParams] = useState<{
    inputToken: string;
    outputToken: string;
    amount: string;
    slippageTolerance: number;
  }>();

  // Get custom tokens for the current chain
  const customTokens = getCustomTokens(useChainId());

  // Get tokens for input (current chain) and output (selected chain)
  const inputTokens = [...(TOKENS_BY_CHAIN[useChainId()] || []), ...customTokens];
  const outputTokens = TOKENS_BY_CHAIN[selectedOutputChain] || [];

  // Format tokens for Select options
  const inputTokenOptions = inputTokens.map((token: Token) => ({
    label: `${token.symbol} - ${token.name}`,
    value: token.address,
  }));

  const outputTokenOptions = outputTokens.map((token: Token) => ({
    label: `${token.symbol} - ${token.name}`,
    value: token.address,
  }));

  // Get quote from Calibrator API
  const { data: quote, isLoading, error } = useQuote(quoteParams);

  const handleFormSubmit = async (values: TradeFormValues) => {
    // Update quote params to trigger API call
    setQuoteParams({
      inputToken: values.inputToken,
      outputToken: values.outputToken,
      amount: values.inputAmount,
      slippageTolerance: values.slippageTolerance,
    });
  };

  return (
    <>
      <Card
        title="Swap"
        style={{ width: '100%', maxWidth: 500 }}
        extra={
          <Button type="text" icon={<SettingOutlined />} onClick={() => setSettingsVisible(true)} />
        }
      >
        <Form
          form={form}
          layout="vertical"
          disabled={!isConnected}
          onFinish={handleFormSubmit}
          initialValues={{
            slippageTolerance: 0.5,
            outputChain: useChainId(),
          }}
        >
          {/* Input Amount & Token (Connected Chain) */}
          <div className="rounded-lg bg-gray-100 p-4 dark:bg-gray-800">
            <div className="mb-2 text-sm text-gray-500">Sell</div>
            <Space.Compact style={{ width: '100%' }}>
              <Form.Item
                name="inputAmount"
                noStyle
                rules={[{ required: true, message: 'Please enter an amount' }]}
              >
                <InputNumber
                  style={{ width: '60%' }}
                  placeholder="0.0"
                  min={0}
                  step="0.000000000000000001"
                  stringMode
                  bordered={false}
                  controls={false}
                />
              </Form.Item>
              <Form.Item name="inputToken" noStyle>
                <Select
                  style={{ width: '40%' }}
                  options={inputTokenOptions}
                  bordered={false}
                  suffixIcon={null}
                />
              </Form.Item>
            </Space.Compact>
            <div className="mt-1 text-sm text-gray-500">
              ${form.getFieldValue('inputAmount') || '0.00'}
            </div>
          </div>

          {/* Swap Direction Arrow */}
          <div className="my-2 flex justify-center">
            <div className="rounded-full bg-gray-100 p-2 dark:bg-gray-800">↓</div>
          </div>

          {/* Output Amount & Token (Selected Chain) */}
          <div className="rounded-lg bg-gray-100 p-4 dark:bg-gray-800">
            <div className="mb-2 text-sm text-gray-500">Buy</div>
            <Space.Compact style={{ width: '100%' }}>
              <div style={{ width: '60%' }} className="text-2xl">
                {quote ? quote.price : '0.00'}
              </div>
              <Form.Item name="outputToken" noStyle>
                <Select
                  style={{ width: '40%' }}
                  options={outputTokenOptions}
                  bordered={false}
                  suffixIcon={null}
                />
              </Form.Item>
            </Space.Compact>
            <div className="mt-1 text-sm text-gray-500">${quote ? quote.price : '0.00'}</div>
          </div>

          {error && (
            <Alert
              message="Error"
              description={error instanceof Error ? error.message : 'Failed to fetch quote'}
              type="error"
              showIcon
              style={{ marginTop: 16 }}
            />
          )}

          <Form.Item style={{ marginTop: 16 }}>
            <button
              type="submit"
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:bg-gray-400"
              disabled={!isConnected || isLoading}
            >
              {!isConnected ? 'Connect Wallet' : isLoading ? 'Getting Quote...' : 'Get Quote'}
            </button>
          </Form.Item>
        </Form>
      </Card>

      {/* Settings Modal */}
      <Modal
        title="Settings"
        open={settingsVisible}
        onCancel={() => setSettingsVisible(false)}
        footer={null}
      >
        <Form.Item label="Output Chain">
          <Select
            value={selectedOutputChain}
            onChange={setSelectedOutputChain}
            options={SUPPORTED_CHAINS.map(chain => ({
              label: chain.name,
              value: chain.id,
            }))}
          />
        </Form.Item>

        <Form.Item
          label="Slippage Tolerance (%)"
          name="slippageTolerance"
          rules={[{ required: true, message: 'Please enter slippage tolerance' }]}
        >
          <InputNumber style={{ width: '100%' }} min={0} max={100} step={0.1} precision={1} />
        </Form.Item>
      </Modal>
    </>
  );
}
