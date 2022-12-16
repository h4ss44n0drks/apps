import { LitElement, html, css, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { choose } from 'lit/directives/choose.js';
import { when } from 'lit/directives/when.js';

import { baseStyles } from '../base.css';
import { createApi } from '../../chain';
import { DatabaseController } from '../../db.ctrl';
import { Chain, chainCursor, Account, accountCursor } from '../../db';
import { getFeePaymentAsset, getPaymentInfo } from '../../api/transaction';
import { getBestSell, getBestBuy } from '../../api/trade';
import { getAssetsBalance, getAssetsDollarPrice, getAssetsPairs } from '../../api/asset';
import { formatAmount, humanizeAmount, multipleAmounts } from '../../utils/amount';
import { SYSTEM_ASSET_ID } from '../../utils/chain';

import '@galacticcouncil/ui';
import { bnum, PoolAsset, PoolType, scale, TradeType, Transaction } from '@galacticcouncil/sdk';

import './select-token';
import './settings';
import './trade-tokens';

import {
  TradeScreen,
  ScreenState,
  AssetsState,
  TradeState,
  DEFAULT_SCREEN_STATE,
  DEFAULT_ASSETS_STATE,
  DEFAULT_TRADE_STATE,
} from './types';
import { TxInfo } from '../transaction/types';

@customElement('gc-trade-app')
export class TradeApp extends LitElement {
  private chain = new DatabaseController<Chain>(this, chainCursor);
  private ready: boolean = false;
  private ro = new ResizeObserver((entries) => {
    entries.forEach((entry) => {
      this.screen.height = entry.contentRect.height;
    });
  });
  private tx: Transaction = null;
  private disconnectSubscribeNewHeads: () => void = null;

  @state() screen: ScreenState = DEFAULT_SCREEN_STATE;
  @state() assets: AssetsState = DEFAULT_ASSETS_STATE;
  @state() trade: TradeState = DEFAULT_TRADE_STATE;

  @property({ type: String }) apiAddress: string = null;
  @property({ type: String }) accountAddress: string = null;
  @property({ type: String }) accountProvider: string = null;
  @property({ type: String }) accountName: string = null;
  @property({ type: String }) pools: string = null;
  @property({ type: String }) assetIn: string = null;
  @property({ type: String }) assetOut: string = null;
  @property({ type: String }) stableCoinAssetId: string = null;

  static styles = [
    baseStyles,
    css`
      :host {
        display: block;
        max-width: 520px;
        margin-left: auto;
        margin-right: auto;
        position: relative;
      }

      uigc-paper {
        width: 100%;
        display: block;
        border-radius: var(--uigc-app-border-radius);
      }
    `,
  ];

  isSwapSelected(): boolean {
    return this.trade.assetIn != null && this.trade.assetOut != null;
  }

  isSwapEmpty(): boolean {
    return this.trade.amountIn == null && this.trade.amountOut == null;
  }

  isEmptyAmount(amount: string): boolean {
    return amount == '' || amount == '0';
  }

  hasError(): boolean {
    return Object.keys(this.trade.error).length > 0;
  }

  changeScreen(active: TradeScreen) {
    this.screen.active = active;
    this.requestUpdate();
  }

  private calculateDollarPrice(asset: PoolAsset, amount: string) {
    if (this.stableCoinAssetId == asset.id) {
      return Number(amount).toFixed(2);
    }
    const usdPrice = this.assets.usdPrice.get(asset.id);
    return multipleAmounts(amount, usdPrice).toFixed(2);
  }

  async calculateBestSell(assetIn: PoolAsset, assetOut: PoolAsset, amountIn: string) {
    const { trade, transaction, slippage } = await getBestSell(assetIn, assetOut, amountIn);
    const amountInUsd = this.calculateDollarPrice(assetIn, trade.amountIn);
    const amountOutUsd = this.calculateDollarPrice(assetOut, trade.amountOut);

    const tradeState = Object.assign({}, trade);
    delete tradeState.amountIn; // Disable overriding of active asset amount (assetIn) if typing

    this.trade = {
      ...this.trade,
      inProgress: false,
      assetIn: assetIn,
      amountInUsd: humanizeAmount(amountInUsd),
      assetOut: assetOut,
      amountOutUsd: humanizeAmount(amountOutUsd),
      afterSlippage: slippage,
      ...tradeState,
    };
    this.tx = transaction;
    this.validateTrade(TradeType.Sell);
    this.validateEnoughBalance();
    console.log(trade);
  }

  async calculateBestBuy(assetIn: PoolAsset, assetOut: PoolAsset, amountOut: string) {
    const { trade, transaction, slippage } = await getBestBuy(assetIn, assetOut, amountOut);
    const amountInUsd = this.calculateDollarPrice(assetIn, trade.amountIn);
    const amountOutUsd = this.calculateDollarPrice(assetOut, trade.amountOut);

    const tradeState = Object.assign({}, trade);
    delete tradeState.amountOut; // Disable overriding of active asset amount (assetOut) if typing

    this.trade = {
      ...this.trade,
      inProgress: false,
      assetIn: assetIn,
      amountInUsd: humanizeAmount(amountInUsd),
      assetOut: assetOut,
      amountOutUsd: humanizeAmount(amountOutUsd),
      afterSlippage: slippage,
      ...tradeState,
    };
    this.tx = transaction;
    this.validateTrade(TradeType.Buy);
    this.validateEnoughBalance();
    console.log(trade);
  }

  switchAndReCalculateSell() {
    this.trade = {
      ...this.trade,
      inProgress: true,
      assetIn: this.trade.assetOut,
      assetOut: this.trade.assetIn,
      balanceIn: this.trade.balanceOut,
      balanceOut: this.trade.balanceIn,
      amountIn: this.trade.amountOut,
      amountOut: null,
    };
    this.calculateBestSell(this.trade.assetIn, this.trade.assetOut, this.trade.amountIn);
  }

  switchAndReCalculateBuy() {
    this.trade = {
      ...this.trade,
      inProgress: true,
      assetIn: this.trade.assetOut,
      assetOut: this.trade.assetIn,
      balanceIn: this.trade.balanceOut,
      balanceOut: this.trade.balanceIn,
      amountIn: null,
      amountOut: this.trade.amountIn,
    };
    this.calculateBestBuy(this.trade.assetIn, this.trade.assetOut, this.trade.amountOut);
  }

  switchAssets() {
    if (!this.isSwapSelected() || this.isSwapEmpty()) {
      this.trade = {
        ...this.trade,
        assetIn: this.trade.assetOut,
        assetOut: this.trade.assetIn,
        balanceIn: this.trade.balanceOut,
        balanceOut: this.trade.balanceIn,
        amountIn: this.trade.amountOut,
        amountOut: this.trade.amountIn,
      };
    } else if (this.trade.assetOut.symbol == this.assets.active) {
      this.switchAndReCalculateSell();
    } else if (this.trade.assetIn.symbol == this.assets.active) {
      this.switchAndReCalculateBuy();
    }
  }

  changeAssetIn(previous: string, asset: PoolAsset) {
    const assetIn = asset;
    const assetOut = this.trade.assetOut;

    // Change without recalculation if amount not set or pair not specified
    if (assetOut == null || this.isSwapEmpty()) {
      this.trade = {
        ...this.trade,
        assetIn: asset,
        balanceIn: null,
      };
      return;
    }

    if (previous == this.assets.active) {
      this.trade = {
        ...this.trade,
        inProgress: true,
        assetIn: asset,
        balanceIn: null,
        amountOut: null,
      };
      this.assets.active = assetIn.symbol;
      this.calculateBestSell(assetIn, assetOut, this.trade.amountIn);
    } else {
      this.trade = {
        ...this.trade,
        inProgress: true,
        assetIn: asset,
        balanceIn: null,
        amountIn: null,
      };
      this.calculateBestBuy(assetIn, assetOut, this.trade.amountOut);
    }
  }

  changeAssetOut(previous: string, asset: PoolAsset) {
    const assetIn = this.trade.assetIn;
    const assetOut = asset;

    // Change without recalculation if amount not set or pair not specified
    if (assetIn == null || this.isSwapEmpty()) {
      this.trade = {
        ...this.trade,
        assetOut: asset,
        balanceOut: null,
      };
      return;
    }

    if (previous == this.assets.active) {
      this.trade = {
        ...this.trade,
        inProgress: true,
        assetOut: asset,
        balanceOut: null,
        amountIn: null,
      };
      this.assets.active = assetOut.symbol;
      this.calculateBestBuy(assetIn, assetOut, this.trade.amountOut);
    } else {
      this.trade = {
        ...this.trade,
        inProgress: true,
        assetOut: asset,
        balanceOut: null,
        amountOut: null,
      };
      this.calculateBestSell(assetIn, assetOut, this.trade.amountIn);
    }
  }

  validateEnoughBalance() {
    const assetIn = this.trade.assetIn.id;
    const ammountIn = this.trade.amountIn;

    if (ammountIn == null) {
      return;
    }

    const balanceIn = this.assets.balance.get(assetIn);
    const amount = scale(bnum(ammountIn), balanceIn.decimals);
    if (amount.gt(balanceIn.amount)) {
      this.trade.error['balance'] = 'Your trade is bigger than your balance';
    } else {
      delete this.trade.error['balance'];
    }
    this.requestUpdate();
  }

  translateTradeError(error: string): string {
    switch (error) {
      case 'InsufficientTradingAmount':
        return 'Minimal trade limit is not reached';
      case 'MaxOutRatioExceeded':
        return 'Maximal pool trade limit is reached, please split your trade';
      case 'MaxInRatioExceeded':
        return 'Maximal pool trade limit is reached, please split your trade';
    }
  }

  validateTrade(type: TradeType) {
    if (this.trade.swaps.length === 0) {
      return;
    }
    const swaps = type == TradeType.Buy ? this.trade.swaps.reverse() : this.trade.swaps;
    const swapWithError: any = swaps.find((swap: any) => swap.errors.length > 0);
    if (swapWithError) {
      this.trade.error['trade'] = this.translateTradeError(swapWithError.errors[0]);
    } else {
      delete this.trade.error['trade'];
    }
  }

  resetAmounts() {
    this.trade = {
      ...this.trade,
      amountIn: null,
      amountInUsd: null,
      amountOut: null,
      amountOutUsd: null,
      spotPrice: null,
      error: [],
      swaps: [],
    };
  }

  updateAmountIn(amount: string) {
    // Wipe the trade info on input clear
    if (this.isEmptyAmount(amount)) {
      this.resetAmounts();
      return;
    }

    if (this.isSwapSelected()) {
      this.trade = {
        ...this.trade,
        inProgress: true,
        amountIn: amount,
        amountOut: null,
      };
      this.calculateBestSell(this.trade.assetIn, this.trade.assetOut, amount);
    } else {
      this.trade.amountIn = amount;
    }
  }

  updateAmountOut(amount: string) {
    // Wipe the trade info on input clear
    if (this.isEmptyAmount(amount)) {
      this.resetAmounts();
      return;
    }

    if (this.isSwapSelected()) {
      this.trade = {
        ...this.trade,
        inProgress: true,
        amountIn: null,
        amountOut: amount,
      };
      this.calculateBestBuy(this.trade.assetIn, this.trade.assetOut, amount);
    } else {
      this.trade.amountOut = amount;
    }
  }

  resetBalances() {
    this.trade.balanceIn = null;
    this.trade.balanceOut = null;
    this.assets.balance = new Map([]);
  }

  updateBalances() {
    const balanceIn = this.assets.balance.get(this.trade.assetIn?.id);
    const balanceOut = this.assets.balance.get(this.trade.assetOut?.id);
    this.trade = {
      ...this.trade,
      balanceIn: balanceIn && formatAmount(balanceIn.amount, balanceIn.decimals),
      balanceOut: balanceOut && formatAmount(balanceOut.amount, balanceOut.decimals),
    };
  }

  async syncBalances() {
    const account = accountCursor.deref();
    if (account) {
      this.assets.balance = await getAssetsBalance(account.address, this.assets.list);
      this.updateBalances();
    }
  }

  async syncDolarPrice() {
    this.assets.usdPrice = await getAssetsDollarPrice(this.assets.list, this.stableCoinAssetId);
  }

  async calculateTransactionFee(feeSystem: string, feeAssetId: string) {
    if (feeAssetId == SYSTEM_ASSET_ID) {
      return feeSystem;
    }

    const router = chainCursor.deref().router;
    const feeSystemAmount = feeSystem.split(' ')[0];
    const feeAssetSymbol = this.assets.map.get(feeAssetId).symbol;
    const feeAssetPrice = await router.getBestSpotPrice(SYSTEM_ASSET_ID, feeAssetId);
    const fee = multipleAmounts(feeSystemAmount, feeAssetPrice).toFixed(4);
    return fee + ' ' + feeAssetSymbol;
  }

  async syncTransactionFee() {
    const account = accountCursor.deref();
    if (account && this.tx) {
      const { partialFee } = await getPaymentInfo(this.tx, account);
      const feeAssetId = await getFeePaymentAsset(account);
      const feeSystem = partialFee.toHuman();
      this.trade.transactionFee = await this.calculateTransactionFee(feeSystem, feeAssetId);
      this.requestUpdate();
    }
  }

  notificationMessage(t: TradeState, status: string): string {
    const isSell: boolean = t.type == TradeType.Sell;
    const amountIn = t.amountIn;
    const assetIn = t.assetIn.symbol;
    const amountOut = t.amountOut;
    const assetOut = t.assetOut.symbol;
    return [
      t.type,
      humanizeAmount(isSell ? amountIn : amountOut),
      isSell ? assetIn : assetOut,
      'for',
      humanizeAmount(isSell ? amountOut : amountIn),
      isSell ? assetOut : assetIn,
      status,
    ].join(' ');
  }

  notificationTemplate(trade: TradeState, status: string): TemplateResult {
    const isSell: boolean = trade.type == TradeType.Sell;
    const amountIn = trade.amountIn;
    const assetIn = trade.assetIn.symbol;
    const amountOut = trade.amountOut;
    const assetOut = trade.assetOut.symbol;
    return html`
      ${when(
        status,
        () => html` <span>${trade.type}</span> `,
        () => html` <span>You ${isSell ? 'sold' : 'bought'}</span> `
      )}
      <span class="highlight">${humanizeAmount(isSell ? amountIn : amountOut)}</span>
      <span class="highlight">${isSell ? assetIn : assetOut}</span>
      <span>for</span>
      <span class="highlight">${humanizeAmount(isSell ? amountOut : amountIn)}</span>
      <span class="highlight">${isSell ? assetOut : assetIn}</span>
      <span>${status}</span>
    `;
  }

  processTx(account: Account, transaction: Transaction, trade: TradeState) {
    const notification = {
      processing: this.notificationTemplate(trade, 'submitted'),
      success: this.notificationTemplate(trade, null),
      failure: this.notificationTemplate(trade, 'failed'),
    };
    const options = {
      bubbles: true,
      composed: true,
      detail: { account: account, transaction: transaction, notification: notification } as TxInfo,
    };
    this.dispatchEvent(new CustomEvent<TxInfo>('gc:tx:new', options));
  }

  async swap() {
    const account = accountCursor.deref();
    if (account && this.tx) {
      this.processTx(account, this.tx, this.trade);
    }
  }

  async init() {
    const router = chainCursor.deref().router;
    const assets = await router.getAllAssets();
    const assetsPairs = await getAssetsPairs(assets);

    this.assets = {
      ...this.assets,
      list: assets,
      map: new Map<string, PoolAsset>(assets.map((i) => [i.id, i])),
      pairs: assetsPairs,
    };
    this.initAssets();
  }

  initAssets() {
    if (this.assetIn == null && this.assetOut == null) {
      this.trade.assetIn = this.assets.map.get(SYSTEM_ASSET_ID);
      return;
    }

    if (this.assetIn) {
      this.trade.assetIn = this.assets.map.get(this.assetIn);
    }
    if (this.assetOut) {
      this.trade.assetOut = this.assets.map.get(this.assetOut);
    }
  }

  async subscribe() {
    const api = chainCursor.deref().api;
    this.disconnectSubscribeNewHeads = await api.rpc.chain.subscribeNewHeads(async (lastHeader) => {
      console.log('Current block: ' + lastHeader.number.toString());
      this.syncBalances();
      this.syncDolarPrice();
      this.syncTransactionFee();
    });
  }

  override async firstUpdated() {
    const pools = this.pools ? this.pools.split(',') : [];
    const chain = chainCursor.deref();
    if (!chain) {
      createApi(this.apiAddress, pools as PoolType[], () => {});
    }
  }

  private updateAccount() {
    const account = accountCursor.deref();
    accountCursor.reset({
      address: this.accountAddress ?? account?.address,
      provider: this.accountProvider ?? account?.provider,
      name: this.accountName ?? account?.name,
    } as Account);
  }

  override update(changedProperties: Map<string, unknown>) {
    if (
      changedProperties.has('accountAddress') ||
      changedProperties.has('accountProvider') ||
      changedProperties.has('accountName')
    ) {
      this.updateAccount();
      this.resetBalances();
    }
    super.update(changedProperties);
  }

  override async updated() {
    if (this.chain.state && !this.ready) {
      console.log('Initialization...');
      this.ready = true;
      await this.init();
      await this.subscribe();
      console.log('Done ✅');
    }
  }

  override connectedCallback() {
    super.connectedCallback();
    this.ro.observe(this);
  }

  override disconnectedCallback() {
    this.ro.unobserve(this);
    this.disconnectSubscribeNewHeads?.();
    super.disconnectedCallback();
  }

  settingsTenplate() {
    return html`<gc-trade-app-settings
      style="height: ${this.screen.height}px"
      @back-clicked=${() => this.changeScreen(TradeScreen.TradeTokens)}
    ></gc-trade-app-settings>`;
  }

  selectTokenTenplate() {
    return html`<gc-trade-app-select
      style="height: ${this.screen.height}px"
      .assets=${this.assets.list}
      .pairs=${this.assets.pairs}
      .balances=${this.assets.balance}
      .usdPrice=${this.assets.usdPrice}
      .assetIn=${this.trade.assetIn?.symbol}
      .assetOut=${this.trade.assetOut?.symbol}
      .selector=${this.assets.selector}
      @back-clicked=${() => this.changeScreen(TradeScreen.TradeTokens)}
      @asset-clicked=${(e: CustomEvent) => {
        const { id, asset } = this.assets.selector;
        id == 'assetIn' && this.changeAssetIn(asset, e.detail);
        id == 'assetOut' && this.changeAssetOut(asset, e.detail);
        this.updateBalances();
        this.changeScreen(TradeScreen.TradeTokens);
      }}
    ></gc-trade-app-select>`;
  }

  tradeTokensTenplate() {
    return html`<gc-trade-app-main
      .assets=${this.assets.map}
      .inProgress=${this.trade.inProgress}
      .disabled=${!this.isSwapSelected() || this.isSwapEmpty() || this.hasError()}
      .tradeType=${this.trade.type}
      .assetIn=${this.trade.assetIn?.symbol}
      .assetOut=${this.trade.assetOut?.symbol}
      .amountIn=${this.trade.amountIn}
      .amountInUsd=${this.trade.amountInUsd}
      .amountOut=${this.trade.amountOut}
      .amountOutUsd=${this.trade.amountOutUsd}
      .balanceIn=${this.trade.balanceIn}
      .balanceOut=${this.trade.balanceOut}
      .spotPrice=${this.trade.spotPrice}
      .afterSlippage=${this.trade.afterSlippage}
      .priceImpactPct=${this.trade.priceImpactPct}
      .tradeFee=${this.trade.tradeFee}
      .tradeFeePct=${this.trade.tradeFeePct}
      .transactionFee=${this.trade.transactionFee}
      .error=${this.trade.error}
      .swaps=${this.trade.swaps}
      @asset-input-changed=${({ detail: { id, asset, value } }: CustomEvent) => {
        this.assets.active = asset;
        id == 'assetIn' && this.updateAmountIn(value);
        id == 'assetOut' && this.updateAmountOut(value);
        this.validateEnoughBalance();
      }}
      @asset-selector-clicked=${({ detail }: CustomEvent) => {
        this.assets.selector = detail;
        this.changeScreen(TradeScreen.SelectToken);
      }}
      @asset-switch-clicked=${this.switchAssets}
      @settings-clicked=${() => this.changeScreen(TradeScreen.Settings)}
      @swap-clicked=${() => this.swap()}
    ></gc-trade-app-main>`;
  }

  render() {
    return html`
      <uigc-paper>
        ${choose(this.screen.active, [
          [TradeScreen.TradeTokens, () => this.tradeTokensTenplate()],
          [TradeScreen.Settings, () => this.settingsTenplate()],
          [TradeScreen.SelectToken, () => this.selectTokenTenplate()],
        ])}
      </uigc-paper>
    `;
  }
}
