import { Asset, BigNumber, Humanizer, Transaction } from '@galacticcouncil/sdk';
import { DAY_MS, HOUR_MS, WEEK_MS } from '../../utils/time';

export enum DcaTab {
  TradeChart,
  DcaForm,
  DcaSettings,
  DcaPositions,
  SelectAsset,
}

export type DcaState = {
  inProgress: boolean;
  assetIn: Asset;
  assetOut: Asset;
  amountIn: string;
  balanceIn: string;
  interval: IntervalDca;
  intervalMultiplier: number;
  frequency: number;
  spotPrice: string;
  order: Dca;
  error: {};
};

export const DEFAULT_DCA_STATE: DcaState = {
  inProgress: false,
  assetIn: null,
  assetOut: null,
  amountIn: null,
  balanceIn: null,
  interval: 'day',
  intervalMultiplier: 1,
  frequency: null,
  spotPrice: null,
  order: null,
  error: {},
};

export const INTERVAL_DCA = ['hour', 'day', 'week'] as const;

export const INTERVAL_DCA_MS: Record<IntervalDca, number> = {
  hour: HOUR_MS,
  day: DAY_MS,
  week: WEEK_MS,
};

export type IntervalDca = (typeof INTERVAL_DCA)[number];

export interface Dca extends Humanizer {
  amountIn: BigNumber;
  frequency: number;
  frequencyMin: number;
  frequencyOpt: number;
  tradesNo: number;
  toTx(address: string, maxRetries: number): Transaction;
  toHuman(): any;
}
