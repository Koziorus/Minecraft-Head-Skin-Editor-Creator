import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import { Canvas, useFrame, ThreeEvent } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { HEAD_UVS } from '../utils/textureUtils';

interface Head3DProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  showOverlay: boolean;
  activeLayer: 'base' | 'overlay';
  onPaint: (uv: THREE.Vector2) => void;
  onPaintStart: () => void;
  onPaintEnd: () => void;
}

const BoxWithUVs = ({ 
    texture, 
    isOverlay, 
    onPaint,
    onPaintStart,
    onPaintEnd,
    active
}: { 
    texture: THREE.CanvasTexture, 
    isOverlay: boolean,
    onPaint: (uv: THREE.Vector2) => void,
    onPaintStart: () => void,
    onPaintEnd: () => void,
    active: boolean
}) => {
    const meshRef = useRef<THREE.Mesh>(null);
    
    const geometry = useMemo(() => {
        const geo = new THREE.BoxGeometry(1, 1, 1);
        const uvAttribute = geo.attributes.uv;
        const width = 64;
        const height = 64;
        
        const setFaceUV = (faceIndex: number, uRange: number[], vRange: number[]) => {
             const offset = faceIndex * 4;
             const u0 = uRange[0] / width;
             const u1 = uRange[1] / width;
             const v0 = (height - vRange[1]) / height;
             const v1 = (height - vRange[0]) / height;
             
             uvAttribute.setXY(offset + 0, u1, v1);
             uvAttribute.setXY(offset + 1, u0, v1);
             uvAttribute.setXY(offset + 2, u1, v0);
             uvAttribute.setXY(offset + 3, u0, v0);
        };

        const map = isOverlay ? HEAD_UVS.overlay : HEAD_UVS.base;
        setFaceUV(0, map[0].u, map[0].v);
        setFaceUV(1, map[1].u, map[1].v);
        setFaceUV(2, map[2].u, map[2].v);
        setFaceUV(3, map[3].u, map[3].v);
        setFaceUV(4, map[4].u, map[4].v);
        setFaceUV(5, map[5].u, map[5].v);

        uvAttribute.needsUpdate = true;
        return geo;
    }, [isOverlay]);

    const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
        if (!active) return;
        e.stopPropagation();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        onPaintStart();
        if (e.uv) onPaint(e.uv);
    };

    const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
        if (!active) return;
        e.stopPropagation();
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        onPaintEnd();
    };

    const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
        if (!active) return;
        if (e.buttons === 1 && e.uv) {
             e.stopPropagation();
             onPaint(e.uv);
        }
    };

    // Explicitly nullify raycast if inactive to allow click-through
    // Using a stable null function for inactive state
    const nullRaycast = useCallback(() => null, []);
    const raycastHandler = active ? undefined : nullRaycast;

    return (
        <mesh 
            // Adding a key forces the mesh to re-mount when active state changes.
            // This ensures that the raycast property is correctly applied/removed by React Three Fiber,
            // fixing the issue where switching layers prevented interaction.
            key={`mesh-${isOverlay ? 'overlay' : 'base'}-${active ? 'active' : 'inactive'}`}
            ref={meshRef} 
            geometry={geometry}
            scale={isOverlay ? [1.125, 1.125, 1.125] : [1, 1, 1]}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerMove={handlePointerMove}
            raycast={raycastHandler}
        >
            <meshStandardMaterial 
                map={texture} 
                transparent={true} 
                alphaTest={0.5} // High alphaTest for crisp edges
                side={THREE.DoubleSide}
            />
        </mesh>
    );
};

// Component to handle texture updates
const TextureUpdater = ({ texture }: { texture: THREE.CanvasTexture }) => {
    useFrame(() => {
        if (texture) {
            texture.needsUpdate = true;
        }
    });
    return null;
};

const Head3D: React.FC<Head3DProps> = ({ canvasRef, showOverlay, activeLayer, onPaint, onPaintStart, onPaintEnd }) => {
    
    // Create a stable texture instance from the canvas
    const texture = useMemo(() => {
        // We use a dummy canvas initially if ref is not ready, but it should be ready by the time this renders in Editor
        const el = canvasRef.current || document.createElement('canvas');
        const tex = new THREE.CanvasTexture(el);
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        tex.generateMipmaps = false;
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
    }, [canvasRef]); 

    return (
        <Canvas 
            gl={{ antialias: false, preserveDrawingBuffer: true }}
            style={{ imageRendering: 'pixelated' }}
        >
            <PerspectiveCamera makeDefault position={[3, 2, 4]} />
            <OrbitControls 
                minDistance={2} 
                maxDistance={10} 
                mouseButtons={{
                    LEFT: undefined as any, 
                    MIDDLE: THREE.MOUSE.PAN,
                    RIGHT: THREE.MOUSE.ROTATE
                }}
            />
            
            <ambientLight intensity={0.8} />
            <pointLight position={[10, 10, 10]} intensity={0.5} />
            <pointLight position={[-10, -10, -10]} intensity={0.2} />
            
            <TextureUpdater texture={texture} />

            <BoxWithUVs 
                texture={texture} 
                isOverlay={false} 
                onPaint={onPaint}
                onPaintStart={onPaintStart}
                onPaintEnd={onPaintEnd}
                active={activeLayer === 'base'}
            />
            
            {showOverlay && (
                <BoxWithUVs 
                    texture={texture} 
                    isOverlay={true} 
                    onPaint={onPaint} 
                    onPaintStart={onPaintStart}
                    onPaintEnd={onPaintEnd}
                    active={activeLayer === 'overlay'}
                />
            )}
            
            <gridHelper args={[10, 10, 0x444444, 0x222222]} position={[0, -2, 0]} />
        </Canvas>
    );
};

export default Head3D;