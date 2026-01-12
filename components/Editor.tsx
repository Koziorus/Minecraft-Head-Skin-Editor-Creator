import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ViewMode, HistoryNode } from '../types';
import Head3D from './Head3D';
import HeadPreview3D from './HeadPreview3D';
import * as THREE from 'three';
import { createBaseSkin, getCtxCoords, CANVAS_SIZE, getHeadPreviewFromCanvas } from '../utils/textureUtils';
import { PaintBrushIcon, EyeIcon, ArrowDownTrayIcon, CodeBracketIcon, TrashIcon, Square2StackIcon, CubeIcon, ArrowUturnLeftIcon, ArrowUturnRightIcon, ClockIcon, ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/solid';
import { fetchSkinFromUsername, loadImage } from '../services/mojangService';

interface TimelineNodeProps {
    nodeId: string;
    nodes: Record<string, HistoryNode>;
    currentId: string | null;
    onJump: (id: string) => void;
    onContextMenu: (e: React.MouseEvent, nodeId: string) => void;
    show3D: boolean;
    isFirst?: boolean;
    isLast?: boolean;
    hasSiblings?: boolean;
}

// Recursive Tree Node Component
const TimelineNode: React.FC<TimelineNodeProps> = ({ 
    nodeId, 
    nodes, 
    currentId, 
    onJump, 
    onContextMenu,
    show3D,
    isFirst = false, 
    isLast = false, 
    hasSiblings = false 
}) => {
    const node = nodes[nodeId];
    if (!node) return null;

    const isCurrent = currentId === nodeId;
    const hasChildren = node.children.length > 0;

    return (
        <div className="flex flex-row items-center">
             {/* Connector from Parent (if not root) */}
             {hasSiblings && (
                 <div className="w-4 h-self flex flex-col relative self-stretch">
                     {/* Horizontal line to node */}
                     <div className="absolute right-0 top-1/2 w-4 h-0.5 bg-gray-600 -translate-y-1/2"></div>
                     
                     {/* Vertical Spine */}
                     <div className={`absolute left-0 w-0.5 bg-gray-600 ${
                         isFirst && isLast ? 'hidden' : // Should not happen if hasSiblings is true
                         isFirst ? 'top-1/2 h-1/2' :
                         isLast ? 'top-0 h-1/2' :
                         'top-0 h-full'
                     }`}></div>
                 </div>
             )}
             {/* Simple spacer if single child (straight line) */}
             {!hasSiblings && node.parentId && (
                 <div className="w-4 h-0.5 bg-gray-600"></div>
             )}

            {/* The Node Itself */}
            <div className="flex flex-col items-center z-10 mx-1">
                <div 
                    onClick={() => onJump(nodeId)}
                    onContextMenu={(e) => onContextMenu(e, nodeId)}
                    className={`w-12 h-12 border-2 rounded cursor-pointer overflow-hidden transition-all bg-gray-900 relative group ${isCurrent ? 'border-blue-500 ring-2 ring-blue-500/50 scale-110 z-20 shadow-lg shadow-blue-500/50' : 'border-gray-600 hover:border-gray-400 opacity-80 hover:opacity-100'}`}
                >
                    {show3D ? (
                        <HeadPreview3D textureData={node.textureData} />
                    ) : (
                        <img src={node.previewData} className="w-full h-full image-pixelated" alt="Step" />
                    )}
                    
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block bg-black text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-30 pointer-events-none">
                        {new Date(node.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}
                        <br/>
                        <span className="text-gray-400">Right click for options</span>
                    </div>
                </div>
            </div>

            {/* Children */}
            {hasChildren && (
                <div className="flex flex-row items-center">
                    {/* Connector from Node to Children Wrapper */}
                    <div className="w-4 h-0.5 bg-gray-600"></div>
                    
                    {/* Wrapper for Children */}
                    <div className="flex flex-col justify-center">
                        {node.children.map((childId, index) => (
                            <TimelineNode 
                                key={childId}
                                nodeId={childId}
                                nodes={nodes}
                                currentId={currentId}
                                onJump={onJump}
                                onContextMenu={onContextMenu}
                                show3D={show3D}
                                isFirst={index === 0}
                                isLast={index === node.children.length - 1}
                                hasSiblings={node.children.length > 1}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const Editor: React.FC = () => {
    // --- State ---
    const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Split);
    
    // Tools
    const [brushColor, setBrushColor] = useState<string>('#F44336');
    const [activeLayer, setActiveLayer] = useState<'base' | 'overlay'>('base');
    const [showOverlay, setShowOverlay] = useState<boolean>(true);
    const [tool, setTool] = useState<'brush' | 'eraser' | 'picker'>('brush');
    const [brushSize, setBrushSize] = useState<number>(1);
    const [recentColors, setRecentColors] = useState<string[]>([]);
    
    // History (Tree Structure)
    const [historyNodes, setHistoryNodes] = useState<Record<string, HistoryNode>>({});
    const [currentId, setCurrentId] = useState<string | null>(null);
    const [showTimeline, setShowTimeline] = useState(true);
    const [show3DTimeline, setShow3DTimeline] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, nodeId: string } | null>(null);

    // Canvas Refs
    const canvasRef = useRef<HTMLCanvasElement>(null); // Source of truth
    const view2DRef = useRef<HTMLCanvasElement>(null); // 2D Display
    const originalCanvasRef = useRef<HTMLCanvasElement>(null); // Import backup
    
    // Loading State
    const [isCanvasReady, setIsCanvasReady] = useState(false);

    // Modals
    const [isExportModalOpen, setExportModalOpen] = useState(false);
    const [isImportModalOpen, setImportModalOpen] = useState(false);
    
    // Import/Export State
    const [importInput, setImportInput] = useState('');
    
    // --- Helpers ---

    const generateId = () => Math.random().toString(36).substr(2, 9);

    const rootId = useMemo(() => {
        return (Object.values(historyNodes) as HistoryNode[]).find(n => n.parentId === null)?.id || null;
    }, [historyNodes]);

    // --- Initialization & Canvas Sync ---

    useEffect(() => {
        const init = async () => {
            const baseSkin = createBaseSkin();
            
            const img = await loadImage(baseSkin);
            
            const setupCanvas = (ref: React.RefObject<HTMLCanvasElement>) => {
                if (ref.current) {
                    const ctx = ref.current.getContext('2d', { willReadFrequently: true });
                    if (ctx) {
                        ctx.clearRect(0,0, CANVAS_SIZE, CANVAS_SIZE);
                        ctx.drawImage(img, 0, 0);
                    }
                }
            };
            setupCanvas(canvasRef);
            setupCanvas(originalCanvasRef);
            
            setIsCanvasReady(true);
            draw2DView();

            if (canvasRef.current && Object.keys(historyNodes).length === 0) {
                const preview = getHeadPreviewFromCanvas(canvasRef.current);
                const rootNode: HistoryNode = {
                    id: generateId(),
                    parentId: null,
                    textureData: baseSkin,
                    previewData: preview,
                    timestamp: Date.now(),
                    children: [],
                    activeChildId: null
                };
                setHistoryNodes({ [rootNode.id]: rootNode });
                setCurrentId(rootNode.id);
            }
        };
        init();
    }, []);

    const updateCanvases = async (dataUrl: string, updateOriginal: boolean = false) => {
        const img = await loadImage(dataUrl);
        
        if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true });
            if (ctx) {
                ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
                ctx.drawImage(img, 0, 0);
            }
        }

        if (updateOriginal && originalCanvasRef.current) {
            const ctx = originalCanvasRef.current.getContext('2d', { willReadFrequently: true });
            if (ctx) {
                ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
                ctx.drawImage(img, 0, 0);
            }
        }
        
        draw2DView();
    };

    const draw2DView = () => {
        const source = canvasRef.current;
        const dest = view2DRef.current;
        if (!source || !dest) return;
        const ctx = dest.getContext('2d');
        if (!ctx) return;
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, dest.width, dest.height);
        ctx.drawImage(source, 0, 0, 64, 16, 0, 0, dest.width, dest.height);
    };

    // --- History Operations ---

    const addHistoryStep = useCallback(() => {
        if (!canvasRef.current || !currentId) return;
        
        const newData = canvasRef.current.toDataURL();
        const currentNode = historyNodes[currentId];
        
        if (currentNode.textureData === newData) return;

        const newNodeId = generateId();
        const preview = getHeadPreviewFromCanvas(canvasRef.current);

        const newNode: HistoryNode = {
            id: newNodeId,
            parentId: currentId,
            textureData: newData,
            previewData: preview,
            timestamp: Date.now(),
            children: [],
            activeChildId: null
        };

        setHistoryNodes(prev => {
            const updatedParent = {
                ...prev[currentId],
                children: [...prev[currentId].children, newNodeId],
                activeChildId: newNodeId 
            };
            return {
                ...prev,
                [currentId]: updatedParent,
                [newNodeId]: newNode
            };
        });
        setCurrentId(newNodeId);
    }, [currentId, historyNodes]);

    const jumpToStep = async (nodeId: string) => {
        const node = historyNodes[nodeId];
        if (!node) return;
        await updateCanvases(node.textureData, false);
        setCurrentId(nodeId);
    };

    const handleUndo = useCallback(() => {
        if (!currentId) return;
        const node = historyNodes[currentId];
        if (node && node.parentId) {
            jumpToStep(node.parentId);
        }
    }, [currentId, historyNodes]);

    const handleRedo = useCallback(() => {
        if (!currentId) return;
        const node = historyNodes[currentId];
        if (node && node.activeChildId) {
            jumpToStep(node.activeChildId);
        } else if (node && node.children.length > 0) {
            // Fallback to most recent child
            jumpToStep(node.children[node.children.length - 1]);
        }
    }, [currentId, historyNodes]);

    const handleContextMenu = (e: React.MouseEvent, nodeId: string) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, nodeId });
    };

    const deleteFutureSteps = () => {
        if (!contextMenu) return;
        const { nodeId } = contextMenu;
        
        // Validation: Cannot delete if no children
        const node = historyNodes[nodeId];
        if (!node || node.children.length === 0) return;

        setHistoryNodes(prev => {
            const next = { ...prev };
            const node = next[nodeId];
            if (!node) return next;

            // Recursive cleanup
            const gatherDescendants = (id: string, list: string[]) => {
                const n = next[id];
                if (!n) return;
                n.children.forEach(childId => {
                    list.push(childId);
                    gatherDescendants(childId, list);
                });
            };

            const toDelete: string[] = [];
            gatherDescendants(nodeId, toDelete);

            toDelete.forEach(id => delete next[id]);

            // Update node
            next[nodeId] = {
                ...node,
                children: [],
                activeChildId: null
            };

            return next;
        });

        // Check if current ID is a descendant of the clicked node
        let isDescendant = false;
        let walker = currentId;
        while(walker && historyNodes[walker]) {
             if(historyNodes[walker].parentId === nodeId) {
                 isDescendant = true;
                 break;
             }
             walker = historyNodes[walker].parentId;
        }
         
        if(isDescendant) {
             jumpToStep(nodeId);
        }
        
        setContextMenu(null);
    };

    // Close context menu on click elsewhere
    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    // Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'z') {
                    e.preventDefault();
                    if (e.shiftKey) handleRedo();
                    else handleUndo();
                } else if (e.key === 'y') {
                    e.preventDefault();
                    handleRedo();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleUndo, handleRedo]);

    const performPaint = useCallback((x: number, y: number) => {
        const canvas = canvasRef.current;
        const origCanvas = originalCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        if (x < 0 || x >= CANVAS_SIZE || y < 0 || y >= CANVAS_SIZE) return;

        if (tool === 'eraser') {
            if (origCanvas) {
                 ctx.clearRect(x, y, brushSize, brushSize);
                 ctx.drawImage(origCanvas, x, y, brushSize, brushSize, x, y, brushSize, brushSize);
            } else {
                 ctx.clearRect(x, y, brushSize, brushSize);
            }
        } else if (tool === 'picker') {
            const pixel = ctx.getImageData(x, y, 1, 1).data;
            if (pixel[3] > 0) {
                 const hex = '#' + [pixel[0], pixel[1], pixel[2]].map(val => val.toString(16).padStart(2, '0')).join('');
                 setBrushColor(hex);
                 setTool('brush'); 
                 return;
            }
        } else {
             ctx.fillStyle = brushColor;
             ctx.fillRect(x, y, brushSize, brushSize);
             setRecentColors(prev => {
                 const newColors = [brushColor, ...prev.filter(c => c !== brushColor)].slice(0, 8);
                 return newColors;
             });
        }
        draw2DView();
    }, [brushColor, tool, brushSize]);

    const handle3DPaint = useCallback((uv: THREE.Vector2) => {
        const { x, y } = getCtxCoords(uv.x, uv.y, CANVAS_SIZE, CANVAS_SIZE);
        performPaint(x, y);
    }, [performPaint]);

    const handle2DPaint = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = e.currentTarget;
        const rect = canvas.getBoundingClientRect();
        const scale = 64 / rect.width; 
        const x = Math.floor((e.clientX - rect.left) * scale);
        const y = Math.floor((e.clientY - rect.top) * scale);
        if (y >= 16) return;
        performPaint(x, y);
    };

    const loadNewSkin = async (base64: string) => {
        await updateCanvases(base64, true);

        const preview = getHeadPreviewFromCanvas(canvasRef.current!);
        const newRootId = generateId();
        const newRoot: HistoryNode = {
            id: newRootId,
            parentId: null,
            textureData: base64,
            previewData: preview,
            timestamp: Date.now(),
            children: [],
            activeChildId: null
        };
        setHistoryNodes({ [newRootId]: newRoot });
        setCurrentId(newRootId);
    }

    const handleImport = async () => {
        let base64 = importInput;
        if (!importInput.includes('=')) {
            const fetched = await fetchSkinFromUsername(importInput);
            if (fetched) {
                base64 = "data:image/png;base64," + fetched;
            } else {
                 alert("Could not find user.");
                 return;
            }
        } else if (!importInput.startsWith('data:image')) {
            base64 = "data:image/png;base64," + importInput;
        }

        await loadNewSkin(base64);
        setImportModalOpen(false);
    };

    const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = async (evt) => {
            const res = evt.target?.result as string;
            if(res) {
                await loadNewSkin(res);
                setImportModalOpen(false);
            }
        }
        reader.readAsDataURL(file);
    }

    const handleDownloadSkin = () => {
        const link = document.createElement('a');
        link.download = 'skin.png';
        link.href = canvasRef.current?.toDataURL() || '';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    const GuideBox = ({ x, y, w, h, label }: {x:number, y:number, w:number, h:number, label: string}) => (
        <div 
            className="absolute border border-white/30 hover:border-white/80 pointer-events-none flex items-center justify-center group"
            style={{ 
                left: `${(x/64)*100}%`, 
                top: `${(y/16)*100}%`, 
                width: `${(w/64)*100}%`, 
                height: `${(h/16)*100}%` 
            }}
        >
            <span className="text-[8px] sm:text-[10px] bg-black/50 text-white px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 select-none">{label}</span>
        </div>
    );

    const getGeneratedCommand = () => {
        const b64 = canvasRef.current?.toDataURL().split(',')[1] || '';
        return `/give @p minecraft:player_head[profile={properties:[{name:"textures",value:"${b64}"}]}] 1`;
    }

    return (
        <div className="flex h-screen bg-gray-900 text-white overflow-hidden font-sans">
            {/* Toolbar */}
            <div className="w-16 flex flex-col items-center py-4 bg-gray-800 border-r border-gray-700 space-y-4 z-20 shrink-0">
                <div className="mb-4">
                    <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-bold text-lg">MH</div>
                </div>
                
                <ToolButton active={tool === 'brush'} onClick={() => setTool('brush')} icon={<PaintBrushIcon className="w-6 h-6"/>} tooltip="Brush" />
                <ToolButton active={tool === 'eraser'} onClick={() => setTool('eraser')} icon={<TrashIcon className="w-6 h-6"/>} tooltip="Eraser (Restore)" />
                <ToolButton active={tool === 'picker'} onClick={() => setTool('picker')} icon={<EyeIcon className="w-6 h-6"/>} tooltip="Color Picker" />
                
                <div className="h-px w-8 bg-gray-600 my-2"></div>
                <div className="flex flex-col items-center space-y-2">
                    <input 
                        type="color" 
                        value={brushColor} 
                        onChange={(e) => setBrushColor(e.target.value)}
                        className="w-8 h-8 p-0 border-0 rounded overflow-hidden cursor-pointer"
                    />
                     <div className="grid grid-cols-2 gap-1 px-2">
                        {recentColors.map(color => (
                            <button 
                                key={color}
                                onClick={() => setBrushColor(color)}
                                className="w-3 h-3 rounded-sm border border-gray-600 hover:scale-125 transition-transform"
                                style={{ backgroundColor: color }}
                                title={color}
                            />
                        ))}
                    </div>
                </div>
                
                <div className="h-px w-8 bg-gray-600 my-2"></div>
                <div className="flex flex-col space-y-2">
                     <button onClick={handleUndo} disabled={!currentId || !historyNodes[currentId]?.parentId} className={`p-2 rounded hover:bg-gray-700 ${!currentId || !historyNodes[currentId]?.parentId ? 'text-gray-600' : 'text-white'}`}>
                        <ArrowUturnLeftIcon className="w-5 h-5"/>
                     </button>
                     <button onClick={handleRedo} disabled={!currentId || (!historyNodes[currentId]?.activeChildId && historyNodes[currentId]?.children.length === 0)} className={`p-2 rounded hover:bg-gray-700 ${!currentId || (!historyNodes[currentId]?.activeChildId && historyNodes[currentId]?.children.length === 0) ? 'text-gray-600' : 'text-white'}`}>
                        <ArrowUturnRightIcon className="w-5 h-5"/>
                     </button>
                </div>
                <div className="h-px w-8 bg-gray-600 my-2"></div>
                <ToolButton active={false} onClick={() => setImportModalOpen(true)} icon={<ArrowDownTrayIcon className="w-6 h-6"/>} tooltip="Import" />
                <ToolButton active={false} onClick={() => setExportModalOpen(true)} icon={<CodeBracketIcon className="w-6 h-6"/>} tooltip="Export / Command" />
            </div>

            {/* Main Area */}
            <div className="flex-1 flex flex-col relative h-full">
                
                {/* Header */}
                <div className="h-14 bg-gray-800 border-b border-gray-700 flex items-center px-6 justify-between shrink-0 z-10">
                    <div className="flex space-x-1 bg-gray-900 p-1 rounded-lg">
                        <button 
                            className={`px-3 py-1 rounded text-sm font-medium flex items-center space-x-1 ${viewMode === ViewMode.Mode3D ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                            onClick={() => setViewMode(ViewMode.Mode3D)}
                        >
                            <CubeIcon className="w-4 h-4"/>
                            <span>3D</span>
                        </button>
                         <button 
                            className={`px-3 py-1 rounded text-sm font-medium flex items-center space-x-1 ${viewMode === ViewMode.Split ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                            onClick={() => setViewMode(ViewMode.Split)}
                        >
                            <Square2StackIcon className="w-4 h-4 transform rotate-90"/>
                            <span>Split</span>
                        </button>
                        <button 
                             className={`px-3 py-1 rounded text-sm font-medium flex items-center space-x-1 ${viewMode === ViewMode.Mode2D ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                             onClick={() => setViewMode(ViewMode.Mode2D)}
                        >
                             <Square2StackIcon className="w-4 h-4"/>
                            <span>2D</span>
                        </button>
                    </div>

                    <div className="flex items-center space-x-6">
                        <div className="flex items-center space-x-2 bg-gray-900 px-3 py-1 rounded-lg border border-gray-700">
                             <span className="text-xs text-gray-500 font-bold uppercase tracking-wider mr-2">Paint Layer</span>
                             <button 
                                onClick={() => setActiveLayer('base')}
                                className={`px-2 py-0.5 rounded text-sm ${activeLayer === 'base' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-gray-300'}`}
                             >
                                 Base
                             </button>
                             <button 
                                onClick={() => setActiveLayer('overlay')}
                                className={`px-2 py-0.5 rounded text-sm ${activeLayer === 'overlay' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-gray-300'}`}
                             >
                                 Overlay
                             </button>
                        </div>
                        
                         <label className="flex items-center space-x-2 text-sm text-gray-300 cursor-pointer select-none">
                            <input type="checkbox" checked={showOverlay} onChange={(e) => setShowOverlay(e.target.checked)} className="rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-offset-gray-800" />
                            <span>Vis: Overlay</span>
                        </label>
                    </div>
                </div>

                {/* Viewports */}
                <div className="flex-1 relative flex overflow-hidden">
                    {(viewMode === ViewMode.Mode3D || viewMode === ViewMode.Split) && (
                        <div className={`relative bg-gray-900 border-r border-gray-800 ${viewMode === ViewMode.Split ? 'w-1/2' : 'w-full'}`}>
                            <div className="absolute top-4 left-4 z-10 text-xs text-white/50 pointer-events-none select-none">
                                Right Click to Rotate • Middle Click to Pan
                            </div>
                            {isCanvasReady && (
                                <Head3D 
                                    canvasRef={canvasRef}
                                    showOverlay={showOverlay} 
                                    activeLayer={activeLayer}
                                    onPaint={handle3DPaint} 
                                    onPaintStart={() => {}} 
                                    onPaintEnd={addHistoryStep}
                                />
                            )}
                        </div>
                    )}
                    {(viewMode === ViewMode.Mode2D || viewMode === ViewMode.Split) && (
                        <div className={`relative bg-[#1a1a1a] flex flex-col items-center justify-center p-8 overflow-auto ${viewMode === ViewMode.Split ? 'w-1/2' : 'w-full'}`}>
                            <h3 className="absolute top-4 left-4 text-gray-500 font-bold text-sm">Texture Map (Head Only)</h3>
                            <div 
                                className="relative shadow-2xl bg-[#000000] border border-gray-700 select-none overflow-hidden" 
                                style={{ width: '512px', height: '128px' }}
                            >
                                <canvas 
                                    ref={view2DRef}
                                    width={512} 
                                    height={128}
                                    className="absolute inset-0 w-full h-full pointer-events-none image-pixelated"
                                />
                                <canvas 
                                    width={512}
                                    height={128}
                                    className="w-full h-full absolute inset-0 cursor-crosshair opacity-0" 
                                    onMouseDown={(e) => { if (e.buttons === 1) handle2DPaint(e); }}
                                    onMouseMove={(e) => { if (e.buttons === 1) handle2DPaint(e); }}
                                    onMouseUp={addHistoryStep}
                                    onMouseLeave={(e) => { if (e.buttons === 1) addHistoryStep(); }}
                                    onClick={handle2DPaint}
                                />
                                <GuideBox x={8} y={0} w={8} h={8} label="Top" />
                                <GuideBox x={16} y={0} w={8} h={8} label="Bottom" />
                                <GuideBox x={0} y={8} w={8} h={8} label="Right" />
                                <GuideBox x={8} y={8} w={8} h={8} label="Front" />
                                <GuideBox x={16} y={8} w={8} h={8} label="Left" />
                                <GuideBox x={24} y={8} w={8} h={8} label="Back" />
                                <GuideBox x={40} y={0} w={8} h={8} label="Over:Top" />
                                <GuideBox x={48} y={0} w={8} h={8} label="Over:Bottom" />
                                <GuideBox x={32} y={8} w={8} h={8} label="Over:Right" />
                                <GuideBox x={40} y={8} w={8} h={8} label="Over:Front" />
                                <GuideBox x={48} y={8} w={8} h={8} label="Over:Left" />
                                <GuideBox x={56} y={8} w={8} h={8} label="Over:Back" />
                            </div>
                        </div>
                    )}
                </div>

                {/* Timeline Panel */}
                <div className={`border-t border-gray-700 bg-gray-800 flex flex-col transition-all duration-300 ${showTimeline ? 'h-64' : 'h-8'}`}>
                    <div 
                        className="h-8 bg-gray-700 flex items-center justify-between px-4 cursor-pointer hover:bg-gray-600 select-none shrink-0"
                    >
                         <div 
                            className="flex items-center space-x-2 text-xs font-bold text-gray-300 uppercase tracking-wider flex-1"
                            onClick={() => setShowTimeline(!showTimeline)}
                         >
                            <ClockIcon className="w-4 h-4" />
                            <span>Timeline Tree</span>
                            {showTimeline ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronUpIcon className="w-4 h-4" />}
                        </div>
                        
                        {showTimeline && (
                            <label className="flex items-center space-x-2 text-xs text-gray-400 hover:text-white cursor-pointer mr-4" onClick={(e) => e.stopPropagation()}>
                                <input type="checkbox" checked={show3DTimeline} onChange={(e) => setShow3DTimeline(e.target.checked)} className="rounded bg-gray-600 border-gray-500" />
                                <span>3D Previews</span>
                            </label>
                        )}
                    </div>
                    
                    {showTimeline && (
                         <div className="flex-1 overflow-auto p-4 custom-scrollbar bg-gray-900/50 relative">
                             {rootId && (
                                 <TimelineNode 
                                    nodeId={rootId}
                                    nodes={historyNodes}
                                    currentId={currentId}
                                    onJump={jumpToStep}
                                    onContextMenu={handleContextMenu}
                                    show3D={show3DTimeline}
                                 />
                             )}
                         </div>
                    )}
                </div>
            </div>

            {/* Context Menu */}
            {contextMenu && (
                <div 
                    className="fixed bg-gray-800 border border-gray-600 shadow-xl rounded py-1 z-50 text-sm min-w-[150px]"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                >
                    <button 
                        disabled={!historyNodes[contextMenu.nodeId] || historyNodes[contextMenu.nodeId].children.length === 0}
                        className={`w-full text-left px-4 py-2 flex items-center ${(!historyNodes[contextMenu.nodeId] || historyNodes[contextMenu.nodeId].children.length === 0) ? 'text-gray-500 cursor-not-allowed' : 'hover:bg-gray-700 text-red-400'}`}
                        onClick={deleteFutureSteps}
                    >
                        <TrashIcon className="w-4 h-4 mr-2" />
                        Prune Future Steps
                    </button>
                </div>
            )}

            {/* Hidden Source of Truth Canvas */}
            <canvas ref={canvasRef} width={64} height={64} className="hidden" />
            <canvas ref={originalCanvasRef} width={64} height={64} className="hidden" />

            {/* Modals */}
            {isImportModalOpen && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
                    <div className="bg-gray-800 p-6 rounded-xl w-96 border border-gray-700 shadow-2xl">
                        <h2 className="text-xl font-bold mb-4">Import Skin</h2>
                        <input 
                            type="text" 
                            placeholder="Username or Base64" 
                            className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white focus:border-blue-500 outline-none"
                            value={importInput}
                            onChange={(e) => setImportInput(e.target.value)}
                        />
                         <div className="my-4 flex items-center">
                            <span className="h-px bg-gray-600 flex-1"></span>
                            <span className="px-2 text-gray-400 text-xs">OR</span>
                            <span className="h-px bg-gray-600 flex-1"></span>
                        </div>
                        <label className="block w-full text-center p-4 border-2 border-dashed border-gray-600 rounded cursor-pointer hover:border-blue-500 hover:text-blue-500 transition-colors text-gray-400 mb-4">
                            <input type="file" accept="image/png" className="hidden" onChange={handleFileImport} />
                            <span className="text-sm">Upload Skin File (PNG)</span>
                        </label>

                        <div className="flex justify-end space-x-2">
                            <button onClick={() => setImportModalOpen(false)} className="px-4 py-2 text-gray-400 hover:text-white">Cancel</button>
                            <button onClick={handleImport} className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-500">Import</button>
                        </div>
                    </div>
                </div>
            )}

            {isExportModalOpen && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
                    <div className="bg-gray-800 p-6 rounded-xl w-[600px] max-h-[90vh] overflow-y-auto border border-gray-700 shadow-2xl flex flex-col">
                        <h2 className="text-xl font-bold mb-4">Export Head</h2>
                        
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-400 mb-2">Texture Base64</label>
                            <textarea 
                                readOnly 
                                value={canvasRef.current?.toDataURL().split(',')[1] || ''} 
                                className="w-full h-24 bg-gray-900 border border-gray-600 rounded p-2 text-xs font-mono text-gray-300 resize-none focus:border-blue-500 outline-none"
                            />
                        </div>

                        <div className="flex space-x-2 mb-6">
                            <button onClick={handleDownloadSkin} className="flex-1 bg-green-600 hover:bg-green-500 py-2 rounded text-sm font-bold flex items-center justify-center transition-colors">
                                <ArrowDownTrayIcon className="w-4 h-4 mr-2"/> Download Skin (.PNG)
                            </button>
                        </div>

                        <div className="mb-4 border-t border-gray-700 pt-4">
                            <label className="block text-sm font-medium text-gray-400 mb-2">Give command</label>
                            <textarea 
                                readOnly 
                                value={getGeneratedCommand()} 
                                className="w-full h-32 bg-gray-900 border border-gray-600 rounded p-2 text-xs font-mono text-green-400 resize-none"
                            />
                        </div>

                        <div className="flex justify-end space-x-2 mt-auto">
                            <button onClick={() => setExportModalOpen(false)} className="px-4 py-2 text-gray-400 hover:text-white">Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const ToolButton = ({ active, onClick, icon, tooltip }: { active: boolean, onClick: () => void, icon: React.ReactNode, tooltip: string }) => (
    <button 
        onClick={onClick}
        title={tooltip}
        className={`p-3 rounded-xl transition-all ${active ? 'bg-