import React from "react";

/* If the WebGL scene throws (no GPU, context creation failure, driver
   quirk), the page must still render its content rather than going dark.
   Renders nothing in place of the scene — the hero text sits above it and
   is readable on the plain background. */
export class WebGLBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) return (
      <div className="webgl-fallback" role="status">
        <span>2D MODE</span>
        <strong>互動運算網路</strong>
        <p>此裝置目前無法啟動 WebGL，研究內容仍可完整瀏覽。</p>
      </div>
    );
    return this.props.children;
  }
}
