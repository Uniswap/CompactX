import { Button, Form, InputNumber, Modal, Select, Space, Tooltip } from 'antd';
import { useState } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { SettingOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useCustomTokens } from '../hooks/useCustomTokens';
import { useCalibrator } from '../hooks/useCalibrator';
import { useTokens } from '../hooks/useTokens';
import { formatUnits, parseUnits } from 'viem';
import { Token, GetQuoteParams } from '../types';

// Supported chains for output token
const SUPPORTED_CHAINS = [
  { id: 1, name: 'Ethereum' },
  { id: 10, name: 'Optimism' },
  { id: 8453, name: 'Base' },
] as const;

export interface TradeFormValues {
  inputAmount: string;
  inputToken: string;
  outputToken: string;
  slippageTolerance: number;
}

export function TradeForm() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { getCustomTokens } = useCustomTokens();
  const { useQuote } = useCalibrator();
  const { inputTokens, outputTokens } = useTokens();
  const [form] = Form.useForm<TradeFormValues>();
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [selectedOutputChain, setSelectedOutputChain] = useState(chainId);
  const [quoteParams, setQuoteParams] = useState<GetQuoteParams>();

  const customTokens = getCustomTokens(chainId);

  // Get tokens for input (current chain) and output (selected chain)
  const allTokens = [...(inputTokens || []), ...customTokens];

  // Format tokens for Select options
  const inputTokenOptions = allTokens.map((token: Token) => ({
    label: `${token.symbol} - ${token.name}`,
    value: token.address,
  }));

  const outputTokenOptions = (outputTokens || []).map((token: Token) => ({
    label: `${token.symbol} - ${token.name}`,
    value: token.address,
  }));

  // Get quote based on form values
  const { data: quote, isLoading, error } = useQuote(quoteParams);

  const handleFormSubmit = async (values: TradeFormValues) => {
    const inputToken = allTokens.find(token => token.address === values.inputToken);
    if (!inputToken) return;

    // Update quote params to trigger API call
    setQuoteParams({
      inputTokenChainId: chainId,
      inputTokenAddress: values.inputToken,
      inputTokenAmount: parseUnits(values.inputAmount, inputToken.decimals).toString(),
      outputTokenChainId: selectedOutputChain,
      outputTokenAddress: values.outputToken,
      slippageBips: Math.round(values.slippageTolerance * 100),
    });
  };

  // Find output token to get decimals for formatting
  const outputToken = (outputTokens || []).find(
    token => token.address === form.getFieldValue('outputToken')
  );

  return (
    <>
      <div
        title="Swap"
        style={{ width: '100%', maxWidth: 500 }}
        className="p-4 rounded-lg bg-white dark:bg-gray-900"
      >
        <div className="flex justify-between items-center mb-4">
          <span>Swap</span>
          <Button
            type="text"
            icon={<SettingOutlined />}
            onClick={() => setSettingsVisible(true)}
            aria-label="Settings"
          />
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleFormSubmit}
          initialValues={{ slippageTolerance: 0.5 }}
        >
          <div className="rounded-lg bg-gray-100 p-4 dark:bg-gray-800">
            <div className="mb-2 text-sm text-gray-500">Sell</div>
            <Space.Compact style={{ width: '100%' }}>
              <Form.Item
                name="inputAmount"
                noStyle
                rules={[{ required: true, message: 'Please enter amount' }]}
              >
                <InputNumber
                  style={{ width: '60%' }}
                  placeholder="0.0"
                  min={0}
                  step="0.000000000000000001"
                  stringMode
                  variant="borderless"
                  controls={false}
                  aria-label="Input Amount"
                />
              </Form.Item>
              <Form.Item name="inputToken" noStyle>
                <Select
                  style={{ width: '40%' }}
                  options={inputTokenOptions}
                  aria-label="Input Token"
                  variant="borderless"
                  suffixIcon={null}
                />
              </Form.Item>
            </Space.Compact>
            <div className="mt-1 text-sm text-gray-500">
              ${form.getFieldValue('inputAmount') || '0.00'}
            </div>
          </div>

          <div className="my-2 flex justify-center">
            <div className="rounded-full bg-gray-100 p-2 dark:bg-gray-800">↓</div>
          </div>

          <div className="rounded-lg bg-gray-100 p-4 dark:bg-gray-800">
            <div className="mb-2 text-sm text-gray-500">Buy</div>
            <Space.Compact style={{ width: '100%' }}>
              <div style={{ width: '60%' }} className="text-2xl" data-testid="quote-amount">
                {quote?.data?.mandate?.minimumAmount && outputToken
                  ? Number(
                      formatUnits(BigInt(quote.data.mandate.minimumAmount), outputToken.decimals)
                    ).toString()
                  : '0.00'}
              </div>
              <Form.Item name="outputToken" noStyle>
                <Select
                  style={{ width: '40%' }}
                  options={outputTokenOptions}
                  aria-label="Output Token"
                  variant="borderless"
                  suffixIcon={null}
                />
              </Form.Item>
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

          <div className="mt-4">
            <Button
              type="primary"
              htmlType="submit"
              loading={isLoading}
              disabled={!isConnected}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:bg-gray-400"
            >
              {!isConnected ? 'Connect Wallet' : isLoading ? 'Getting Quote...' : 'Get Quote'}
            </Button>
          </div>

          {error && (
            <div className="mt-4">
              <div role="alert" className="rounded-lg bg-red-100 p-4 text-red-700">
                <div className="font-bold">Error</div>
                <div>{error.message}</div>
              </div>
            </div>
          )}
        </Form>
      </div>

      <Modal
        title="Settings"
        open={settingsVisible}
        onCancel={() => setSettingsVisible(false)}
        footer={null}
      >
        <Form.Item label="Output Chain" style={{ marginBottom: 16 }}>
          <Select
            value={selectedOutputChain}
            onChange={setSelectedOutputChain}
            options={SUPPORTED_CHAINS.map(chain => ({
              label: chain.name,
              value: chain.id,
            }))}
            aria-label="Output Chain"
          />
        </Form.Item>

        <Form.Item
          label="Slippage Tolerance (%)"
          name="slippageTolerance"
          rules={[{ required: true, message: 'Please enter slippage tolerance' }]}
        >
          <InputNumber
            style={{ width: '100%' }}
            min={0}
            max={100}
            step={0.1}
            precision={1}
            aria-label="Slippage Tolerance"
          />
        </Form.Item>
      </Modal>
    </>
  );
}
