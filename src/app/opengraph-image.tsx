import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = '88ARENA - ระบบจองสนามกีฬาออนไลน์';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #7c3aed 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ fontSize: 80, marginBottom: 16 }}>🏟️</div>
        <div style={{ fontSize: 72, fontWeight: 800, color: '#fff', letterSpacing: -2 }}>
          88ARENA
        </div>
        <div style={{ fontSize: 32, color: 'rgba(255,255,255,0.85)', marginTop: 12 }}>
          ระบบจองสนามกีฬาออนไลน์ • Phuket
        </div>
        <div
          style={{
            marginTop: 32,
            padding: '10px 28px',
            background: 'rgba(255,255,255,0.2)',
            borderRadius: 999,
            fontSize: 22,
            color: '#fff',
            border: '1.5px solid rgba(255,255,255,0.4)',
          }}
        >
          จองง่าย • จ่ายสะดวก • มีใบเสร็จ
        </div>
      </div>
    ),
    { ...size },
  );
}
