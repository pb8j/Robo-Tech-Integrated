// src/pages/UrdfUploader.jsx
import React, { useRef, useState, Suspense, useEffect, useCallback, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import { Text } from '@react-three/drei';
import { Holistic } from '@mediapipe/holistic';
import { Camera } from '@mediapipe/camera_utils';
import { UrdfRobotModel, CameraUpdater } from '../components/UrdfRobotModel';

const ROBOT_MODELS = {
    hexapod_robot: {
        urdfPath: "/hexapod_robot/crab_model.urdf",
        packagePath: "/",
        name: "Hexapod Robot"
    },
    jaxon_jvrc: {
        urdfPath: "/hexapod_robot2/jaxon_jvrc.urdf",
        packagePath: "/",
        name: "JAXON JVRC"
    }
};

// ** FIX: Define a neutral starting pose for the robot **
// This makes the robot start in a natural "A-Pose" instead of a slumped position.
const NEUTRAL_POSE = {
    'HEAD_JOINT0': 0,        // Head yaw (left/right)
    'HEAD_JOINT1': 0,        // Head pitch (up/down) - 0 is straight
    'LARM_JOINT0': 0.2,      // Left shoulder roll (bring arm down slightly)
    'LARM_JOINT1': Math.PI / 2, // Left shoulder pitch (point arm down)
    'LARM_JOINT4': 0,    // Left elbow slight bend
    'RARM_JOINT0': -0.2,     // Right shoulder roll (bring arm down slightly)
    'RARM_JOINT1': Math.PI / 2, // Right shoulder pitch (point arm down)
    'RARM_JOINT4': 0,     // Right elbow slight bend
};


const UrdfUploader = () => {
    const [urdfFile, setUrdfFile] = useState(null);
    const [meshFiles, setMeshFiles] = useState(new Map());
    const [status, setStatus] = useState("Upload your URDF and mesh files.");
    const [robotLoadRequested, setRobotLoadRequested] = useState(false);

    const urdfInputRef = useRef(null);
    const meshesInputRef = useRef(null);
    const videoRef = useRef(null);
    const holistic = useRef(null);
    const cameraInstance = useRef(null);
    const canvasRef = useRef(null);

    const [poseLandmarks, setPoseLandmarks] = useState(null);
    const [leftHandLandmarks, setLeftHandLandmarks] = useState(null);
    const [rightHandLandmarks, setRightHandLandmarks] = useState(null);
    
    // ** FIX: Initialize the robot's joint states with the neutral pose **
    const [robotJointStates, setRobotJointStates] = useState(NEUTRAL_POSE);
    
    const loadedRobotInstanceRef = useRef(null);
    const [cameraUpdateTrigger, setCameraUpdateTrigger] = useState(0);

    const urdfContentBlobUrl = useMemo(() => {
        if (urdfFile) {
            return URL.createObjectURL(urdfFile);
        }
        return null;
    }, [urdfFile]);

    const fileMapForModel = useMemo(() => {
        const obj = {};
        if (meshFiles) {
            meshFiles.forEach((arrayBuffer, filename) => {
                obj[filename] = URL.createObjectURL(new Blob([arrayBuffer]));
            });
        }
        return obj;
    }, [meshFiles]);

    useEffect(() => {
        return () => {
            console.log("[UrdfUploader Cleanup] Revoking mesh Blob URLs...");
            if (fileMapForModel) {
                Object.values(fileMapForModel).forEach(blobUrl => {
                    try { URL.revokeObjectURL(blobUrl); } catch (e) { console.warn("Error revoking mesh Blob URL:", e); }
                });
            }
        };
    }, [fileMapForModel]);

    const mapRange = (value, inMin, inMax, outMin, outMax) => {
        const clampedValue = Math.max(inMin, Math.min(value, inMax));
        return (clampedValue - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
    };
    
    const calculateAngle = (a, b, c) => {
        if (!a || !b || !c) return 0;
        const rad = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
        let angle = Math.abs(rad);
        if (angle > Math.PI) {
            angle = 2 * Math.PI - angle;
        }
        return angle;
    };

    const onResults = useCallback((results) => {
        // Start with the neutral pose as a base
        const newJointStates = { ...NEUTRAL_POSE };

        if (results.poseLandmarks) {
            setPoseLandmarks(results.poseLandmarks);
            const p = results.poseLandmarks;

            if (loadedRobotInstanceRef.current) {
                // Head control
                if (p[0]) {
                    // ** FIX: Constrained and symmetrical mapping for head yaw **
                    newJointStates['HEAD_JOINT0'] = mapRange(p[0].x, 0.3, 0.7, -Math.PI / 6, Math.PI / 6);
                    // ** FIX: Constrained and symmetrical mapping for head pitch **
                    // Inverted range: moving head up (lower y) gives a positive angle
                    newJointStates['HEAD_JOINT1'] = mapRange(p[0].y, 0.3, 0.5, Math.PI / 6, -Math.PI / 6);
                }

                const lShoulder = p[11];
                const rShoulder = p[12];
                const lElbow = p[13];
                const rElbow = p[14];
                const lWrist = p[15];
                const rWrist = p[16];

                // Left Arm Control
                if (lShoulder && lElbow && lWrist) {
                    // ** FIX: Map shoulder movements relative to the neutral pose **
                    // Centered around 0, represents change from neutral
                    const lShoulderRollDelta = mapRange(lWrist.x, 0.2, 0.8, -Math.PI / 2, Math.PI / 2);
                    const lShoulderPitchDelta = mapRange(lWrist.y, 0.2, 0.8, -Math.PI / 2, Math.PI / 2);
                    const lElbowAngle = calculateAngle(lShoulder, lElbow, lWrist);

                    newJointStates['LARM_JOINT0'] = NEUTRAL_POSE['LARM_JOINT0'] + lShoulderRollDelta;
                    // Start from PI/2 (down) and add the tracked change
                    newJointStates['LARM_JOINT1'] = NEUTRAL_POSE['LARM_JOINT1'] + lShoulderPitchDelta; 
                    // Elbows bend backwards, so map to a negative angle range
                    newJointStates['LARM_JOINT4'] = mapRange(lElbowAngle, 0.5, 3.0, 0, -Math.PI * 0.75); 
                }

                // Right Arm Control
                if (rShoulder && rElbow && rWrist) {
                    const rShoulderRollDelta = mapRange(rWrist.x, 0.2, 0.8, Math.PI / 2, -Math.PI / 2); // Mirrored
                    const rShoulderPitchDelta = mapRange(rWrist.y, 0.2, 0.8, -Math.PI / 2, Math.PI / 2);
                    const rElbowAngle = calculateAngle(rShoulder, rElbow, rWrist);

                    newJointStates['RARM_JOINT0'] = NEUTRAL_POSE['RARM_JOINT0'] + rShoulderRollDelta;
                    newJointStates['RARM_JOINT1'] = NEUTRAL_POSE['RARM_JOINT1'] + rShoulderPitchDelta;
                    newJointStates['RARM_JOINT4'] = mapRange(rElbowAngle, 0.5, 3.0, 0, -Math.PI * 0.75);
                }
            }
        } else {
            setPoseLandmarks(null);
        }

        setLeftHandLandmarks(results.leftHandLandmarks || null);
        setRightHandLandmarks(results.rightHandLandmarks || null);

        // Update state with the fully calculated pose
        setRobotJointStates(newJointStates);

    }, []);

    useEffect(() => {
        const initializeMediaPipe = async () => {
            try {
                console.log("[UrdfUploader] Initializing MediaPipe Holistic...");
                
                holistic.current = new Holistic({
                    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`
                });

                holistic.current.setOptions({
                    modelComplexity: 1, smoothLandmarks: true, enableSegmentation: false,
                    refineFaceLandmarks: false, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5
                });
                holistic.current.onResults(onResults);

                if (videoRef.current) {
                    cameraInstance.current = new Camera(videoRef.current, {
                        onFrame: async () => {
                            if (holistic.current && videoRef.current) {
                                await holistic.current.send({ image: videoRef.current });
                            }
                        },
                        width: 640, height: 480
                    });
                    console.log("[UrdfUploader] Starting camera...");
                    cameraInstance.current.start();
                }
            } catch (error) {
                console.error("[UrdfUploader] Error initializing MediaPipe:", error);
                setStatus("Error initializing body tracking. Please check your camera permissions.");
            }
        };
        initializeMediaPipe();

        return () => {
            console.log("[UrdfUploader] Cleaning up MediaPipe resources...");
            cameraInstance.current?.stop();
            holistic.current?.close();
        };
    }, [onResults]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const canvas = document.createElement('canvas');
        canvasRef.current = canvas;
        const parentNode = video.parentNode;
        if (!parentNode) return;
        
        let animationFrameId;

        const onPlaying = () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.className = video.className;
            parentNode.insertBefore(canvas, video);
            video.style.display = 'none';

            const ctx = canvas.getContext('2d');
            const drawLandmarks = (landmarks, color) => {
                if (!landmarks) return;
                ctx.fillStyle = color;
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 1;

                for (const landmark of landmarks) {
                    const x = landmark.x * canvas.width;
                    const y = landmark.y * canvas.height;
                    ctx.beginPath();
                    ctx.arc(x, y, 4, 0, 2 * Math.PI);
                    ctx.fill();
                    ctx.stroke();
                }
            };
            const renderLoop = () => {
                if (canvas.width > 0 && canvas.height > 0) {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.save();
                    ctx.scale(-1, 1);
                    ctx.translate(-canvas.width, 0);
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    ctx.restore();
                    if (poseLandmarks) drawLandmarks(poseLandmarks, '#4285F4');
                    if (leftHandLandmarks) drawLandmarks(leftHandLandmarks, '#EA4335');
                    if (rightHandLandmarks) drawLandmarks(rightHandLandmarks, '#34A853');
                }
                animationFrameId = requestAnimationFrame(renderLoop);
            };
            renderLoop();
        };
        video.addEventListener('playing', onPlaying);

        return () => {
            cancelAnimationFrame(animationFrameId);
            video.removeEventListener('playing', onPlaying);
            if (canvasRef.current?.parentNode) {
                canvasRef.current.parentNode.removeChild(canvasRef.current);
            }
            if (video) {
                video.style.display = 'block';
            }
        };
    }, [poseLandmarks, leftHandLandmarks, rightHandLandmarks]);

    const handleUrdfFileChange = useCallback((event) => {
        const file = event.target.files[0];
        if (file && file.name.toLowerCase().endsWith('.urdf')) {
            setUrdfFile(file);
            setStatus(`URDF file selected: ${file.name}`);
        } else {
            setStatus("Please select a valid URDF file (.urdf extension).");
            setUrdfFile(null);
        }
    }, []);

    const handleMeshFilesChange = useCallback(async (event) => {
        const files = Array.from(event.target.files);
        const newMeshFiles = new Map();
        setStatus("Processing mesh files...");
        try {
            for (const file of files) {
                const arrayBuffer = await file.arrayBuffer();
                newMeshFiles.set(file.name, arrayBuffer);
            }
            setMeshFiles(newMeshFiles);
            setStatus(`${files.length} mesh files loaded successfully.`);
        } catch (error) {
            console.error("[UrdfUploader] Error processing mesh files:", error);
            setStatus("Error processing mesh files. Please try again.");
            setMeshFiles(new Map());
        }
    }, []);

    const handleLoadRobot = useCallback(() => {
        if (!urdfFile || meshFiles.size === 0) {
            setStatus("Please select mesh files.");
            return;
        }
        setRobotLoadRequested(true);
        setStatus("Loading robot model...");
    }, [urdfFile, meshFiles]);

    const handleRobotLoaded = useCallback((robotInstance) => {
        loadedRobotInstanceRef.current = robotInstance;
        setCameraUpdateTrigger(prev => prev + 1);
        setStatus(`Robot loaded successfully! Use your body to control the robot.`);
        console.log("Available robot joints:", Object.keys(robotInstance.joints));
    }, []);

    const handleClearFiles = useCallback(() => {
        setUrdfFile(null);
        setMeshFiles(new Map());
        setRobotLoadRequested(false);
        loadedRobotInstanceRef.current = null;
        // ** FIX: Reset the robot to its neutral pose when clearing files **
        setRobotJointStates(NEUTRAL_POSE);
        setStatus("Files cleared. Upload new URDF and mesh files.");
        if (urdfInputRef.current) urdfInputRef.current.value = '';
        if (meshesInputRef.current) meshesInputRef.current.value = '';
    }, []);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 text-white">
            <div className="max-w-full mx-auto h-screen flex flex-col">
                <div className="bg-gradient-to-r from-purple-800/20 to-cyan-800/20 backdrop-blur-sm border-b border-purple-500/20 p-6">
                    <h1 className="text-4xl font-bold text-center bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                        URDF Robot Body Control
                    </h1>
                </div>

                <div className="flex-1 flex relative">
                    <div className="w-80 bg-gradient-to-b from-slate-800/40 to-slate-900/60 backdrop-blur-sm border-r border-purple-500/20 p-6 overflow-y-auto">
                        <h2 className="text-2xl font-semibold mb-6 text-cyan-300">File Upload</h2>
                        
                        <div className="mb-6">
                            <label className="block text-sm font-medium mb-3 text-purple-300">
                                URDF File (.urdf)
                            </label>
                            <input
                                ref={urdfInputRef} type="file" accept=".urdf"
                                onChange={handleUrdfFileChange}
                                className="w-full p-3 bg-slate-800/50 border border-purple-500/30 rounded-xl text-white backdrop-blur-sm hover:border-cyan-400/50 transition-all duration-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gradient-to-r file:from-purple-600 file:to-cyan-600 file:text-white hover:file:from-purple-700 hover:file:to-cyan-700"
                            />
                            {urdfFile && (<p className="mt-3 text-sm text-emerald-400 bg-emerald-900/20 p-2 rounded-lg">✓ Selected: {urdfFile.name}</p>)}
                        </div>

                        <div className="mb-6">
                            <label className="block text-sm font-medium mb-3 text-purple-300">
                                Mesh Files (.dae, .stl, .obj, etc.)
                            </label>
                            <input
                                ref={meshesInputRef} type="file" multiple accept=".dae,.stl,.obj,.ply,.fbx,.gltf,.glb"
                                onChange={handleMeshFilesChange}
                                className="w-full p-3 bg-slate-800/50 border border-purple-500/30 rounded-xl text-white backdrop-blur-sm hover:border-cyan-400/50 transition-all duration-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gradient-to-r file:from-purple-600 file:to-cyan-600 file:text-white hover:file:from-purple-700 hover:file:to-cyan-700"
                            />
                            {meshFiles.size > 0 && (
                                <div className="mt-3 text-sm text-emerald-400 bg-emerald-900/20 p-3 rounded-lg">
                                    <p className="font-semibold">✓ {meshFiles.size} mesh files loaded:</p>
                                    <ul className="list-disc list-inside ml-2 max-h-32 overflow-y-auto mt-2 space-y-1">
                                        {Array.from(meshFiles.keys()).map(filename => (<li key={filename} className="text-xs text-emerald-300">{filename}</li>))}
                                    </ul>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col space-y-3 mb-6">
                            <button onClick={handleLoadRobot} disabled={!urdfFile || meshFiles.size === 0} className="w-full bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 disabled:hover:scale-100 shadow-lg hover:shadow-purple-500/25">
                                Load Robot
                            </button>
                            <button onClick={handleClearFiles} className="w-full bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-red-500/25">
                                Clear Files
                            </button>
                        </div>

                        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-purple-500/20 mb-6">
                            <p className="text-sm text-cyan-300">{status}</p>
                        </div>

                        <div className="bg-gradient-to-br from-purple-800/20 to-cyan-800/20 backdrop-blur-sm rounded-xl p-4 border border-purple-500/20">
                            <h3 className="text-sm font-semibold mb-3 text-purple-300">Body Controls:</h3>
                            <ul className="text-xs space-y-2 text-slate-300">
                                <li className="flex items-center space-x-2"><span className="w-2 h-2 bg-blue-400 rounded-full"></span><span>Head position controls robot head</span></li>
                                <li className="flex items-center space-x-2"><span className="w-2 h-2 bg-red-400 rounded-full"></span><span>Left hand controls left arm</span></li>
                                <li className="flex items-center space-x-2"><span className="w-2 h-2 bg-green-400 rounded-full"></span><span>Right hand controls right arm</span></li>
                                <li className="flex items-center space-x-2"><span className="w-2 h-2 bg-purple-400 rounded-full"></span><span>Move naturally to control the robot</span></li>
                            </ul>
                        </div>
                    </div>

                    <div className="flex-1 relative">
                        {robotLoadRequested && urdfContentBlobUrl ? (
                            <div className="w-full h-full bg-white">
                                <Canvas camera={{ position: [2, 2, 2], fov: 50 }} style={{ width: '100%', height: '100%' }}>
                                    <ambientLight intensity={0.8} />
                                    <directionalLight position={[5, 5, 5]} intensity={1} />
                                    <pointLight position={[-5, 5, 5]} intensity={0.3} />
                                    <Suspense fallback={<Text position={[0, 0, 0]} fontSize={0.5} color="black" anchorX="center" anchorY="middle">Loading Robot...</Text>}>
                                        <UrdfRobotModel urdfContent={urdfContentBlobUrl} fileMap={fileMapForModel} jointStates={robotJointStates} selectedRobotName="uploaded_robot" onRobotLoaded={handleRobotLoaded} initialPosition={[0, 0, 0]} scale={1.0}/>
                                    </Suspense>
                                    <CameraUpdater loadedRobotInstanceRef={loadedRobotInstanceRef} triggerUpdate={cameraUpdateTrigger}/>
                                    <Environment preset="warehouse" />
                                    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
                                        <planeGeometry args={[10, 10]} />
                                        <meshStandardMaterial color="#f0f0f0" />
                                    </mesh>
                                </Canvas>
                            </div>
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-white">
                                <div className="text-center">
                                    <div className="w-24 h-24 mx-auto mb-6 bg-gray-100 border border-gray-200 rounded-full flex items-center justify-center">
                                        <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                                    </div>
                                    <h3 className="text-2xl font-semibold text-gray-800 mb-2">Upload Robot Files</h3>
                                    <p className="text-gray-500">Select URDF and mesh files to load your robot</p>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="absolute right-4 top-4 w-64 h-48 m-2 z-10">
                        <video ref={videoRef} className="w-full h-full bg-black rounded-lg border-2 border-purple-500/50 shadow-lg object-cover" autoPlay muted playsInline style={{transform: 'scaleX(-1)'}}/>
                        <div className="absolute top-2 right-2">
                            {poseLandmarks ? <span className="bg-emerald-500/80 text-white px-2 py-1 rounded-full text-xs font-semibold shadow">👤 Tracking</span> : <span className="bg-red-600/80 text-white px-2 py-1 rounded-full text-xs font-semibold shadow">❌ No User</span>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UrdfUploader;
