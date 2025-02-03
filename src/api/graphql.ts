import { useQuery } from '@tanstack/react-query';

const BALANCES_QUERY = `
  query GetAccountBalances($address: String!) {
    account(address: $address) {
      depositor: address
      tokenBalances(orderBy: "balance", orderDirection: "DESC") {
        items {
          token {
            name
            symbol
            decimals
            chainId
            tokenAddress
            totalSupply
          }
          aggregateBalance: balance
          resourceLocks(orderBy: "balance", orderDirection: "DESC") {
            items {
              resourceLock {
                name
                symbol
                decimals
                lockId
                allocator {
                  account: allocatorAddress
                }
                resetPeriod
                isMultichain
                totalSupply
              }
              withdrawableAt
              withdrawalStatus 
              balance
            }
            pageInfo {
              startCursor
              endCursor
              hasPreviousPage
              hasNextPage
            }
            totalCount
          }
        }
        pageInfo {
          startCursor
          endCursor
          hasPreviousPage
          hasNextPage
        }
        totalCount
      }
    }
  }
`;

export interface PageInfo {
  startCursor: string | null;
  endCursor: string | null;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface Token {
  name: string;
  symbol: string;
  decimals: number;
  chainId: number;
  tokenAddress: string;
  totalSupply: string;
}

export interface ResourceLock {
  name: string;
  symbol: string;
  decimals: number;
  lockId: string;
  allocator: {
    account: string;
  };
  resetPeriod: number;
  isMultichain: boolean;
  totalSupply: string;
}

export interface ResourceLockBalance {
  resourceLock: ResourceLock;
  withdrawableAt: string;
  withdrawalStatus: string;
  balance: string;
}

export interface ResourceLockConnection {
  items: ResourceLockBalance[];
  pageInfo: PageInfo;
  totalCount: number;
}

export interface TokenBalance {
  token: Token;
  aggregateBalance: string;
  resourceLocks: ResourceLockConnection;
}

export interface TokenBalanceConnection {
  items: TokenBalance[];
  pageInfo: PageInfo;
  totalCount: number;
}

export interface Account {
  depositor: string;
  tokenBalances: TokenBalanceConnection;
}

export interface BalancesResponse {
  account: Account;
}

export const GRAPHQL_ENDPOINT =
  process.env.VITE_GRAPHQL_ENDPOINT || 'https://api.compact.tech/graphql';

export async function fetchBalances(address: string): Promise<BalancesResponse> {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: BALANCES_QUERY,
      variables: { address },
    }),
  });

  if (!response.ok) {
    throw new Error('Network response was not ok');
  }

  const json = await response.json();
  if (json.errors) {
    throw new Error(json.errors[0].message);
  }

  return json.data;
}

export function useLockedBalances(address?: string) {
  return useQuery({
    queryKey: ['balances', address],
    queryFn: () => (address ? fetchBalances(address) : Promise.reject('No address provided')),
    enabled: !!address,
  });
}
