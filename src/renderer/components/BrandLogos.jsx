import React from 'react';
import hiddenLayerIcon from '../assets/hiddenlayer.png';
import invariantIcon from '../assets/invariant.svg';
import zenityIcon from '../assets/zenity.png';
import matrixIcon from '../assets/matrix.png';
import xbowIcon from '../assets/xbow.png';
import projectZeroIcon from '../assets/projectzero.svg';
import aisleIcon from '../assets/aisle.png';
import zeroPathIcon from '../assets/zeropath.png';
import sybilIcon from '../assets/sybil.png';
import simonIcon from '../assets/simon.png';
import embraceIcon from '../assets/embrace.png';
import carliniIcon from '../assets/carlini.png';
import thackerIcon from '../assets/thacker.png';

export function AnthropicMark({ size = 16, color = '#D97757', ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true" {...rest}>
      <path d="M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z" />
    </svg>
  );
}

export function MicrosoftMark({ size = 16, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 23 23" aria-hidden="true" {...rest}>
      <rect x="1" y="1" width="10" height="10" fill="#F25022" />
      <rect x="12" y="1" width="10" height="10" fill="#7FBA00" />
      <rect x="1" y="12" width="10" height="10" fill="#00A4EF" />
      <rect x="12" y="12" width="10" height="10" fill="#FFB900" />
    </svg>
  );
}

export function GoogleMark({ size = 16, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" {...rest}>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65Z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19Z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" />
    </svg>
  );
}

export function DeepSeekMark({ size = 16, color = '#4D6BFE', ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true" {...rest}>
      <path d="M23.748 4.651c-.254-.124-.364.113-.512.233-.051.04-.094.09-.137.137-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.155-.708-.311-.955-.65-.172-.24-.219-.509-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.094.172.187.129.323-.082.28-.18.553-.266.833-.055.179-.137.218-.328.14a5.5 5.5 0 0 1-1.737-1.179c-.857-.828-1.631-1.743-2.597-2.46a12 12 0 0 0-.689-.47c-.985-.957.13-1.743.387-1.836.27-.098.094-.433-.778-.428-.872.003-1.67.295-2.687.685a3 3 0 0 1-.465.136 9.6 9.6 0 0 0-2.883-.101c-1.885.21-3.39 1.1-4.497 2.622C.082 8.776-.231 10.854.152 13.02c.403 2.284 1.568 4.175 3.36 5.653 1.857 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.132-.284 4.994-1.86.47.234.962.328 1.78.398.629.058 1.235-.031 1.705-.129.735-.155.684-.836.418-.961-2.155-1.004-1.682-.595-2.112-.926 1.095-1.295 2.768-3.598 3.284-6.733.05-.346.115-.834.108-1.114-.004-.171.035-.238.23-.257a4.2 4.2 0 0 0 1.545-.475c1.397-.763 1.96-2.016 2.093-3.517.02-.23-.004-.467-.247-.588M11.58 18.168c-2.088-1.642-3.101-2.183-3.52-2.16-.39.024-.32.472-.234.763.09.288.207.487.371.74.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.168-1.361-.801-2.5-1.86-3.301-3.306-.775-1.393-1.225-2.888-1.299-4.482-.02-.385.094-.522.477-.592a4.7 4.7 0 0 1 1.53-.038c2.131.311 3.946 1.264 5.467 2.774.868.86 1.525 1.887 2.202 2.89.72 1.066 1.494 2.082 2.48 2.915.348.291.626.513.892.677-.802.09-2.14.109-3.055-.615zm1.001-6.44a.306.306 0 0 1 .415-.287.3.3 0 0 1 .113.074.3.3 0 0 1 .086.214c0 .17-.136.307-.308.307a.303.303 0 0 1-.306-.307m3.11 1.596c-.2.081-.4.151-.591.16a1.25 1.25 0 0 1-.798-.254c-.274-.23-.47-.358-.551-.758a1.7 1.7 0 0 1 .015-.588c.07-.327-.007-.537-.238-.727-.188-.156-.426-.199-.689-.199a.6.6 0 0 1-.254-.078.253.253 0 0 1-.114-.358 1 1 0 0 1 .192-.21c.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.392.451.462.576.685.915.176.264.336.536.446.848.066.194-.02.353-.25.45" />
    </svg>
  );
}

