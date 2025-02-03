import { TokenBalances } from '../components/TokenBalances';
import { TradeForm } from '../components/TradeForm';
import { AddCustomToken } from '../components/AddCustomToken';

export default function Home() {
  return (
    <div className="container mx-auto p-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <TokenBalances />
          <div className="mt-4">
            <AddCustomToken />
          </div>
        </div>
        <div>
          <TradeForm />
        </div>
      </div>
    </div>
  );
}
