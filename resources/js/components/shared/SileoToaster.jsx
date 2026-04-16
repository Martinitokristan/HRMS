import React from 'react';
import { Toaster, sileo } from "sileo";

// Expose globally so every component import works and console testing is possible
if (typeof window !== 'undefined') {
  window.sileo = sileo;
}

export default function SileoToaster() {
  return (
    <Toaster
      position="top-right"
      offset={20}
    />
  );
}
