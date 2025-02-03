# CompactX Cross-Chain Swap Dapp: Architecture & Enhanced Specification

IMPORTANT: review this entire document before proceeding with development!

## 1. System Overview

This document specifies a frontend-only application that enables users to perform cross-chain token swaps. The focus is on getting a working proof-of-concept rather than implementing every possible feature. The application’s core flow and state dependencies are as follows:

### Core Dependencies and Services

1. **The Compact Contract (On-chain):**

   - Manages token locking and allocation for cross-chain swaps through compacts.
   - **Address:** `0x00000000000018DF021Ff2467dF97ff846E09f48` (deployed to Mainnet, Optimism, & Base)
   - **Code:** [The Compact](https://github.com/Uniswap/the-compact)

2. **Smallocator (Authentication & Signing):**

   - Manages user sessions and provides server-side signatures.
   - **API endpoint:** [https://smallocator.xyz](https://smallocator.xyz)
   - **Code:** \*\*[Smallocator](https://github.com/Uniswap/smallocator)

3. **The Compact Indexer (Balance Tracking):**

   - Tracks locked token balances by indexing events from The Compact.
   - **GraphQL endpoint:** [https://the-compact-indexer-2.ponder-dev.com/](https://the-compact-indexer-2.ponder-dev.com/)
   - **Code:** [The Compact Indexer](https://github.com/Uniswap/the-compact-indexer)

4. **Calibrator (Quote Service):**

   - Provides swap parameters and quotes.
   - **API endpoint:** [https://calibrat0r.com/](https://calibrat0r.com/)
   - **Code:** [Calibrator](https://github.com/Uniswap/calibrator)

5. **Broadcast Service:**
   - Handles broadcasting the final signed compact message to the network.
   - **API endpoint:** [https://broadcast-service.com/](https://broadcast-service.com/)
   - **Code:** [Broadcast Service](https://github.com/Uniswap/broadcast-service)

### State Flow Overview

- **Wallet Connection:**  
  Required for all operations. When a wallet is connected, it triggers balance refreshes and session checks.

- **User Session:**  
  Depends on the wallet connection and is required for swap operations (managed via Smallocator).

- **Token Balances:**  
  Fetched from two sources:

  - Direct wallet balances (via viem multicall and wagmi).
  - Locked balances (via The Compact Indexer using @tanstack/react-query).

- **Swap Parameters:**  
  User inputs include the input token and amount, output token, and slippage tolerance. The output token’s balance is also displayed.

- **Quote Data:**  
  Based on valid swap parameters; a call to the Calibrator API returns detailed quote information.

- **Signatures:**  
  A two-step process where Smallocator provides a server signature and then the user signs the payload (using EIP-712 via viem/wagmi).

---

## 2. Tools & Frameworks

To keep development simple and minimize unnecessary complexity, we are using the following tools:

- **Vite:** For a fast development server and production bundler.
- **React with TypeScript:** For building a robust, type-safe UI.
- **wagmi & RainbowKit:** For wallet connection, chain switching, and displaying wallet UI.
- **viem:** For blockchain interactions, including multicall to fetch direct token balances.
- **@tanstack/react-query:** For data fetching and caching (used in place of Apollo Client).
- **Axios** or the built-in **fetch API:** For making HTTP requests to external APIs.
- **ESLint & Prettier:** For enforcing code quality and formatting.
- **Jest** (or **Vitest** for React): For unit and integration testing.
- **Husky & lint-staged:** For pre-commit hooks.
- **GitHub Actions:** For continuous integration (CI) to run linting, type checking, and tests on every push/commit.

### Environment Variables

The application uses the following environment variables:

```
# WalletConnect Project ID (Required for wallet connections)
VITE_WALLETCONNECT_PROJECT_ID=""

# API Configuration
VITE_API_URL="http://localhost:3000"
VITE_API_TIMEOUT=30000

# Feature Flags
VITE_ENABLE_TESTNET=false
```

Copy `.env.example` to `.env` and fill in the required values. Get a WalletConnect Project ID from [WalletConnect Cloud](https://cloud.walletconnect.com/).

---

## 3. Type Definitions

These types should be used consistently throughout the application:

```typescript
// Token types
export interface Token {
  address: string;
  chainId: number;
  symbol: string;
  decimals: number;
}

// Balance types
export interface TokenBalance {
  token: Token;
  amount: bigint;
  locked: bigint;
}

// Quote types
export interface QuoteRequest {
  sponsor: string;
  inputTokenChainId: number;
  inputTokenAddress: string;
  inputTokenAmount: string;
  outputTokenChainId: number;
  outputTokenAddress: string;
  lockParameters: {
    allocatorId: string;
    resetPeriod: number;
    isMultichain: boolean;
  };
  context: {
    slippageBips: number;
    recipient: string;
    baselinePriorityFee: string;
    scalingFactor: string;
    expires: string;
  };
}

export interface QuoteResponse {
  quote: {
    inputTokenAmount: string;
    expectedOutputAmount: string;
    fee: string;
    estimatedGas: string;
    validUntil: string;
  };
}

// Signing types
export interface CompactMessage {
  arbiter: string;
  sponsor: string;
  nonce: string;
  expires: string;
  id: string;
  amount: string;
  witnessTypeString: string;
  witnessHash: string;
}

export interface SignedCompact extends CompactMessage {
  userSignature: string;
  smallocatorSignature: string;
}

// Application state
export interface SwapState {
  inputToken?: Token;
  outputToken?: Token;
  inputAmount?: string;
  slippageBips?: number;
  quote?: QuoteResponse;
  signedCompact?: SignedCompact;
}
```

---

## 4. Detailed API Payloads and Message Flows

Below is a detailed explanation of the payloads and flows for each external API. (For additional guidance, refer to the test files in the respective repositories.)

### 4.1. Smallocator (Session & Compact Signing)

The Smallocator API client is implemented in `src/api/smallocator.ts`. It provides a type-safe interface for all Smallocator endpoints and handles error cases appropriately. Usage example:

```typescript
import { smallocator } from '../api/smallocator';

// Get session payload
const sessionResponse = await smallocator.getSessionPayload(10, address);

// Create session with signed payload
const sessionId = await smallocator.createSession({
  signature,
  payload: sessionResponse.payload,
});

// Submit compact for signing
const compactResponse = await smallocator.submitCompact({
  chainId: '10',
  compact: compactMessage,
});
```

### 4.2. Broadcast Service

The broadcast service is implemented in `src/api/broadcast.ts`. It handles broadcasting the final signed compact message to the network. Usage example:

```typescript
import { broadcast } from '../api/broadcast';

// Broadcast final payload
const broadcastResponse = await broadcast.broadcast({
  finalPayload: {
    compact: compactMessage,
    userSignature,
    smallocatorSignature,
  },
});
```

#### Authentication Flow

- **Step 1: Get Session Payload (GET /session/:chainId/:address)**
  - **Request:**  
    URL: `/session/10/0xUserAddress` (example for Optimism)
  - **Response Example:**
    ```json
    {
      "payload": {
        "domain": "your-dapp-domain.com",
        "address": "0xUserAddress",
        "uri": "https://your-dapp-domain.com",
        "statement": "Sign in to Smallocator",
        "version": "1",
        "chainId": 10,
        "nonce": "unique_nonce_value",
        "issuedAt": "2025-02-03T10:00:00Z",
        "expirationTime": "2025-02-03T11:00:00Z"
      }
    }
    ```

````
- **Step 2: Create Session (POST /session)**
  - **Request Payload:**
    ```json
{
  "signature": "0xUserSignedSignature",
  "payload": {
    "domain": "your-dapp-domain.com",
    "address": "0xUserAddress",
    "uri": "https://your-dapp-domain.com",
    "statement": "Sign in to Smallocator",
    "version": "1",
    "chainId": 10,
    "nonce": "unique_nonce_value",
    "issuedAt": "2025-02-03T10:00:00Z",
    "expirationTime": "2025-02-03T11:00:00Z"
  }
}
````

- **Response Example:**
  ```json
  {
    "sessionId": "unique_session_id"
  }
  ```

````
#### Compact Message Signing Flow

- **Step 3: Submit Compact (POST /compact)**
  - **Request Payload Example:**
    ```json
{
  "chainId": "10",
  "compact": {
    "arbiter": "0xArbiterAddress",
    "sponsor": "0xUserAddress",
    "nonce": "0xUserAddressNonce",
    "expires": "1732520000",
    "id": "0xTokenIDForResourceLock",
    "amount": "1000000000000000000",
    "witnessTypeString": "ExampleWitness exampleWitness)ExampleWitness(uint256 foo, bytes32 bar)",
    "witnessHash": "0xWitnessHashValue"
  }
}
````

- **Response Example:**
  ```json
  {
    "hash": "0xComputedClaimHash",
    "signature": "0xSmallocatorSignature",
    "nonce": "0xUserAddressNonce"
  }
  ```

````
- **Step 4: Final User Signature (EIP-712)**
  - **Payload to Sign:**
    ```json
{
  "domain": {
    "name": "The Compact",
    "version": "1",
    "chainId": 10,
    "verifyingContract": "0x00000000000018DF021Ff2467dF97ff846E09f48"
  },
  "message": {
    "arbiter": "0xArbiterAddress",
    "sponsor": "0xUserAddress",
    "nonce": "0xUserAddressNonce",
    "expires": "1732520000",
    "id": "0xTokenIDForResourceLock",
    "amount": "1000000000000000000",
    "smallocatorSignature": "0xSmallocatorSignature"
  },
  "primaryType": "Compact",
  "types": {
    "EIP712Domain": [ ... ],
    "Compact": [ ... ]
  }
}
````

- **User Action:**  
  The user signs this payload using their wallet (via **viem**/wagmi), resulting in a signature (e.g., `"0xUserSignature"`).

- **Step 5: Broadcast the Final Payload (POST /broadcast)**
  - **Request Payload:**
    ```json
    {
      "finalPayload": {
        "compact": {
          "arbiter": "0xArbiterAddress",
          "sponsor": "0xUserAddress",
          "nonce": "0xUserAddressNonce",
          "expires": "1732520000",
          "id": "0xTokenIDForResourceLock",
          "amount": "1000000000000000000",
          "witnessTypeString": "ExampleWitness exampleWitness)ExampleWitness(uint256 foo, bytes32 bar)",
          "witnessHash": "0xWitnessHashValue"
        },
        "userSignature": "0xUserSignature",
        "smallocatorSignature": "0xSmallocatorSignature"
      }
    }
    ```

````
  - **Response Example:**
    ```json
{ "status": "success", "message": "Trade broadcasted successfully" }
```

### 4.2. Calibrator (Quote API)

- **Obtaining a Swap Quote (POST /quote)**
  - **Request Payload Example:**
    ```json
    {
      "sponsor": "0xUserAddress",
      "inputTokenChainId": 10,
      "inputTokenAddress": "0xInputTokenAddress",
      "inputTokenAmount": "1000000000000000000",
      "outputTokenChainId": 8453,
      "outputTokenAddress": "0xOutputTokenAddress",
      "lockParameters": {
        "allocatorId": "0xAllocatorId",
        "resetPeriod": 600,
        "isMultichain": false
      },
      "context": {
        "slippageBips": 100,
        "recipient": "0xUserAddress",
        "baselinePriorityFee": "1000000000",
        "scalingFactor": "1000000000100000000",
        "expires": "1732520000"
      }
    }
    ```

````

- **Response Payload Example:**
  ```json
  {
  "quote": {
  "inputTokenAmount": "1000000000000000000",
  "expectedOutputAmount": "990000000000000000",
  "fee": "10000000000000000",
  "estimatedGas": "21000",
  "validUntil": "1732520000"
  }
  }

````

---

## 5. Implementation Patterns & Component Architecture

### Component Hierarchy

The application follows a clear component hierarchy to manage complexity and maintain separation of concerns. The structure is organized as follows:

#### Root-Level Components

```typescript
// App.tsx - Root component
const App: React.FC = () => {
  return (
    <WagmiConfig>
      <RainbowKitProvider>
        <QueryClientProvider>
          <SwapStateProvider>
            <Layout>
              <SwapInterface />
            </Layout>
          </SwapStateProvider>
        </QueryClientProvider>
      </RainbowKitProvider>
    </WagmiConfig>
  );
};

// Layout.tsx - Main layout wrapper
const Layout: React.FC<PropsWithChildren> = ({ children }) => {
  return (
    <div>
      <Header />
      <main>{children}</main>
    </div>
  );
};
````

#### Feature Components

The main swap interface is composed of these key components:

```typescript
// SwapInterface.tsx - Main swap container
const SwapInterface: React.FC = () => {
  return (
    <div>
      <TokenBalances />
      <SwapForm />
      <QuoteDisplay />
      <ActionButton />
    </div>
  );
};

// Each component corresponds to a specific piece of functionality:
const TokenBalances: React.FC = () => {
  // Displays wallet and locked balances
};

const SwapForm: React.FC = () => {
  // Handles token selection and amount input
};

const QuoteDisplay: React.FC = () => {
  // Shows quote information when available
};

const ActionButton: React.FC = () => {
  // Changes state based on swap progress:
  // "Connect Wallet" -> "Enter Amount" -> "Get Quote" -> "Sign" -> "Broadcasting"
};
```

### State Management Pattern

The application uses a combination of React Context for global state and local component state for UI elements. Here's how different types of state should be managed:

```typescript
// src/state/SwapContext.tsx
interface SwapContextType {
  state: SwapState;
  dispatch: React.Dispatch<SwapAction>;
}

const SwapContext = createContext<SwapContextType | undefined>(undefined);

export const SwapStateProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const [state, dispatch] = useReducer(swapReducer, initialState);

  return (
    <SwapContext.Provider value={{ state, dispatch }}>
      {children}
    </SwapContext.Provider>
  );
};

// Reducer actions for state updates
type SwapAction =
  | { type: 'SET_INPUT_TOKEN'; payload: Token }
  | { type: 'SET_OUTPUT_TOKEN'; payload: Token }
  | { type: 'SET_INPUT_AMOUNT'; payload: string }
  | { type: 'SET_QUOTE'; payload: QuoteResponse }
  | { type: 'RESET_SWAP' };

// Hook for accessing swap state
export const useSwapState = () => {
  const context = useContext(SwapContext);
  if (!context) {
    throw new Error('useSwapState must be used within SwapStateProvider');
  }
  return context;
};
```

#### Data Fetching Pattern

Use React Query for all external data fetching. Here's the pattern to follow:

```typescript
// src/hooks/useTokenBalances.ts
export const useTokenBalances = (address: string, tokens: Token[]) => {
  return useQuery({
    queryKey: ['balances', address, tokens.map(t => t.address).join()],
    queryFn: async () => {
      // Fetch both direct and locked balances
      const [direct, locked] = await Promise.all([
        fetchDirectBalances(address, tokens),
        fetchLockedBalances(address, tokens),
      ]);
      return combineBalances(direct, locked);
    },
    enabled: Boolean(address && tokens.length),
    staleTime: 10000, // 10 seconds
  });
};

// src/hooks/useQuote.ts
export const useQuote = (params: QuoteRequest | null) => {
  return useQuery({
    queryKey: ['quote', params],
    queryFn: () => fetchQuote(params!),
    enabled: Boolean(params),
    staleTime: 5000, // 5 seconds
    retry: false, // Don't retry failed quotes
  });
};
```

### Error Handling Patterns

The application implements a comprehensive error handling strategy that maps API and blockchain errors to user-facing states:

#### API Error Mapping

```typescript
// src/utils/errors.ts
export class SwapError extends Error {
  constructor(
    message: string,
    public code: string,
    public action?: string
  ) {
    super(message);
  }
}

export const handleApiError = (error: unknown): SwapError => {
  if (axios.isAxiosError(error)) {
    // Map HTTP errors to specific swap errors
    switch (error.response?.status) {
      case 400:
        return new SwapError(
          'Invalid swap parameters',
          'INVALID_PARAMETERS',
          'Please check your input and try again'
        );
      case 429:
        return new SwapError(
          'Too many requests',
          'RATE_LIMIT',
          'Please wait a moment and try again'
        );
      // ... other cases
    }
  }

  if (error instanceof Error) {
    // Handle specific error types
    if (error.message.includes('insufficient balance')) {
      return new SwapError(
        'Insufficient balance',
        'INSUFFICIENT_BALANCE',
        'Please reduce your input amount'
      );
    }
  }

  return new SwapError('An unexpected error occurred', 'UNKNOWN_ERROR', 'Please try again later');
};
```

#### Error Boundaries

Implement error boundaries around major feature components:

```typescript
// src/components/ErrorBoundary.tsx
export class SwapErrorBoundary extends React.Component<
  PropsWithChildren,
  { error: Error | null }
> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div>
          <h3>Something went wrong</h3>
          <p>{this.state.error.message}</p>
          <button onClick={() => this.setState({ error: null })}>
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

### API Response Validation

Implement runtime validation for API responses using TypeScript type guards:

```typescript
// src/utils/validation.ts
export const isQuoteResponse = (data: unknown): data is QuoteResponse => {
  if (!data || typeof data !== 'object') return false;

  const quote = (data as QuoteResponse).quote;
  if (!quote) return false;

  return (
    typeof quote.inputTokenAmount === 'string' &&
    typeof quote.expectedOutputAmount === 'string' &&
    typeof quote.fee === 'string' &&
    typeof quote.estimatedGas === 'string' &&
    typeof quote.validUntil === 'string'
  );
};

// Usage in API calls
const fetchQuote = async (params: QuoteRequest): Promise<QuoteResponse> => {
  const response = await axios.post('/quote', params);

  if (!isQuoteResponse(response.data)) {
    throw new SwapError(
      'Invalid quote response format',
      'INVALID_RESPONSE',
      'Please try again later'
    );
  }

  return response.data;
};
```

By following these patterns, the application maintains a consistent structure and handles errors gracefully. Each component has a clear responsibility, and state management is predictable and type-safe.

Remember to implement error boundaries around major features and validate all API responses against their expected types. This ensures that runtime errors are caught and handled appropriately, providing a better user experience.

---

## 6. Initial Configuration

Begin with these simplified parameters for the proof-of-concept:

```typescript
const INITIAL_CONFIG = {
  supportedChains: [1, 10, 8453], // Mainnet, Optimism, Base
  tokens: [
    // Mainnet tokens
    {
      address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      symbol: 'WETH',
      decimals: 18,
      chainId: 1,
    },
    {
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      symbol: 'USDC',
      decimals: 6,
      chainId: 1,
    },
    // Optimism tokens
    {
      address: '0x4200000000000000000000000000000000000006',
      symbol: 'WETH',
      decimals: 18,
      chainId: 10,
    },
    {
      address: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
      symbol: 'USDC',
      decimals: 6,
      chainId: 10,
    },
    // Base tokens
    {
      address: '0x4200000000000000000000000000000000000006',
      symbol: 'WETH',
      decimals: 18,
      chainId: 8453,
    },
    {
      address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      symbol: 'USDC',
      decimals: 6,
      chainId: 8453,
    },
  ],
  defaultSlippage: 100, // 1%
  quoteRefreshInterval: 5000, // 5 seconds
  sessionRefreshThreshold: 600000, // 10 minutes
};

// src/config/chains.ts
import { mainnet, optimism, base } from 'wagmi/chains';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';

export const wagmiConfig = getDefaultConfig({
  appName: 'Cross-Chain Swap',
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
  chains: [mainnet, optimism, base],
});

interface ImportMetaEnv {
  VITE_WALLETCONNECT_PROJECT_ID: string;
  VITE_SMALLOCATOR_URL: string;
  VITE_CALIBRATOR_URL: string;
  VITE_INDEXER_URL: string;
  VITE_BROADCAST_URL: string;
}
```

---

## 7. Implementation Sequence & Development Notes

### Phase 1: Basic Setup and Wallet Connection

- **Tasks:**
  - Initialize the project with Vite and React.
  - Implement wallet connection using **wagmi/RainbowKit**.
  - Add chain switching (Ethereum, Optimism, & Base will be the initially supported chains).
  - Create the basic UI shell.
- **Success Criteria:**
  - Wallet connects successfully.
  - Chain can be switched.
  - Address and network status are displayed.

### Phase 2: Token Balance Display

- **Tasks:**
  - Implement balance fetching using **viem’s multicall** (for direct balances) and **@tanstack/react-query** (for locked balances from The Compact Indexer).
  - Create a balance display component.
  - Develop UI to allow users to add new tokens to their list; persist this list in **localStorage**.
  - Display the balance of the token the user intends to swap into.
- **Success Criteria:**
  - Balances update correctly on chain switch.
  - Both locked and direct balances are shown.
  - User-added tokens persist between sessions.
  - Loading and error states are properly handled.

### Phase 3: Quote Flow

- **Tasks:**
  - Implement a swap parameter form.
  - Add quote fetching by calling the **Calibrator API**.
  - Display quote details (expected output, fee, gas estimate, etc.).
- **Success Criteria:**
  - Quote updates on parameter changes.
  - Loading and error states are handled.
  - Invalid states are prevented.

### Phase 4: Signing Flow

- **Tasks:**
  - Implement session management with **smallocator**.
  - Request a server signature for the compact message.
  - Implement the user signature flow (using EIP-712 via **viem/wagmi**).
  - Combine signatures and broadcast the final payload using the **Broadcast Service**.
- **Success Criteria:**
  - Session persists as expected.
  - Signatures are combined correctly.
  - Broadcast completes successfully.
  - All error states are handled.

### Error Handling Requirements

Each operation should robustly handle error cases such as:

- **Wallet Connection:**  
  Network issues, wrong chain, user rejection, wallet disconnection.
- **Balance Fetching:**  
  RPC failures, contract errors, indexer unavailability, invalid response formats.
- **Quote Service:**  
  Service unavailability, invalid parameters, expired quotes, excessive price impact.
- **Signing Flow:**  
  Session expiration, invalid nonce, user rejection, broadcast failures.

### Development Notes

- **State Updates:**  
  Ensure that state updates are atomic; refresh all dependent data together.
- **React Query:**  
  Use **@tanstack/react-query** for all external data fetching.
- **Loading and Error States:**  
  Implement proper loading states and error boundaries around major components.
- **TypeScript:**  
  Enable strict mode and validate all API responses against the defined types.
- **Environment Variables:**  
  Use environment variables to configure API endpoints and RPC URLs.
- **LocalStorage:**  
  Cache user token lists and session data in localStorage for persistence.

---

## 8. Development Checklist & Step-by-Step Process

**_Note: As each task is completed, update the checklist items from `[ ]` to `[X]`._**

1. **Repository Initialization**

   - [x] **Create a new Git repository** (e.g., on GitHub).
   - [x] **Initialize with a Vite React TypeScript template:**
     ```bash
     npm create vite@latest . --template react-ts
     npm install
     ```

2. **Add Dependencies**

   - [x] **Install essential packages:**
     ```bash
     npm install wagmi viem @rainbow-me/rainbowkit @tanstack/react-query axios
     ```
   - [x] **Install development tools:**
     ```bash
     npm install -D typescript eslint prettier jest husky lint-staged
     ```

3. **TypeScript & Linter Configuration**

   - [x] **Configure `tsconfig.json`** with strict mode enabled.
   - [x] **Set up ESLint and Prettier:**  
          Create configuration files (e.g., `.eslintrc.js`, `.prettierrc`).
   - [x] **Commit all configuration files.**

4. **Initial Testing Setup**

   - [x] **Configure Jest (or Vitest) for unit and integration tests.**
   - [x] **Create sample test files** (e.g., `src/__tests__/sample.test.ts`) to verify basic utilities.
   - [x] **Run tests to ensure everything is working.**

5. **Pre-Commit Hooks & CI/CD**

   - [x] **Set up Husky and lint-staged:**  
          Configure pre-commit hooks to run:
     - Type checking (`tsc --noEmit`)
     - Linting (`eslint .`)
     - Tests (`npm run test`)
   - [x] **Configure GitHub Actions:**  
          Create a workflow file (e.g., `.github/workflows/ci.yml`) to run linting, type-checking, and tests on every commit/push.

6. **Feature Development (Keep Changes Small & Tested)**

   - **Authentication Module**
     - [x] **Implement wallet connection** using wagmi and RainbowKit.
     - [x] **Create API client modules for smallocator's authentication endpoints.**
     - [ ] **Write tests** for the sign-in flow and session storage.
   - **Balance Dashboard**
     - [ ] **Build components to display direct wallet balances** using viem (multicall) and wagmi hooks.
     - [ ] **Implement fetching of locked token balances** by querying The Compact Indexer using @tanstack/react-query.
     - [ ] **Provide a UI for users to add new tokens** to their list, saving this list in localStorage.
     - [ ] **Ensure the balance for the token being swapped into is displayed.**
     - [ ] **Write tests** to verify that token balances display correctly.
   - **Trade Widget**
     - [ ] **Develop a simple form** to capture:
       - Input token amount.
       - Dropdown for selecting the input token (from a hardcoded list that can be extended by the user).
       - Dropdown for selecting the output token (from a hardcoded list).
       - Slippage tolerance.
     - [ ] **Connect the form to call the Calibrator API** and fetch a quote.
     - [ ] **Write tests** to validate input handling and API response processing.
   - **Compact Message Signing & Broadcast Flow**
     - [ ] **Implement logic to assemble the compact message payload.**
     - [ ] **Create API calls to smallocator's `/compact` endpoint** and process the returned nonce and signature.
     - [ ] **Prompt the user to sign the payload** using EIP-712 (via viem/wagmi) and combine the signatures.
     - [ ] **Implement the broadcast step** by sending the final payload to the broadcast relay.
     - [ ] **Write tests** that simulate API responses (using mocks) to verify the complete signing flow.

7. **Final Integration & QA**

   - [ ] **Verify that individual modules** (authentication, balance display, trade widget, signing flow) function correctly in isolation.
   - [ ] **Conduct end-to-end tests** simulating the entire swap process with mocked external API responses.
   - [ ] **Commit changes frequently** with clear, descriptive messages and update checklist items (mark each as `[X]` when completed).

8. **Documentation**

   - [ ] **Update the README** with setup instructions, dependency details, and data flow diagrams.
   - [ ] **Document all API payload formats, expected responses, and module interfaces.**

9. **Deployment**
   - [ ] **Build the frontend using Vite's production build.**
   - [ ] **Deploy static files** to a hosting provider (e.g., Vercel or Netlify), ensuring correct configuration of environment variables (API endpoints, RPC URLs).
   - [ ] **Confirm that GitHub Actions continue enforcing quality standards** on every commit/push.

---

## 8. Final Reminders for Developers

- **Frontend-Only Architecture:**  
  All logic runs on the client. External APIs (smallocator, calibrator, indexer, broadcast) and blockchain interactions are invoked directly from the dapp.

- **Use the Prescribed Tooling:**

  - **Vite, React, TypeScript** for the application shell.
  - **wagmi** and **RainbowKit** for wallet connectivity.
  - **viem** for blockchain interactions (including multicall for token balance queries).
  - **@tanstack/react-query** for data fetching and caching.
  - **Axios/fetch** for HTTP requests.

- **User-Managed Token List:**  
  Provide a UI for users to add new tokens, save the list in localStorage, and merge it with the default token list on load.

- **Keep Changes Small and Tested:**  
  Each commit should focus on one small, well-defined change. Update the checklist items (change `[ ]` to `[X]`) as you complete each step, and always include tests for new features.

- **Continuous Integration:**  
  Use pre-commit hooks and GitHub Actions to enforce linting, type-checking, and testing. Always run your test suite locally before pushing changes.

- **Reference Earlier Work:**  
  The [the-compact-ui](https://github.com/Uniswap/the-compact-ui) repository contains useful ideas and functionality. Use it as a reference but tailor your implementation to our streamlined, frontend-only swap dapp design.

By following these detailed guidelines and the step-by-step checklist, you will build a robust, frontend-only dapp that enables users to execute cross-chain token swaps using external APIs and on-chain data.

As a final reminder — review the checklist, select the next uncompleted item, implement it along with a targeted set of tests, ensure that all tests, linters, and other steps are passing, mark it as completed in this document, and make a commit before moving on to the next checklist item. Do not make any changes to existing tests or dependencies unless absolutely necessary, staying focused on the task at hand and maintaining consistency with the rest of the codebase. This is the most important part of the process, as otherwise regressions may be introduced.

Happy coding!
