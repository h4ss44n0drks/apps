import { css } from 'lit';

export const formStyles = css`
  .info {
    display: none;
    flex-direction: column;
    margin-top: 10px;
    padding: 0 24px;
    box-sizing: border-box;
  }

  .info.show {
    display: flex;
  }

  @media (min-width: 768px) {
    .info {
      padding: 0 28px;
    }
  }

  @media (max-width: 480px) {
    .advanced,
    .info {
      padding: 0 14px;
    }
  }

  .info .row {
    display: flex;
    align-items: center;
    position: relative;
    gap: 5px;
    padding: 6px 0;
  }

  .info .row:not(:last-child):after {
    background-color: var(--uigc-divider-color);
    bottom: 0;
    content: ' ';
    height: 1px;
    position: absolute;
    width: 100%;
  }

  .info .summary {
    display: none;
    flex-direction: column;
    align-items: flex-start;
  }

  .info .summary.show {
    animation: scale 0.25s;
    display: flex;
  }

  .info .summary .value {
    text-align: left;
    font-size: 18px;
  }

  .info .label {
    font-weight: 500;
    font-size: 12px;
    line-height: 100%;
    text-align: left;
    color: var(--uigc-app-font-color__alternative);
  }

  .info .value {
    font-weight: 500;
    font-size: 12px;
    line-height: 100%;
    text-align: right;
    color: var(--hex-white);
  }

  .info .value + .highlight {
    color: var(--uigc-app-font-color__primary);
  }

  .highlight {
    color: var(--uigc-app-font-color__primary);
  }

  .warning,
  .error {
    display: none;
    flex-direction: row;
    align-items: center;
    line-height: 16px;
    margin: 5px 14px 0;
    padding: 0 14px;
    background: var(--uigc-app-bg-error);
    border-radius: var(--uigc-app-border-radius-2);
  }

  @media (min-width: 768px) {
    .warning,
    .error {
      margin: 5px 28px 0;
    }
  }

  .warning.show,
  .error.show {
    padding: 10px;
    animation: scale 0.25s;
    display: flex;
  }

  .warning span,
  .error span {
    color: var(--hex-white);
    font-weight: 500;
    font-size: 12px;
    line-height: 16px;
  }

  .warning uigc-icon-warning,
  .error uigc-icon-error {
    margin-right: 8px;
  }

  .confirm {
    display: flex;
    padding: 11px 14px 22px 14px;
    box-sizing: border-box;
  }

  @media (min-width: 768px) {
    .confirm {
      padding: 11px 28px 22px 28px;
    }
  }
`;