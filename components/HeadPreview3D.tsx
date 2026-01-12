import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { HEAD_UVS } from '../utils/textureUtils';

const PreviewMesh = ({ texture, isOverlay }: { texture: THREE.Texture, isOverlay: boolean }) => {
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

    useFrame((state, delta) => {
        if (meshRef.current) {
           meshRef.current.rotation.y += delta * 1;
        }
    });

    return (
        <mesh 
            ref={meshRef}
            geometry={geometry}
            scale={isOverlay ? [1.125, 1.125, 1.125] : [1, 1, 1]}
        >
            <meshStandardMaterial 
                map={texture} 
                transparent={true} 
                alphaTest={0.5} 
                side={THREE.DoubleSide} 
            />
        </mesh>
    )
}

const HeadPreview3D = ({ textureData }: { textureData: string }) => {
     const texture = useMemo(() => {
        const t = new THREE.TextureLoader().load(textureData);
        t.magFilter = THREE.NearestFilter;
        t.minFilter = THREE.NearestFilter;
        t.colorSpace = THREE.SRGBColorSpace;
        return t;
    }, [textureData]);

    return (
        <Canvas camera={{ position: [2.5, 1.5, 3], fov: 45 }} style={{ background: 'transparent', width: '100%', height: '100%' }}>
            <ambientLight intensity={1} />
            <pointLight position={[10, 10, 10]} intensity={0.5} />
            <PreviewMesh texture={texture} isOverlay={false} />
            <PreviewMesh texture={texture} isOverlay={true} />
        </Canvas>
    );
}

export default React.memo(HeadPreview3D);