import { html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { UIGCElement } from './base/UIGCElement';

import './logo/AssetLogo';
import './logo/ChainLogo';
import './logo/PlaceholderLogo';
import './icons/Warning';
import './Popper';

@customElement('uigc-asset-id')
export class AssetId extends UIGCElement {
  @property({ type: String }) symbol = null;
  @property({ type: String }) chain = null;
  @property({ type: String }) warning = null;

  static styles = [
    css`
      :host {
        position: relative;
      }

      uigc-logo-chain {
        display: none;
      }

      :host([chain]) uigc-logo-asset {
        mask: radial-gradient(112% 112% at 84% 16%, transparent 25%, white 25%);
        -webkit-mask: radial-gradient(
          112% 112% at 84% 16%,
          transparent 25%,
          white 25%
        );
      }

      :host([chain]) uigc-logo-chain,
      uigc-icon-warning {
        display: flex;
        position: absolute;
        width: 50%;
        height: 50%;
        z-index: 1;
      }

      :host([chain]) uigc-logo-chain {
        right: -10%;
        top: -10%;
      }

      uigc-icon-warning {
        right: -10%;
        bottom: -10%;
        filter: drop-shadow(0 0 4px rgba(0, 0, 0, 0.5));
      }
    `,
  ];

  override async updated() {
    const logoChain = this.shadowRoot.querySelector('uigc-logo-chain');
    if (this.chain) {
      logoChain.setAttribute('chain', this.chain);
    } else {
      logoChain.removeAttribute('chain');
    }
  }

  renderWarning() {
    if (this.warning) {
      return html`
        <uigc-popper text=${this.warning}>
          <uigc-icon-warning fit></uigc-icon-warning>
        </uigc-popper>
      `;
    }
  }

  render() {
    return html`
      <uigc-logo-asset fit .asset=${this.symbol}>
        <uigc-logo-placeholder fit slot="placeholder"></uigc-logo-placeholder>
      </uigc-logo-asset>
      <uigc-logo-chain fit>
        <uigc-logo-placeholder fit slot="placeholder"></uigc-logo-placeholder>
      </uigc-logo-chain>
      ${this.renderWarning()}
    `;
  }
}
