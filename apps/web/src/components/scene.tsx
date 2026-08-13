import Image from "next/image";
import type { CSSProperties } from "react";
import type { Scene as SceneData } from "@/lib/scenes";

interface SceneProps {
  scene: SceneData;
  alt: string;
  className?: string;
  priority?: boolean;
  sizes?: string;
}

/**
 * Fondo de foto a sangre completa. Si `scene.image` todavía no existe
 * (no hay fotografía real cargada), cae a un gradiente de marca en vez de
 * dejar un <img> roto — ver src/lib/scenes.ts.
 */
export function Scene({ scene, alt, className = "", priority, sizes }: SceneProps) {
  if (scene.image) {
    return (
      <Image
        src={scene.image}
        alt={alt}
        fill
        priority={priority}
        sizes={sizes ?? "100vw"}
        className={`object-cover ${className}`}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={alt}
      className={`photo-placeholder absolute inset-0 ${className}`}
      style={{ "--scene-gradient": scene.gradient } as CSSProperties}
    />
  );
}
