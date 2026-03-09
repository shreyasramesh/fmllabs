"use client";

/**
 * Metallic orb with colorful highlights - dark indigo/navy base with
 * warm (yellow-white) and cool (blue) specular reflections.
 * Mimics a polished, reflective liquid metal sphere.
 */
export function MetallicOrb({
  isActive = false,
  className = "",
}: {
  isActive?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`absolute inset-0 rounded-full overflow-hidden ${className}`}
      style={{
        background: `
          radial-gradient(ellipse 80% 50% at 30% 25%, rgba(255,255,255,0.9) 0%, rgba(255,230,180,0.6) 25%, transparent 55%),
          radial-gradient(ellipse 60% 40% at 75% 35%, rgba(120,180,255,0.8) 0%, rgba(80,140,220,0.5) 30%, transparent 55%),
          radial-gradient(ellipse 100% 100% at 50% 50%, rgba(60,50,120,0.4) 0%, transparent 50%),
          radial-gradient(ellipse 90% 90% at 50% 50%, #1e1b4b 0%, #0f0d1a 60%, #050408 100%)
        `,
        boxShadow: `
          inset -15px -15px 40px rgba(0,0,0,0.5),
          inset 15px 15px 30px rgba(80,60,150,0.15),
          0 0 60px rgba(100,80,200,0.3),
          0 0 120px rgba(60,50,120,0.2)
        `,
      }}
    >
      {/* Inner glow when active */}
      {isActive && (
        <div
          className="absolute inset-0 rounded-full animate-voice-breathe opacity-60"
          style={{
            background: `radial-gradient(ellipse 70% 70% at 50% 50%, rgba(120,100,200,0.4) 0%, transparent 70%)`,
            boxShadow: `inset 0 0 40px rgba(150,120,255,0.2)`,
          }}
        />
      )}
    </div>
  );
}
