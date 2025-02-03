import { useTokenBalances } from '../hooks/useTokenBalances';

export function TokenBalances() {
  const { balances } = useTokenBalances();

  return (
    <div>
      <div>
        <span>Native Balance: </span>
        <span>{(balances.native ?? 0n).toString()}</span>
      </div>
    </div>
  );
}
