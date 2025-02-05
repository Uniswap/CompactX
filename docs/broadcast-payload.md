# Broadcast Payload Documentation

This document describes the structure of the payload that is sent to the broadcast server at the end of a swap flow.

## Payload Structure

The broadcast server receives a payload with the following structure:

```typescript
interface BroadcastRequest {
  finalPayload: {
    chainId: string;
    compact: CompactMessage;
    sponsorSignature: string;
    allocatorSignature: string;
    context: Context;                // Additional swap context
  }
}

interface CompactMessage {
  arbiter: string;      // Address of the arbiter contract
  sponsor: string;      // Address of the sponsor
  nonce: string;        // Transaction nonce
  expires: string;      // Expiration timestamp
  id: string;           // Unique identifier for the swap
  amount: string;       // Amount of tokens to swap
  mandate: {
    chainId: number;             // Chain ID where the tribunal contract is deployed
    tribunal: string;            // Address of the tribunal contract
    recipient: string;           // Address to receive the tokens
    expires: string;             // Mandate expiration timestamp
    token: string;               // Token contract address
    minimumAmount: string;       // Minimum amount to receive
    baselinePriorityFee: string; // Base priority fee
    scalingFactor: string;       // Scaling factor for fees
    salt: string;                // Unique salt value (hex string)
  }
}

// Additional context information about the swap
interface Context {
  // Quote-related information
  dispensation: string;           // Dispensation amount
  dispensationUSD: string;        // USD value of the dispensation
  spotOutputAmount: string;       // Spot price output amount
  quoteOutputAmountDirect: string;// Direct quote output amount
  quoteOutputAmountNet: string;   // Net output amount after fees

  // Lock parameters
  allocatorId: string;            // ID of the allocator
  resetPeriod: number;            // Reset period for the lock
  isMultichain: boolean;          // Whether this is a multichain swap

  // Slippage information
  slippageBips: number;          // Slippage tolerance in basis points

  // Witness information
  witnessTypeString: string;      // EIP-712 type string for the mandate witness
  witnessHash: string;           // Hash of the mandate witness
}

## Field Descriptions

### Top Level
- `sponsorSignature`: The signature of the user who initiated the swap
- `allocatorSignature`: The signature from the allocator on the resource lock used to pay for the swap
- `chainId`: The ID of the blockchain network where the resource lock is located

### CompactMessage
- `arbiter`: The smart contract address that will process the claim
- `sponsor`: The address of the entity sponsoring the transaction
- `nonce`: A unique number provided by the allocator to prevent replay attacks
- `expires`: Timestamp when the swap request expires
- `id`: Unique identifier for the resource lock used to pay for the swap
- `amount`: The amount of tokens being swapped (in base units)

### Mandate
- `chainId`: The chain ID where the tribunal contract is deployed
- `tribunal`: The address of the tribunal contract that will be called on the output chain to settle the swap
- `recipient`: The address that will receive the output tokens
- `expires`: When the settlement must be completed
- `token`: The contract address of the token being received
- `minimumAmount`: The minimum acceptable amount of tokens to receive
- `baselinePriorityFee`: Base fee for determining the amount that must be provided by the filler based on the priority gas fee
- `scalingFactor`: Factor for scaling the amount that must be provided by the filler based on the priority gas fee
- `salt`: A unique value to ensure uniqueness of the mandate

### Context
Quote Information:
- `dispensation`: The amount of native tokens paid to relay the cross-chain message on settlement
- `dispensationUSD`: The USD value of the dispensation
- `spotOutputAmount`: The implied amount of tokens that would be received at spot price
- `quoteOutputAmountDirect`: The direct quote amount for the output tokens not including dispensation
- `quoteOutputAmountNet`: The net amount of tokens to be received after dispensation fees

Lock Parameters:
- `allocatorId`: Identifier for the allocator handling the swap
- `resetPeriod`: Time period after which the lock resets
- `isMultichain`: Flag indicating if the resource lock supports multichain compacts

Slippage and Fees:
- `slippageBips`: The user-provided slippage parameter in basis points (1 bip = 0.01%)

Witness Information:
- `witnessTypeString`: The EIP-712 type string for the mandate witness (format: "Mandate mandate)Mandate(uint256 chainId,address tribunal,address recipient,uint256 expires,address token,uint256 minimumAmount,uint256 baselinePriorityFee,uint256 scalingFactor,bytes32 salt)")
- `witnessHash`: The keccak256 hash of the mandate witness

## Example Usage

To implement a server that receives this payload:

1. Create an endpoint that accepts POST requests with the payload
2. Validate the signatures (both user and smallocator)
3. Verify the mandate hasn't expired
4. Process the swap according to the parameters
5. Return a success/failure response

Example endpoint structure:
```typescript
app.post('/broadcast', async (req, res) => {
  const { finalPayload } = req.body;
  const { compact, userSignature, smallocatorSignature, context } = finalPayload;
  
  // Validate signatures and process swap
  // ...

  res.json({ success: true });
});
```

## EIP-712 Type Definition

The Compact payload follows this exact EIP-712 type structure:
```solidity
Compact {
  address arbiter;
  address sponsor;
  uint256 nonce;
  uint256 expires;
  uint256 id;
  uint256 amount;
  Mandate mandate;
}

Mandate {
  uint256 chainId;
  address tribunal;
  address recipient;
  uint256 expires;
  address token;
  uint256 minimumAmount;
  uint256 baselinePriorityFee;
  uint256 scalingFactor;
  bytes32 salt;
}
```