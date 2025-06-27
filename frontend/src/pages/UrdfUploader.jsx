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
    const [robotJointStates, setRobotJointStates] = useState({});
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
        if (results.poseLandmarks) {
            setPoseLandmarks(results.poseLandmarks);
            
            // Head control (using nose landmark)
            if (results.poseLandmarks[0] && loadedRobotInstanceRef.current) {
                const headYaw = mapRange(results.poseLandmarks[0].x, 0, 1, Math.PI, -Math.PI);
                const headPitch = mapRange(results.poseLandmarks[0].y, 0, 1, Math.PI, -Math.PI);
                
                setRobotJointStates(prev => ({
                    ...prev,
                    'HEAD_JOINT0': -headYaw,
                    'HEAD_JOINT1': -headPitch,
                }));
            }
        } else {
            setPoseLandmarks(null);
        }

        // Left arm control
        if (results.leftHandLandmarks) {
        setLeftHandLandmarks(results.leftHandLandmarks);

        if (loadedRobotInstanceRef.current) {
            const wrist = results.leftHandLandmarks[0];
            const elbow = results.poseLandmarks?.[13]; // Left elbow landmark
            const shoulder = results.poseLandmarks?.[11]; // Left shoulder landmark

            if (wrist && elbow && shoulder) {
                const shoulderPitch = mapRange(wrist.y, 0, 0.75, Math.PI, -Math.PI/6);
                const shoulderRoll = mapRange(wrist.x, 0, 1, Math.PI/4, -Math.PI/4);

                // Calculate left elbow angle
                const leftElbowAngleRad = calculateAngle(shoulder, elbow, wrist);

                // *** MODIFIED ELBOW MAPPING LOGIC ***
                // InMin/InMax: Adjusted based on common human elbow range.
                // A straight arm is close to Math.PI (180 deg), a bent arm is closer to 0 or 0.1-0.3 (0-15 deg).
                const humanElbowMinAngle = 0.1; // Small angle when arm is fully bent (e.g., 5-10 degrees)
                const humanElbowMaxAngle = Math.PI - 0.1; // Close to 180 degrees for a straight arm

                // OutMin/OutMax: Adjusted for the robot's elbow joint.
                // Assuming 0 for straight arm and Math.PI/2 (90 degrees) for a bent arm.
                // We want to map straight human arm (humanElbowMaxAngle) to straight robot arm (robotElbowStraightAngle).
                // We want to map bent human arm (humanElbowMinAngle) to bent robot arm (robotElbowBentAngle).
                const robotElbowStraightAngle = 0; // Robot's angle when arm is straight
                const robotElbowBentAngle = Math.PI / 2; // Robot's angle when arm is bent to 90 degrees

                // To fix the inversion: map high human angle to low robot angle, and low human angle to high robot angle.
                const elbowJointAngle = mapRange(leftElbowAngleRad, humanElbowMinAngle, humanElbowMaxAngle, robotElbowBentAngle, robotElbowStraightAngle);

                setRobotJointStates(prev => ({
                    ...prev,
                    'LARM_JOINT0': -shoulderRoll,
                    'LARM_JOINT1': -shoulderPitch,
                    'LARM_JOINT4': -elbowJointAngle, // Removed the negation here, as mapRange handles it
                }));
            }
        }
    } else {
        setLeftHandLandmarks(null);
    }

        // Right arm control
        if (results.rightHandLandmarks) {
        setRightHandLandmarks(results.rightHandLandmarks);

        if (loadedRobotInstanceRef.current) {
            const wrist = results.rightHandLandmarks[0];
            const elbow = results.poseLandmarks?.[14]; // Right elbow landmark
            const shoulder = results.poseLandmarks?.[12]; // Right shoulder landmark

            if (wrist && elbow && shoulder) {
                const shoulderPitch = mapRange(wrist.y, 0, 0.75, Math.PI, -Math.PI/6);
                const shoulderRoll = mapRange(wrist.x, 0, 1, Math.PI/4, -Math.PI/4);

                // Calculate right elbow angle
                const rightElbowAngleRad = calculateAngle(shoulder, elbow, wrist);

                // *** MODIFIED ELBOW MAPPING LOGIC ***
                const humanElbowMinAngle = 0.1;
                const humanElbowMaxAngle = Math.PI - 0.1;

                const robotElbowStraightAngle = 0;
                const robotElbowBentAngle = Math.PI / 2;

                const elbowJointAngle = mapRange(rightElbowAngleRad, humanElbowMinAngle, humanElbowMaxAngle, robotElbowBentAngle, robotElbowStraightAngle);

                setRobotJointStates(prev => ({
                    ...prev,
                    'RARM_JOINT0': -shoulderRoll,
                    'RARM_JOINT1': -shoulderPitch,
                    'RARM_JOINT4': -elbowJointAngle, 
                }));
            }
        }
    } else {
        setRightHandLandmarks(null);
        }
    }, []);

    useEffect(() => {
        const initializeMediaPipe = async () => {
            try {
                console.log("[UrdfUploader] Initializing MediaPipe Holistic...");
                
                holistic.current = new Holistic({
                    locateFile: (file) => {
                        return `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`;
                    }
                });

                holistic.current.setOptions({
                    modelComplexity: 1,
                    smoothLandmarks: true,
                    enableSegmentation: false,
                    smoothSegmentation: false,
                    refineFaceLandmarks: true,
                    minDetectionConfidence: 0.5,
                    minTrackingConfidence: 0.5
                });

                holistic.current.onResults(onResults);

                if (videoRef.current) {
                    cameraInstance.current = new Camera(videoRef.current, {
                        onFrame: async () => {
                            if (holistic.current && videoRef.current) {
                                await holistic.current.send({ image: videoRef.current });
                            }
                        },
                        width: 640,
                        height: 480
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
            if (cameraInstance.current) {
                cameraInstance.current.stop();
            }
            if (holistic.current) {
                holistic.current.close();
            }
        };
    }, [onResults]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        canvasRef.current = canvas;

        const drawLandmarks = (landmarks, color) => {
            if (!landmarks) return;
            
            ctx.fillStyle = color;
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            
            for (const landmark of landmarks) {
                const x = landmark.x * video.videoWidth;
                const y = landmark.y * video.videoHeight;
                
                ctx.beginPath();
                ctx.arc(x, y, 5, 0, 2 * Math.PI,true);
                ctx.fill();
            }
        };

        const draw = () => {
            if (video.videoWidth === 0 || video.videoHeight === 0) return;
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            if (poseLandmarks) drawLandmarks(poseLandmarks, '#4285F4');
            if (leftHandLandmarks) drawLandmarks(leftHandLandmarks, '#EA4335');
            if (rightHandLandmarks) drawLandmarks(rightHandLandmarks, '#34A853');
            
            requestAnimationFrame(draw);
        };
        
        draw();
        
        video.parentNode.insertBefore(canvas, video);
        video.style.display = 'none';
        
        return () => {
            if (canvasRef.current) {
                canvasRef.current.remove();
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
            console.log("[UrdfUploader] URDF file selected:", file.name);
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
                console.log(`[UrdfUploader] Processed mesh file: ${file.name} (${arrayBuffer.byteLength} bytes)`);
            }
            
            setMeshFiles(newMeshFiles);
            setStatus(`${files.length} mesh files loaded successfully.`);
            console.log("[UrdfUploader] All mesh files processed:", Array.from(newMeshFiles.keys()));
        } catch (error) {
            console.error("[UrdfUploader] Error processing mesh files:", error);
            setStatus("Error processing mesh files. Please try again.");
            setMeshFiles(new Map());
        }
    }, []);

    const handleLoadRobot = useCallback(() => {
        if (!urdfFile) {
            setStatus("Please select a URDF file first.");
            return;
        }
        
        if (meshFiles.size === 0) {
            setStatus("Please select mesh files (.dae, .stl, .obj, etc.).");
            return;
        }

        setRobotLoadRequested(true);
        setStatus("Loading robot model...");
        console.log("[UrdfUploader] Robot load requested with URDF:", urdfFile.name, "and", meshFiles.size, "mesh files");
    }, [urdfFile, meshFiles]);

    const handleRobotLoaded = useCallback((robotInstance) => {
        loadedRobotInstanceRef.current = robotInstance;
        setCameraUpdateTrigger(prev => prev + 1);
        setStatus(`Robot loaded successfully! Use your body to control the robot.`);
        console.log("[UrdfUploader] Robot loaded and ready for body control:", robotInstance);
    }, []);

    const handleClearFiles = useCallback(() => {
        setUrdfFile(null);
        setMeshFiles(new Map());
        setRobotLoadRequested(false);
        loadedRobotInstanceRef.current = null;
        setRobotJointStates({});
        setStatus("Files cleared. Upload new URDF and mesh files.");
        
        if (urdfInputRef.current) urdfInputRef.current.value = '';
        if (meshesInputRef.current) meshesInputRef.current.value = '';
        
        console.log("[UrdfUploader] All files and states cleared.");
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
                                ref={urdfInputRef}
                                type="file"
                                accept=".urdf"
                                onChange={handleUrdfFileChange}
                                className="w-full p-3 bg-slate-800/50 border border-purple-500/30 rounded-xl text-white backdrop-blur-sm hover:border-cyan-400/50 transition-all duration-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gradient-to-r file:from-purple-600 file:to-cyan-600 file:text-white hover:file:from-purple-700 hover:file:to-cyan-700"
                            />
                            {urdfFile && (
                                <p className="mt-3 text-sm text-emerald-400 bg-emerald-900/20 p-2 rounded-lg">
                                    ✓ Selected: {urdfFile.name}
                                </p>
                            )}
                        </div>

                        <div className="mb-6">
                            <label className="block text-sm font-medium mb-3 text-purple-300">
                                Mesh Files (.dae, .stl, .obj, etc.)
                            </label>
                            <input
                                ref={meshesInputRef}
                                type="file"
                                multiple
                                accept=".dae,.stl,.obj,.ply,.fbx,.gltf,.glb"
                                onChange={handleMeshFilesChange}
                                className="w-full p-3 bg-slate-800/50 border border-purple-500/30 rounded-xl text-white backdrop-blur-sm hover:border-cyan-400/50 transition-all duration-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gradient-to-r file:from-purple-600 file:to-cyan-600 file:text-white hover:file:from-purple-700 hover:file:to-cyan-700"
                            />
                            {meshFiles.size > 0 && (
                                <div className="mt-3 text-sm text-emerald-400 bg-emerald-900/20 p-3 rounded-lg">
                                    <p className="font-semibold">✓ {meshFiles.size} mesh files loaded:</p>
                                    <ul className="list-disc list-inside ml-2 max-h-32 overflow-y-auto mt-2 space-y-1">
                                        {Array.from(meshFiles.keys()).map(filename => (
                                            <li key={filename} className="text-xs text-emerald-300">{filename}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col space-y-3 mb-6">
                            <button
                                onClick={handleLoadRobot}
                                disabled={!urdfFile || meshFiles.size === 0}
                                className="w-full bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 disabled:hover:scale-100 shadow-lg hover:shadow-purple-500/25"
                            >
                                Load Robot
                            </button>
                            <button
                                onClick={handleClearFiles}
                                className="w-full bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-red-500/25"
                            >
                                Clear Files
                            </button>
                        </div>

                        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-purple-500/20 mb-6">
                            <p className="text-sm text-cyan-300">{status}</p>
                        </div>

                        <div className="bg-gradient-to-br from-purple-800/20 to-cyan-800/20 backdrop-blur-sm rounded-xl p-4 border border-purple-500/20">
                            <h3 className="text-sm font-semibold mb-3 text-purple-300">Body Controls:</h3>
                            <ul className="text-xs space-y-2 text-slate-300">
                                <li className="flex items-center space-x-2">
                                    <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                                    <span>Head position controls robot head</span>
                                </li>
                                <li className="flex items-center space-x-2">
                                    <span className="w-2 h-2 bg-red-400 rounded-full"></span>
                                    <span>Left hand controls left arm</span>
                                </li>
                                <li className="flex items-center space-x-2">
                                    <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                                    <span>Right hand controls right arm</span>
                                </li>
                                <li className="flex items-center space-x-2">
                                    <span className="w-2 h-2 bg-purple-400 rounded-full"></span>
                                    <span>Move naturally to control the robot</span>
                                </li>
                            </ul>
                        </div>
                    </div>

                    <div className="flex-1 relative">
    {robotLoadRequested && urdfContentBlobUrl ? (
        // The background is now set to white
        <div className="w-full h-full bg-white">
            <Canvas
                camera={{ position: [2, 2, 2], fov: 50 }}
                style={{ width: '100%', height: '100%' }}
            >
                {/* Lights adjusted slightly for a brighter scene */}
                <ambientLight intensity={0.8} />
                <directionalLight position={[5, 5, 5]} intensity={1} />
                <pointLight position={[-5, 5, 5]} intensity={0.3} />
                
                <Suspense fallback={
                    // Fallback text color is changed to black to be visible on white
                    <Text
                        position={[0, 0, 0]}
                        fontSize={0.5}
                        color="black" 
                        anchorX="center"
                        anchorY="middle"
                    >
                        Loading Robot...
                    </Text>
                }>
                    <UrdfRobotModel
                        urdfContent={urdfContentBlobUrl}
                        fileMap={fileMapForModel}
                        jointStates={robotJointStates}
                        selectedRobotName="uploaded_robot"
                        onRobotLoaded={handleRobotLoaded}
                        initialPosition={[0, 0, 0]}
                        scale={1.0}
                    />
                </Suspense>

                <CameraUpdater
                    loadedRobotInstanceRef={loadedRobotInstanceRef}
                    triggerUpdate={cameraUpdateTrigger}
                />
                
                <Environment preset="warehouse" />
                
                {/* The ground plane remains, providing a surface for the robot */}
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
                    <planeGeometry args={[10, 10]} />
                    <meshStandardMaterial color="#f0f0f0" />
                </mesh>
            </Canvas>
        </div>
    ) : (
        // The placeholder background is also set to white
        <div className="w-full h-full flex items-center justify-center bg-white">
            <div className="text-center">
                {/* Icon container style updated for a light background */}
                <div className="w-24 h-24 mx-auto mb-6 bg-gray-100 border border-gray-200 rounded-full flex items-center justify-center">
                    {/* Icon color changed to be visible */}
                    <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                </div>
                {/* Text colors updated for a light background */}
                <h3 className="text-2xl font-semibold text-gray-800 mb-2">Upload Robot Files</h3>
                <p className="text-gray-500">Select URDF and mesh files to load your robot</p>
            </div>
        </div>
    )}
</div>
                    {/* Smaller camera feed positioned in upper right corner */}
                    <div className="absolute right-3 top-0 w-16 h-16 m-2">
                        <video
                            ref={videoRef}
                            className="w-full h-full bg-black rounded-lg border border-purple-500/30"
                            autoPlay
                            muted
                            playsInline
                        />
                        {poseLandmarks && (
                            <div className="absolute top-1 left-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-2 py-0.5 rounded-full text-xs font-semibold shadow-lg">
                                👤
                            </div>
                        )}
                        {!poseLandmarks && (
                            <div className="absolute top-1 left-1 bg-gradient-to-r from-slate-600 to-slate-700 text-white px-2 py-0.5 rounded-full text-xs font-semibold">
                                ❌
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UrdfUploader;