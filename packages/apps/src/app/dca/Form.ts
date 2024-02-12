import { html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';
import { classMap, ClassInfo } from 'lit/directives/class-map.js';

import * as i18n from 'i18next';

import { BaseElement } from 'element/BaseElement';
import { Account, AccountCursor, DcaConfig, DcaConfigCursor } from 'db';
import { DatabaseController } from 'db.ctrl';
import { baseStyles } from 'styles/base.css';
import { formStyles } from 'styles/form.css';
import { humanizeAmount } from 'utils/amount';

import { INTERVAL_DCA, IntervalDca } from './types';

import { Asset } from '@galacticcouncil/sdk';

@customElement('gc-dca-form')
export class DcaForm extends BaseElement {
  private account = new DatabaseController<Account>(this, AccountCursor);
  private settings = new DatabaseController<DcaConfig>(this, DcaConfigCursor);

  @property({ attribute: false }) assets: Map<string, Asset> = new Map([]);
  @property({ type: Boolean }) inProgress = false;
  @property({ type: Boolean }) disabled = false;
  @property({ type: Boolean }) loaded = false;
  @property({ type: Object }) assetIn: Asset = null;
  @property({ type: Object }) assetOut: Asset = null;
  @property({ type: String }) interval: IntervalDca = '1h';
  @property({ type: Number }) intervalBlock: number = null;
  @property({ type: String }) amountIn = null;
  @property({ type: String }) amountInUsd = null;
  @property({ type: String }) amountInBudget = null;
  @property({ type: String }) balanceIn = null;
  @property({ type: String }) maxPrice = null;
  @property({ type: String }) slippagePct = '5';
  @property({ type: String }) tradeFee = '0';
  @property({ type: String }) tradeFeePct = '0';
  @property({ type: String }) est = null;
  @property({ attribute: false }) error = {};

  @state() advanced: boolean = false;

  static styles = [
    baseStyles,
    formStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
      }

      .invest {
        display: flex;
        position: relative;
        flex-direction: column;
        padding: 0 14px;
        gap: 14px;
        box-sizing: border-box;
      }

      .interval {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
      }

      @media (max-width: 480px) {
        .interval {
          padding: 0 14px;
        }
      }

      .interval span {
        color: var(--hex-white);
        font-style: normal;
        font-weight: 500;
        font-size: 14px;
        line-height: 100%;
        margin-bottom: 10px;
      }

      .interval uigc-toggle-button-group {
        width: 100%;
      }

      .adornment {
        white-space: nowrap;
        font-weight: 500;
        font-size: 14px;
        line-height: 14px;
        color: #ffffff;
      }

      @media (max-width: 480px) {
        .invest {
          padding: 0;
        }
      }

      @media (min-width: 768px) {
        .invest {
          padding: 0 28px;
        }
      }

      .hidden {
        display: none;
      }

      uigc-asset {
        padding: 5px;
      }
    `,
  ];

  private getEstDate(): string {
    if (!this.amountIn || !this.amountInBudget) {
      return null;
    }

    const aIn = Number(this.amountIn);
    const aInbudget = Number(this.amountInBudget);
    const reps = Math.floor(aInbudget / aIn);
    return this._dayjs()
      .add(reps * this.est, 'millisecond')
      .format('DD-MM-YYYY HH:mm');
  }

  private getEstTime(): string {
    if (this.intervalBlock && this.est) {
      return this._humanizer.humanize(this.est, { round: true, largest: 2 });
    } else {
      return null;
    }
  }

  private toggleAdvanced() {
    this.advanced = !this.advanced;
  }

  onScheduleClick(e: any) {
    const options = {
      bubbles: true,
      composed: true,
    };
    this.dispatchEvent(new CustomEvent('schedule-click', options));
  }

  onMaxPriceChange(e: any) {
    const options = {
      bubbles: true,
      composed: true,
      detail: { id: 'maxPrice', asset: e.detail.asset, value: e.detail.value },
    };
    this.dispatchEvent(new CustomEvent('asset-input-change', options));
  }

  onIntervalChange(e: any) {
    const options = {
      bubbles: true,
      composed: true,
      detail: { value: e.detail.value },
    };
    this.dispatchEvent(new CustomEvent('interval-change', options));
  }

  onIntervalBlockChange(e: any) {
    const options = {
      bubbles: true,
      composed: true,
      detail: { value: e.detail.value },
    };
    this.dispatchEvent(new CustomEvent('interval-block-change', options));
  }

  infoSummaryTemplate() {
    const int = this.intervalBlock
      ? this.getEstTime()
      : this.interval.toLowerCase();
    return html`
      <span class="label">${i18n.t('form.summary')}</span>
      <span>
        <span class="value">Spend</span>
        <span class="value highlight">
          ${this.amountIn} ${this.assetIn?.symbol}
        </span>
        <span class="value">
          every ~${int} to buy ${this.assetOut?.symbol} with a total budget of
        </span>
        <span class="value highlight">
          ${this.amountInBudget} ${this.assetIn?.symbol}
        </span>
      </span>
    `;
  }

  infoSlippageTemplate() {
    return html`
      <span class="label">${i18n.t('dca.summary.slippage')}</span>
      <span class="grow"></span>
      ${when(
        this.inProgress,
        () =>
          html`
            <uigc-skeleton
              progress
              rectangle
              width="80px"
              height="12px"></uigc-skeleton>
          `,
        () =>
          html`
            <span class="value">${this.settings.state.slippage}%</span>
          `,
      )}
    `;
  }

  infoEstEndDateTemplate() {
    const estDate = this.getEstDate();
    return html`
      <span class="label">${i18n.t('dca.summary.estSchedule')}</span>
      <span class="grow"></span>
      ${when(
        this.inProgress,
        () =>
          html`
            <uigc-skeleton
              progress
              rectangle
              width="80px"
              height="12px"></uigc-skeleton>
          `,
        () =>
          html`
            <span class="value">${estDate || '-'}</span>
          `,
      )}
    `;
  }

  formAssetTemplate(asset: Asset, slot?: string) {
    if (this.loaded) {
      return html`
        <gc-asset-id
          slot=${slot}
          .asset=${asset}
          .assets=${this.assets}></gc-asset-id>
      `;
    }
    return this.formAssetLoadingTemplate(slot);
  }

  formAssetBalanceTemplate(balance: string) {
    return html`
      <uigc-asset-balance
        slot="balance"
        .balance=${balance}
        .visible=${false}
        .formatter=${humanizeAmount}></uigc-asset-balance>
    `;
  }

  formAssetLoadingTemplate(slot?: string) {
    return html`
      <div class="loading" slot=${slot}>
        <uigc-skeleton
          circle
          progress
          width="32px"
          height="32px"></uigc-skeleton>
        <span class="title">
          <uigc-skeleton
            progress
            rectangle
            width="40px"
            height="16px"></uigc-skeleton>
          <uigc-skeleton
            progress
            rectangle
            width="50px"
            height="8px"></uigc-skeleton>
        </span>
      </div>
    `;
  }

  formAssetInTemplate() {
    const error = this.error['minAmountTooLow'];
    return html`
      <uigc-asset-transfer
        id="assetIn"
        title="Swap"
        ?readonly=${!this.loaded}
        .readonly=${!this.loaded}
        ?selectable=${this.loaded}
        .selectable=${this.loaded}
        ?error=${error}
        .error=${error}
        dense
        .asset=${this.assetIn?.symbol}
        .amount=${this.amountIn}
        .amountUsd=${this.amountInUsd}>
        ${this.formAssetTemplate(this.assetIn, 'asset')}
      </uigc-asset-transfer>
    `;
  }

  formIntervalTemplate() {
    return html`
      <div class="interval">
        <span>Every</span>
        <uigc-toggle-button-group
          .value=${this.intervalBlock ? null : this.interval}
          @toggle-button-click=${(e: CustomEvent) => {
            this.onIntervalChange(e);
          }}>
          ${INTERVAL_DCA.map(
            (s: string) =>
              html`
                <uigc-toggle-button tab value=${s}>
                  ${s.toUpperCase()}
                </uigc-toggle-button>
              `,
          )}
        </uigc-toggle-button-group>
      </div>
    `;
  }

  formAssetOutTemplate() {
    return html`
      <uigc-selector
        title="For"
        ?readonly=${!this.loaded}
        .readonly=${!this.loaded}
        .item=${this.assetOut?.symbol}>
        ${this.formAssetTemplate(this.assetOut)}
      </uigc-selector>
    `;
  }

  formMaxBudgetTemplate() {
    const error =
      this.error['balanceTooLow'] ||
      this.error['budgetTooLow'] ||
      this.error['minBudgetTooLow'];
    return html`
      <uigc-asset-transfer
        id="assetInBudget"
        title=${i18n.t('form.budget.label')}
        ?readonly=${!this.loaded}
        .readonly=${!this.loaded}
        ?error=${error}
        .error=${error}
        dense
        asset=${this.assetIn?.symbol}
        unit=${this.assetIn?.symbol}
        amount=${this.amountInBudget}
        .selectable=${false}>
        ${this.formAssetTemplate(this.assetIn, 'asset')}
        ${this.formAssetBalanceTemplate(this.balanceIn)}
      </uigc-asset-transfer>
    `;
  }

  formAdvancedSwitch() {
    return html`
      <div class="form-switch">
        <div>
          <span class="title">${i18n.t('form.advanced')}</span>
          <span class="desc">${i18n.t('form.advanced.desc')}</span>
        </div>
        <uigc-switch
          .checked=${this.advanced}
          size="small"
          @click=${() => this.toggleAdvanced()}></uigc-switch>
      </div>
    `;
  }

  formBlockPeriodTemplate(classInfo: ClassInfo) {
    return html`
      <uigc-textfield
        class=${classMap(classInfo)}
        field
        number
        ?error=${this.error['blockPeriodInvalid']}
        .error=${this.error['blockPeriodInvalid']}
        .placeholder=${0}
        .value=${this.intervalBlock}
        .desc=${this.getEstTime()}
        @input-change=${(e: CustomEvent) => this.onIntervalBlockChange(e)}>
        <span class="adornment" slot="inputAdornment">
          ${i18n.t('form.advanced.interval')}
        </span>
      </uigc-textfield>
    `;
  }

  render() {
    const isValid =
      this.amountIn &&
      this.amountInBudget &&
      Object.keys(this.error).length == 0;
    const infoClasses = {
      info: true,
      show: isValid,
    };
    const advancedClasses = {
      hidden: this.advanced == false,
    };
    return html`
      <slot name="header"></slot>
      <div class="invest">
        ${this.formAssetInTemplate()} ${this.formIntervalTemplate()}
        ${this.formAssetOutTemplate()} ${this.formMaxBudgetTemplate()}
        ${this.formAdvancedSwitch()}
        ${this.formBlockPeriodTemplate(advancedClasses)}
      </div>
      <div class=${classMap(infoClasses)}>
        <div class="row summary show">${this.infoSummaryTemplate()}</div>
        <div class="row">${this.infoEstEndDateTemplate()}</div>
        <div class="row">${this.infoSlippageTemplate()}</div>
      </div>
      <uigc-button
        ?disabled=${this.disabled || !this.account.state}
        class="confirm"
        variant="info"
        fullWidth
        @click=${this.onScheduleClick}>
        ${this.account.state
          ? i18n.t('form.cta.schedule')
          : i18n.t('form.cta.connect')}
      </uigc-button>
    `;
  }
}