export function DeepMindMark({ size = 16, color = '#4285F4', ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true" {...rest}>
      <path d="M12 1.8c.7 5.8 4.4 9.5 10.2 10.2-5.8.7-9.5 4.4-10.2 10.2C11.3 16.4 7.6 12.7 1.8 12 7.6 11.3 11.3 7.6 12 1.8Z" />
    </svg>
  );
}

export function PaloAltoMark({ size = 16, color = '#FA582D', ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 70 58" fill={color} aria-hidden="true" {...rest}>
      <path d="M63.3 11.5 51.8 0 40.3 11.5l5.7 5.7L17.2 46.1l11.5 11.5 11.5-11.5-5.7-5.7L63.3 11.5Z" />
      <path d="M28.8 0 0 28.8l11.5 11.5 28.8-28.8L28.8 0Z" />
      <path d="M69.1 17.2 40.2 46.1l11.5 11.5 28.8-28.8-11.4-11.6Z" />
    </svg>
  );
}

export function HiddenLayerMark({ size = 16, ...rest }) {
  return (
    <img
      src={hiddenLayerIcon}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      style={{ display: 'block', borderRadius: 3, objectFit: 'contain' }}
      {...rest}
    />
  );
}

export function MetaMark({ size = 16, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 272 160" aria-hidden="true" {...rest}>
      <defs>
        <linearGradient id="metaGrad1" x1="61" y1="117" x2="259" y2="127" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0064e1" />
          <stop offset="0.4" stopColor="#0064e1" />
          <stop offset="0.83" stopColor="#0073ee" />
          <stop offset="1" stopColor="#0082fb" />
        </linearGradient>
        <linearGradient id="metaGrad2" x1="45" y1="139" x2="45" y2="66" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0082fb" />
          <stop offset="1" stopColor="#0064e0" />
        </linearGradient>
      </defs>
      <path fill="#0081fb" d="m31.06,125.96c0,10.98 2.41,19.41 5.56,24.51 4.13,6.68 10.29,9.51 16.57,9.51 8.1,0 15.51-2.01 29.79-21.76 11.44-15.83 24.92-38.05 33.99-51.98l15.36-23.6c10.67-16.39 23.02-34.61 37.18-46.96 11.56-10.08 24.03-15.68 36.58-15.68 21.07,0 41.14,12.21 56.5,35.11 16.81,25.08 24.97,56.67 24.97,89.27 0,19.38-3.82,33.62-10.32,44.87-6.28,10.88-18.52,21.75-39.11,21.75l0-31.02c17.63,0 22.03-16.2 22.03-34.74 0-26.42-6.16-55.74-19.73-76.69-9.63-14.86-22.11-23.94-35.84-23.94-14.85,0-26.8,11.2-40.23,31.17-7.14,10.61-14.47,23.54-22.7,38.13l-9.06,16.05c-18.2,32.27-22.81,39.62-31.91,51.75-15.95,21.24-29.57,29.29-47.5,29.29-21.27,0-34.72-9.21-43.05-23.09-6.8-11.31-10.14-26.15-10.14-43.06z" />
      <path fill="url(#metaGrad1)" d="m24.49,37.3c14.24-21.95 34.79-37.3 58.36-37.3 13.65,0 27.22,4.04 41.39,15.61 15.5,12.65 32.02,33.48 52.63,67.81l7.39,12.32c17.84,29.72 27.99,45.01 33.93,52.22 7.64,9.26 12.99,12.02 19.94,12.02 17.63,0 22.03-16.2 22.03-34.74l27.4-.86c0,19.38-3.82,33.62-10.32,44.87-6.28,10.88-18.52,21.75-39.11,21.75-12.8,0-24.14-2.78-36.68-14.61-9.64-9.08-20.91-25.21-29.58-39.71l-25.79-43.08c-12.94-21.62-24.81-37.74-31.68-45.04-7.39-7.85-16.89-17.33-32.05-17.33-12.27,0-22.69,8.61-31.41,21.78z" />
      <path fill="url(#metaGrad2)" d="m82.35,31.23c-12.27,0-22.69,8.61-31.41,21.78-12.33,18.61-19.88,46.33-19.88,72.95 0,10.98 2.41,19.41 5.56,24.51l-26.48,17.44c-6.8-11.31-10.14-26.15-10.14-43.06 0-30.75 8.44-62.8 24.49-87.55 14.24-21.95 34.79-37.3 58.36-37.3z" />
    </svg>
  );
}

