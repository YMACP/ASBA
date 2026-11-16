import React from 'react';
import {
  AnthropicMark,
  OpenAIMark,
  MicrosoftMark,
  DeepMindMark,
  PaloAltoMark,
  HiddenLayerMark,
  MetaMark,
  InvariantMark,
  ZenityMark,
  MatrixMark,
  XbowMark,
  ProjectZeroMark,
  AisleMark,
  ZeroPathMark,
  SybilMark,
  SimonMark,
  EmbraceMark,
  CarliniMark,
  ThackerMark,
} from './BrandLogos.jsx';

export default function VendorMark({ site, size = 15 }) {
  if (site.key === 'anthropic') return <AnthropicMark size={size} />;
  if (site.key === 'openai') return <OpenAIMark size={size} />;
  if (site.key === 'microsoft') return <MicrosoftMark size={size} />;
  if (site.key === 'deepmind') return <DeepMindMark size={size} />;
  if (site.key === 'unit42') return <PaloAltoMark size={size} />;
  if (site.key === 'invariant') return <InvariantMark size={size} />;
  if (site.key === 'zenity') return <ZenityMark size={size} />;
  if (site.key === 'matrix') return <MatrixMark size={size} />;
  if (site.key === 'xbow') return <XbowMark size={size} />;
  if (site.key === 'projectzero') return <ProjectZeroMark size={size} />;
  if (site.key === 'aisle') return <AisleMark size={size} />;
  if (site.key === 'zeropath') return <ZeroPathMark size={size} />;
  if (site.key === 'sybil') return <SybilMark size={size} />;
  if (site.key === 'simon') return <SimonMark size={size} />;
  if (site.key === 'embrace') return <EmbraceMark size={size} />;
  if (site.key === 'carlini') return <CarliniMark size={size} />;
  if (site.key === 'thacker') return <ThackerMark size={size} />;
  if (site.key === 'hiddenlayer') return <HiddenLayerMark size={size} />;
  if (site.key === 'meta') {
    return (
      <span className="side-logo-meta">
        <MetaMark size={12} />
      </span>
    );
  }
  return <span className="side-dot" style={{ background: site.accent || '#888' }} />;
}
