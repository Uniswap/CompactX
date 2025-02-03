import { ConfigProvider } from 'antd';
import { TestWrapper } from '../test-wrapper';

export const AntWrapper = ({ children }: { children: React.ReactNode }) => (
  <ConfigProvider theme={{ hashed: false }}>
    <TestWrapper>{children}</TestWrapper>
  </ConfigProvider>
);