export function InvariantMark({ size = 16, ...rest }) {
  return (
    <img
      src={invariantIcon}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      style={{ display: 'block', objectFit: 'contain' }}
      {...rest}
    />
  );
}

export function ZenityMark({ size = 16, ...rest }) {
  return (
    <img
      src={zenityIcon}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      style={{ display: 'block', borderRadius: 3, objectFit: 'contain' }}
      {...rest}
    />
  );
}

export function MatrixMark({ size = 16, ...rest }) {
  return (
    <img
      src={matrixIcon}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      style={{ display: 'block', objectFit: 'contain' }}
      {...rest}
    />
  );
}

export function XbowMark({ size = 16, ...rest }) {
  return (
    <img
      src={xbowIcon}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      style={{ display: 'block', objectFit: 'contain' }}
      {...rest}
    />
  );
}

export function ProjectZeroMark({ size = 16, ...rest }) {
  return (
    <img
      src={projectZeroIcon}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      style={{ display: 'block', objectFit: 'contain' }}
      {...rest}
    />
  );
}

export function AisleMark({ size = 16, ...rest }) {
  return <img src={aisleIcon} width={size} height={size} alt="" aria-hidden="true" style={{ display: 'block', objectFit: 'contain' }} {...rest} />;
}

export function ZeroPathMark({ size = 16, ...rest }) {
  return <img src={zeroPathIcon} width={size} height={size} alt="" aria-hidden="true" style={{ display: 'block', objectFit: 'contain' }} {...rest} />;
}

export function SybilMark({ size = 16, ...rest }) {
  return <img src={sybilIcon} width={size} height={size} alt="" aria-hidden="true" style={{ display: 'block', borderRadius: 3, objectFit: 'contain' }} {...rest} />;
}

export function SimonMark({ size = 16, ...rest }) {
  return <img src={simonIcon} width={size} height={size} alt="" aria-hidden="true" style={{ display: 'block', borderRadius: 3, objectFit: 'contain' }} {...rest} />;
}

export function EmbraceMark({ size = 16, ...rest }) {
  return <img src={embraceIcon} width={size} height={size} alt="" aria-hidden="true" style={{ display: 'block', borderRadius: 3, objectFit: 'contain' }} {...rest} />;
}

export function CarliniMark({ size = 16, ...rest }) {
  return <img src={carliniIcon} width={size} height={size} alt="" aria-hidden="true" style={{ display: 'block', borderRadius: 3, objectFit: 'contain' }} {...rest} />;
}

export function ThackerMark({ size = 16, ...rest }) {
  return <img src={thackerIcon} width={size} height={size} alt="" aria-hidden="true" style={{ display: 'block', borderRadius: 4, objectFit: 'contain' }} {...rest} />;
}

export function OpenAIMark({ size = 16, color = '#0d0d0d', ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true" {...rest}>
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
    </svg>
  );
}
