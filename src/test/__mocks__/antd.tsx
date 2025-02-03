/* eslint-disable react-refresh/only-export-components */
import React from 'react';
import type { ComponentProps } from 'react';
import {
  Row as AntRow,
  Col as AntCol,
  Button as AntButton,
  Input as AntInput,
  Modal as AntModal,
  Form as AntForm,
  Tooltip as AntTooltip,
  Spin as AntSpin,
  InputNumber as AntInputNumber,
  Select as AntSelect,
  Space as AntSpace,
} from 'antd';
import { message } from './antd-message';

// Mock Row component to avoid responsive observer issues
export const Row = ({ children, ...props }: ComponentProps<typeof AntRow>) => (
  <div data-testid="ant-row" {...(props as React.HTMLAttributes<HTMLDivElement>)}>
    {children}
  </div>
);

// Mock Col component to avoid responsive observer issues
export const Col = ({ children, ...props }: ComponentProps<typeof AntCol>) => (
  <div data-testid="ant-col" {...(props as React.HTMLAttributes<HTMLDivElement>)}>
    {children}
  </div>
);

// Mock other components
export const Button = ({ children, ...props }: ComponentProps<typeof AntButton>) => (
  <button data-testid="ant-button" {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}>
    {children}
  </button>
);

export const Input = ({ ...props }: ComponentProps<typeof AntInput>) => (
  <input data-testid="ant-input" {...(props as React.InputHTMLAttributes<HTMLInputElement>)} />
);

export const Modal = ({ children, ...props }: ComponentProps<typeof AntModal>) => (
  <div data-testid="ant-modal" {...(props as React.HTMLAttributes<HTMLDivElement>)}>
    {children}
  </div>
);

export const Form = Object.assign(
  ({ children, ...props }: ComponentProps<typeof AntForm>) => (
    <form data-testid="ant-form" {...(props as React.FormHTMLAttributes<HTMLFormElement>)}>
      {children}
    </form>
  ),
  {
    Item: ({ children, ...props }: ComponentProps<typeof AntForm.Item>) => (
      <div data-testid="ant-form-item" {...(props as React.HTMLAttributes<HTMLDivElement>)}>
        {children as React.ReactNode}
      </div>
    ),
  }
);

export const Tooltip = ({ children, ...props }: ComponentProps<typeof AntTooltip>) => (
  <div data-testid="ant-tooltip" {...(props as React.HTMLAttributes<HTMLDivElement>)}>
    {children}
  </div>
);

export const Spin = ({ children, ...props }: ComponentProps<typeof AntSpin>) => (
  <div data-testid="ant-spin" {...(props as React.HTMLAttributes<HTMLDivElement>)}>
    {children}
  </div>
);

export const InputNumber = ({ ...props }: ComponentProps<typeof AntInputNumber>) => (
  <input
    type="number"
    data-testid="ant-input-number"
    {...(props as React.InputHTMLAttributes<HTMLInputElement>)}
  />
);

export const Select = Object.assign(
  ({ children, ...props }: ComponentProps<typeof AntSelect>) => (
    <select data-testid="ant-select" {...(props as React.SelectHTMLAttributes<HTMLSelectElement>)}>
      {children}
    </select>
  ),
  {
    Option: ({ children, ...props }: ComponentProps<typeof AntSelect.Option>) => (
      <option
        data-testid="ant-select-option"
        {...(props as React.OptionHTMLAttributes<HTMLOptionElement>)}
      >
        {children}
      </option>
    ),
  }
);

export const Space = ({ children, ...props }: ComponentProps<typeof AntSpace>) => (
  <div data-testid="ant-space" {...(props as React.HTMLAttributes<HTMLDivElement>)}>
    {children}
  </div>
);

export { message };
