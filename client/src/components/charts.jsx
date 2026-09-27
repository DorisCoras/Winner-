// Hafif, bağımlılıksız grafik bileşenleri (dataviz kuralları: ince çubuklar, 4px yuvarlatılmış uç,
// sade kılavuz çizgileri, ≥2 seride lejant, üzerine gelince ipucu; renkler sabit sırada).
import { useLayoutEffect, useRef, useState } from 'react';
import { formatNumber } from '../format.js';

export const SERIES = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)', 'var(--series-5)', 'var(--series-6)', 'var(--series-7)', 'var(--series-8)'];

function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    if (!ref.current) return undefined;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

function niceMax(v) {
  if (v <= 0) return 1;
  const exp = 10 ** Math.floor(Math.log10(v));
  const f = v / exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * exp;
}

export function Legend({ series }) {
  if (!series || series.length < 2) return null;
  return (
    <div className="chart-legend">
      {series.map((s, i) => (
        <span key={s.key}>
          <i style={{ background: s.color ?? SERIES[i] }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

/**
 * Yatay çubuk listesi (tek seri). Değerler çubuğun ucunda metin olarak gösterilir.
 * items: [{ label, value, title? }]
 */
export function BarList({ items, format = formatNumber, color = SERIES[0], max }) {
  const top = max ?? Math.max(1, ...items.map((i) => i.value));
  if (!items.length) return <div className="muted small">Veri yok.</div>;
  return (
    <div className="barlist">
      {items.map((item) => (
        <div className="barlist-row" key={item.label} title={`${item.label}: ${format(item.value)}`}>
          <div className="barlist-label">{item.label}</div>
          <div className="barlist-track">
            <div className="barlist-bar" style={{ width: `${(item.value / top) * 100}%`, background: item.color ?? color }} />
          </div>
          <div className="barlist-value">{format(item.value)}</div>
        </div>
      ))}
    </div>
  );
}

/**
 * Oransal tek çubuk (ör. cinsiyet dağılımı). items: [{ label, value }]
 */
export function SplitBar({ items, format = formatNumber }) {
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  return (
    <div>
      <div className="split-bar" role="img" aria-label={items.map((i) => `${i.label} ${i.value}`).join(', ')}>
        {items.map((item, idx) => (
          <span
            key={item.label}
            title={`${item.label}: ${format(item.value)} (%${Math.round((item.value / total) * 100)})`}
            style={{ width: `${(item.value / total) * 100}%`, background: item.color ?? SERIES[idx] }}
          />
        ))}
      </div>
      <div className="chart-legend mt-1" style={{ marginBottom: 0 }}>
        {items.map((item, idx) => (
          <span key={item.label}>
            <i style={{ background: item.color ?? SERIES[idx] }} />
            {item.label}: <b style={{ color: 'var(--text)' }}>{format(item.value)}</b> (%{Math.round((item.value / total) * 100)})
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Dikey sütun grafiği (gruplu). Kategori üzerine gelince tüm serilerin değerleri gösterilir.
 * data: [{ label, [seriesKey]: number }]
 * series: [{ key, label, color? }]
 */
export function ColumnChart({ data, series, height = 220, format = formatNumber, axisFormat }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const pad = { top: 12, right: 8, bottom: 26, left: 52 };
  const innerW = Math.max(0, width - pad.left - pad.right);
  const innerH = height - pad.top - pad.bottom;
  const maxVal = niceMax(Math.max(0, ...data.flatMap((d) => series.map((s) => d[s.key] ?? 0))));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * maxVal);
  const band = data.length ? innerW / data.length : 0;
  const groupW = Math.min(band * 0.7, series.length * 24 + (series.length - 1) * 2);
  const barW = series.length ? (groupW - (series.length - 1) * 2) / series.length : 0;
  const y = (v) => pad.top + innerH - (v / maxVal) * innerH;
  const fmtAxis = axisFormat ?? ((v) => formatNumber(Math.round(v)));

  return (
    <div>
      <Legend series={series} />
      <div ref={ref} style={{ position: 'relative', width: '100%' }} onMouseLeave={() => setHover(null)}>
        {width > 0 && (
          <svg className="chart-svg" width={width} height={height} role="img" aria-label="Sütun grafiği">
            {ticks.map((t) => (
              <g key={t}>
                <line className="grid-line" x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} />
                <text x={pad.left - 8} y={y(t) + 4} textAnchor="end">
                  {fmtAxis(t)}
                </text>
              </g>
            ))}
            <line className="axis-line" x1={pad.left} x2={width - pad.right} y1={y(0)} y2={y(0)} />
            {data.map((d, i) => {
              const gx = pad.left + i * band + (band - groupW) / 2;
              return (
                <g key={d.label}>
                  {hover === i && <rect x={pad.left + i * band} y={pad.top} width={band} height={innerH} fill="var(--surface-3)" opacity="0.6" />}
                  {series.map((s, si) => {
                    const v = d[s.key] ?? 0;
                    const h = Math.max(0, y(0) - y(v));
                    const x = gx + si * (barW + 2);
                    const r = Math.min(4, barW / 2, h);
                    const top = y(v);
                    // Üst köşeleri yuvarlatılmış, tabanı düz sütun
                    const path = h
                      ? `M${x},${y(0)} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${y(0)} Z`
                      : '';
                    return path ? <path key={s.key} d={path} fill={s.color ?? SERIES[si]} /> : null;
                  })}
                  <text x={pad.left + i * band + band / 2} y={height - 8} textAnchor="middle">
                    {d.label}
                  </text>
                  <rect
                    x={pad.left + i * band}
                    y={pad.top}
                    width={band}
                    height={innerH}
                    fill="transparent"
                    onMouseEnter={() => setHover(i)}
                    onFocus={() => setHover(i)}
                  />
                </g>
              );
            })}
          </svg>
        )}
        {hover !== null && data[hover] && (
          <div
            className="chart-tooltip"
            style={{
              left: Math.min(Math.max(pad.left + hover * band + band / 2, 80), width - 80),
              top: y(Math.max(...series.map((s) => data[hover][s.key] ?? 0))),
            }}
          >
            <div className="t-title">{data[hover].title ?? data[hover].label}</div>
            {series.map((s, si) => (
              <div className="t-row" key={s.key}>
                <i className="dot" style={{ background: s.color ?? SERIES[si] }} />
                {s.label}
                <b>{format(data[hover][s.key] ?? 0)}</b>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
