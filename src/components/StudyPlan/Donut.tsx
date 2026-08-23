import React from "react";

interface Segment {
  value: number;
  color: string;
}

interface Props {
  size?: number;
  thickness?: number;
  /** Segments are drawn in order around the ring, clockwise from the top. */
  segments: Segment[];
  /** What the segments are measured against. Defaults to their sum. */
  total?: number;
  label?: React.ReactNode;
  sub?: React.ReactNode;
  ariaLabel?: string;
  ariaValue?: number;
}

// One ring, any number of segments. Used for the degree total and for the
// per-requirement-group rings.
const Donut: React.FC<Props> = ({
  size = 92,
  thickness = 10,
  segments,
  total,
  label,
  sub,
  ariaLabel,
  ariaValue,
}) => {
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const sum = segments.reduce((s, seg) => s + Math.max(0, seg.value), 0);
  const denom = Math.max(total ?? sum, 0.0001);

  // Arc lengths, then where each one starts: cumulative sums, no mutation.
  const dashes = segments.map(
    (seg) => Math.max(0, Math.min(1, seg.value / denom)) * circumference
  );
  const arcs = segments.map((seg, i) => {
    const dash = dashes[i];
    const offset = dashes.slice(0, i).reduce((sum, d) => sum + d, 0);
    return (
      <circle
        key={i}
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={seg.color}
        strokeWidth={thickness}
        strokeDasharray={`${dash} ${circumference}`}
        strokeDashoffset={-offset}
        strokeLinecap={dash > thickness ? "round" : "butt"}
        fill="none"
      />
    );
  });

  return (
    <div
      className="sp-donut"
      style={{ width: size, height: size }}
      role={ariaLabel ? "progressbar" : undefined}
      aria-label={ariaLabel}
      aria-valuenow={ariaValue}
      aria-valuemin={ariaLabel ? 0 : undefined}
      aria-valuemax={ariaLabel ? 100 : undefined}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="sp-donut-track"
          strokeWidth={thickness}
          fill="none"
        />
        {arcs}
      </svg>
      <div className="sp-donut-mid">
        {label !== undefined && <div className="sp-donut-label">{label}</div>}
        {sub !== undefined && <div className="sp-donut-sub">{sub}</div>}
      </div>
    </div>
  );
};

export default Donut;
