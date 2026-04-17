import React from 'react';

const SolidTriangle = ({ angle }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" style={{ transform: `rotate(${angle}deg)` }}>
    <path fill="currentColor" d="M12 2L22 20H2z" />
  </svg>
);

export default SolidTriangle;
