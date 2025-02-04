import { Button, Form, InputNumber, Modal, Select, Space, Tooltip } from 'antd';
import { useState } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { SettingOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useCustomTokens } from '../hooks/useCustomTokens';
import { useCalibrator } from '../hooks/useCalibrator';
import { useTokens } from '../hooks/useTokens';
import { formatUnits, parseUnits } from 'viem';
import { Token, GetQuoteParams } from '../types';
import { useCompactMessage } from '../hooks/useCompactMessage';
import { useCompactSigner } from '../hooks/useCompactSigner';
import { useBroadcast } from '../hooks/useBroadcast';

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
  const { assembleMessagePayload } = useCompactMessage();
  const { signCompact } = useCompactSigner();
  const { broadcast } = useBroadcast();
  const [form] = Form.useForm<TradeFormValues>();
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [selectedOutputChain, setSelectedOutputChain] = useState(chainId);
  const [quoteParams, setQuoteParams] = useState<GetQuoteParams>();
  const [isSigning, setIsSigning] = useState(false);
  const { data: quote, isLoading, error } = useQuote(quoteParams);

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

  // Find output token to get decimals for formatting
  const outputToken = (outputTokens || []).find(
    token => token.address === form.getFieldValue('outputToken')
  );

  const handleFormSubmit = async (values: TradeFormValues) => {
    try {
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
    } catch (err) {
      console.error('Error in trade flow:', err);
      // message.error('Failed to process trade');
    } finally {
      setIsSigning(false);
    }
  };

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
          data-testid="trade-form"
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
                  id="inputAmount"
                />
              </Form.Item>
              <Form.Item name="inputToken" noStyle>
                <Select
                  style={{ width: '40%' }}
                  placeholder="Select token"
                  options={inputTokenOptions}
                  aria-label="Input Token"
                  id="inputToken"
                  data-testid="input-token-select"
                >
                  {allTokens.map((token: Token) => (
                    <Select.Option
                      key={token.address}
                      value={token.address}
                      data-testid={`token-option-${token.symbol}`}
                    >
                      {token.symbol}
                    </Select.Option>
                  ))}
                </Select>
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
                  placeholder="Select token"
                  options={outputTokenOptions}
                  aria-label="Output Token"
                  id="outputToken"
                  data-testid="output-token-select"
                >
                  {(outputTokens || []).map((token: Token) => (
                    <Select.Option
                      key={token.address}
                      value={token.address}
                      data-testid={`token-option-${token.symbol}`}
                    >
                      {token.symbol}
                    </Select.Option>
                  ))}
                </Select>
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

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              disabled={!isConnected || !quote || isSigning}
              loading={isLoading || isSigning}
              block
            >
              {!isConnected
                ? 'Connect Wallet'
                : isSigning
                  ? 'Signing...'
                  : isLoading
                    ? 'Getting Quote...'
                    : 'Swap'}
            </Button>
          </Form.Item>

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
