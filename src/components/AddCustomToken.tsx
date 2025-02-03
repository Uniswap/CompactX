import { useState } from 'react';
import { useCustomTokens } from '../hooks/useCustomTokens';
import { useChainId } from 'wagmi';
import { Button, Input, Modal, Form, message } from 'antd';
import { isAddress } from 'viem';

interface FormValues {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
}

export function AddCustomToken() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const chainId = useChainId();
  const { addCustomToken } = useCustomTokens();
  const [form] = Form.useForm<FormValues>();

  const handleOpen = () => {
    setIsModalOpen(true);
  };

  const handleClose = () => {
    setIsModalOpen(false);
    form.resetFields();
  };

  const handleSubmit = async (values: FormValues) => {
    try {
      await addCustomToken({
        chainId,
        address: values.address,
        name: values.name,
        symbol: values.symbol,
        decimals: values.decimals,
      });
      message.success('Token added successfully');
      handleClose();
    } catch {
      message.error('Failed to add token');
    }
  };

  return (
    <>
      <Button type="primary" onClick={handleOpen}>
        Add Custom Token
      </Button>

      <Modal title="Add Custom Token" open={isModalOpen} onCancel={handleClose} footer={null}>
        <Form form={form} layout="vertical" onFinish={handleSubmit} autoComplete="off">
          <Form.Item
            label="Token Address"
            name="address"
            rules={[
              { required: true, message: 'Please input token address' },
              {
                validator: (_: unknown, value: string) =>
                  isAddress(value)
                    ? Promise.resolve()
                    : Promise.reject(new Error('Invalid address')),
              },
            ]}
          >
            <Input placeholder="0x..." />
          </Form.Item>

          <Form.Item
            label="Token Name"
            name="name"
            rules={[{ required: true, message: 'Please input token name' }]}
          >
            <Input placeholder="Token Name" />
          </Form.Item>

          <Form.Item
            label="Token Symbol"
            name="symbol"
            rules={[{ required: true, message: 'Please input token symbol' }]}
          >
            <Input placeholder="TOKEN" />
          </Form.Item>

          <Form.Item
            label="Decimals"
            name="decimals"
            rules={[
              { required: true, message: 'Please input token decimals' },
              {
                type: 'number',
                min: 0,
                max: 18,
                message: 'Decimals must be between 0 and 18',
              },
            ]}
          >
            <Input type="number" placeholder="18" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              Add Token
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
