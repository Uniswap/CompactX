# TradeForm Component Test Requirements

## Component Overview

The TradeForm component is a critical part of the CompactX application that handles token swapping functionality. It includes input/output token selection, amount entry, quote fetching, and swap execution.

## Test Cases and Requirements

### 1. Input Amount Changes

**Test**: `should handle input amount changes`

- Verify that users can enter numerical values into the input amount field
- Ensure the input updates the UI correctly
- Confirm that the quote is requested when amount changes
- Validate that the input accepts valid numbers and handles invalid inputs appropriately

### 2. Loading State

**Test**: `should show "Getting Quote..." during loading`

- Verify that a loading indicator appears while fetching a quote
- Ensure the loading state is triggered when:
  - Input token is selected
  - Output token is selected
  - Amount is changed
- Confirm the loading state is cleared when quote is received

### 3. Error Handling

**Test**: `should handle quote error state`

- Verify appropriate error messages are displayed when quote fetching fails
- Ensure the UI handles error states gracefully
- Confirm that users can recover from error states by:
  - Changing input/output tokens
  - Modifying amounts
  - Retrying the quote

### 4. Swap Execution

**Test**: `should handle swap execution`

- Verify that the swap button is enabled when a valid quote exists
- Ensure proper handling of the swap transaction:
  - Transaction submission
  - Loading states during transaction
  - Success/failure notifications
- Confirm the form resets appropriately after successful swap

## Test Setup Requirements

### Environment Setup

1. Portal Container
   - Create a dedicated portal container for Ant Design dropdowns
   - Clean up portal container after each test

### Mocked Dependencies

1. Token Selection

   - Mock available tokens list
   - Mock token balances
   - Mock price data

2. Network Interactions
   - Mock wallet connection state
   - Mock quote fetching
   - Mock transaction broadcasting

### User Interaction Helpers

1. Token Selection

   ```typescript
   selectInputToken(); // Helper to select input token
   selectOutputToken(); // Helper to select output token
   ```

2. Amount Entry
   ```typescript
   enterAmount(); // Helper to enter swap amount
   ```

## Current Issues

The main challenge appears to be with the dropdown testing implementation:

1. Dropdowns are not being found in the DOM after opening
2. This affects all tests that require token selection
3. The issue might be related to:
   - Timing of dropdown rendering
   - Portal container setup
   - Ant Design's dropdown implementation
   - Test environment configuration

## Next Steps

1. Verify portal container setup is working correctly
2. Review dropdown rendering lifecycle
3. Consider adding additional waiting/assertion logic for dropdown visibility
4. May need to modify how we interact with Ant Design dropdowns in tests
5. Consider adding debugging logs to track dropdown rendering state
