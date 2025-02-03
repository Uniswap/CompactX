import React from 'react'
import { Row as AntRow, Col as AntCol } from 'antd'

// Mock Row component to avoid responsive observer issues
export const Row = ({ children, ...props }: React.ComponentProps<typeof AntRow>) => (
  <div data-testid="ant-row" {...props}>
    {children}
  </div>
)

// Mock Col component to avoid responsive observer issues
export const Col = ({ children, ...props }: React.ComponentProps<typeof AntCol>) => (
  <div data-testid="ant-col" {...props}>
    {children}
  </div>
)

// Re-export everything else from antd
export * from 'antd'
