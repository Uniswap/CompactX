import { Form, Modal, Select, Space, InputNumber, Tooltip, Button } from 'antd';
import { InfoCircleOutlined, SettingOutlined } from '@ant-design/icons';
import { useAccount, useChainId } from 'wagmi';
import { formatUnits } from 'viem';
import { useState } from 'react';
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
  const [settingsForm] = Form.useForm();
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [selectedOutputChain, setSelectedOutputChain] = useState<number>(SUPPORTED_CHAINS[0].id);
  const [quoteParams, setQuoteParams] = useState<GetQuoteParams>();
  const [isSigning, setIsSigning] = useState(false);
  const { data: quote, isLoading, error } = useQuote(quoteParams);

  // Get input token for quote
  const inputToken = inputTokens.find(token => token.address === form.getFieldValue('inputToken'));
  const outputToken = outputTokens.find(
    token => token.address === form.getFieldValue('outputToken')
  );

  const handleFormSubmit = async (values: TradeFormValues) => {
    try {
      if (!inputToken || !selectedOutputChain || !outputToken) return;

      const slippageTolerance = settingsForm.getFieldValue('slippageTolerance') || 0.5;

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

  // Watch for form field changes
  const handleFieldsChange = () => {
    const values = form.getFieldsValue();
    const slippageTolerance = settingsForm.getFieldValue('slippageTolerance') || 0.5;

    if (values.inputToken && values.inputAmount && values.outputToken && selectedOutputChain) {
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
        onFieldsChange={handleFieldsChange}
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
                bordered={false}
                controls={false}
                stringMode
                precision={inputToken?.decimals ?? 18}
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
          {inputToken && <div className="mt-1 text-sm text-gray-500">${'0.00'}</div>}
        </div>

        <div className="flex justify-center">↓</div>

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
            <Space.Compact style={{ width: '40%' }}>
              <Select
                style={{ width: '60%', minWidth: '100px' }}
                placeholder="Chain"
                value={selectedOutputChain}
                onChange={value => {
                  setSelectedOutputChain(value);
                  form.setFieldValue('outputToken', undefined);
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

        <Button
          type="primary"
          htmlType="submit"
          loading={isSigning || isLoading}
          disabled={!form.getFieldValue('inputToken') || !form.getFieldValue('outputToken')}
          block
        >
          {isSigning ? 'Signing...' : isLoading ? 'Getting Quote...' : 'Swap'}
        </Button>
      </Form>

      <Modal
        title="Settings"
        open={settingsVisible}
        onCancel={() => setSettingsVisible(false)}
        footer={null}
      >
        <Form form={settingsForm} initialValues={{ slippageTolerance: 0.5 }}>
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
        </Form>
      </Modal>
    </div>
  );
}
