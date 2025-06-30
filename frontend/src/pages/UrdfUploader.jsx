// src/pages/UrdfUploader.jsx
import React, { useRef, useState, Suspense, useEffect, useCallback, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import { Text } from '@react-three/drei';
import { Holistic } from '@mediapipe/holistic';
import { Camera } from '@mediapipe/camera_utils';
import { UrdfRobotModel, CameraUpdater } from '../components/UrdfRobotModel';
import VideoRecorder from '../components/VideoRecorder';

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
    // State variables
    const [urdfFile, setUrdfFile] = useState(null);
    const [meshFiles, setMeshFiles] = useState(new Map()); 
    const [status, setStatus] = useState("Upload your URDF and mesh files.");
    const [robotLoadRequested, setRobotLoadRequested] = useState(false);
    
    // Video recording and playback states
    const [recordedVideoBlob, setRecordedVideoBlob] = useState(null);
    const [isPlayingRecordedVideo, setIsPlayingRecordedVideo] = useState(false);
    const [recordedJointStatesSequence, setRecordedJointStatesSequence] = useState([]); 
    const [isPlayingRecordedData, setIsPlayingRecordedData] = useState(false); // Controls robot animation from recorded data

    // MediaPipe and Robot control states
    const [poseLandmarks, setPoseLandmarks] = useState(null); // Live MediaPipe landmarks
    const [leftHandLandmarks, setLeftHandLandmarks] = useState(null); // Live MediaPipe landmarks
    const [rightHandLandmarks, setRightHandLandmarks] = useState(null); // Live MediaPipe landmarks
    const [robotJointStates, setRobotJointStates] = useState({}); // Current joint states for the robot

    // Refs for DOM elements and MediaPipe instances
    const urdfInputRef = useRef(null);
    const meshesInputRef = useRef(null);
    const videoRef = useRef(null); // Hidden video for MediaPipe camera feed input
    const holistic = useRef(null);
    const cameraInstance = useRef(null);
    const canvasRef = useRef(null); // React-Three-Fiber Canvas ref
    const drawingCanvasRef = useRef(null); // HTML Canvas for MediaPipe landmark drawing (visible)
    const recordedVideoPlayerRef = useRef(null); // Ref for the playback video element in UrdfUploader
    
    const loadedRobotInstanceRef = useRef(null); // Ref to hold the loaded Three.js robot object
    const [cameraUpdateTrigger, setCameraUpdateTrigger] = useState(0); // Trigger for CameraUpdater

    const currentJointStatesBufferRef = useRef([]); // Buffer to accumulate joint states during recording
    const isRecordingActiveRef = useRef(false); // Ref for recording active status 


    // For joint state smoothing
    const prevJointStatesRef = useRef({}); // Store previous joint states for interpolation
    const smoothingFactor = 0.3; // Adjust this value (0.1 to 0.9) for more/less smoothing

    // Memoized URLs for URDF and meshes
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

    // Cleanup for mesh Blob URLs
    useEffect(() => {
        return () => {
            console.log("[UrdfUploader Cleanup] Revoking mesh Blob URLs.");
            if (fileMapForModel) {
                Object.values(fileMapForModel).forEach(blobUrl => {
                    try { URL.revokeObjectURL(blobUrl); } catch (e) { console.warn("Error revoking mesh Blob URL:", e); }
                });
            }
        };
    }, [fileMapForModel]);

    // Utility functions for angle calculation
    const mapRange = useCallback((value, inMin, inMax, outMin, outMax) => {
        const clampedValue = Math.max(inMin, Math.min(value, inMax));
        return (clampedValue - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
    }, []);

    const calculateAngle = useCallback((a, b, c) => {
        if (!a || !b || !c) return 0;
        const rad = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
        let angle = Math.abs(rad);
        if (angle > Math.PI) {
            angle = 2 * Math.PI - angle;
        }
        return angle;
    }, []);

    // Callback from VideoRecorder to update recording status and collect data
    const handleRecordingStatusChange = useCallback((message, isRecordingNow) => {
        setStatus(message);
        isRecordingActiveRef.current = isRecordingNow; // Update the ref directly 
        console.log("[UrdfUploader] isRecordingActiveRef updated to:", isRecordingNow); 

        if (!isRecordingNow) { // Recording stopped
            console.log("[UrdfUploader] Joint states buffer length on recording stop:", currentJointStatesBufferRef.current.length); 

            if (currentJointStatesBufferRef.current.length > 0) {
                setRecordedJointStatesSequence([...currentJointStatesBufferRef.current]); 
                console.log("[UrdfUploader] Final recorded joint states sequence length:", currentJointStatesBufferRef.current.length);
            } else {
                setRecordedJointStatesSequence([]);
                console.warn("[UrdfUploader] No joint states recorded during session.");
            }
            currentJointStatesBufferRef.current = []; // Clear buffer
        } else { // Recording started
            currentJointStatesBufferRef.current = []; // Ensure buffer is clear at start
            setRecordedJointStatesSequence([]); // Clear any previous recorded sequence
            prevJointStatesRef.current = {}; // Reset smoothing on new recording
            console.log("[UrdfUploader] Recording started. Joint states buffer cleared.");
        }
    }, []);

    // Callback from VideoRecorder when video blob is available
    const handleVideoAvailable = useCallback((blob) => {
        setRecordedVideoBlob(blob);
    }, []);

    // Callback from VideoRecorder to start playing recorded joint states
    const handlePlayRecordedData = useCallback((playbackData) => { 
        setIsPlayingRecordedData(true); // Signal that recorded data is now the source for the robot
        prevJointStatesRef.current = {}; // Reset smoothing for playback

        const videoPlayer = recordedVideoPlayerRef.current;
        if (!videoPlayer || playbackData.length === 0) {
            console.warn("[UrdfUploader] Playback data or video player not ready. Robot will not animate.");
            setIsPlayingRecordedData(false); // No data to play, so reset the flag
            setRobotJointStates({}); // Clear robot pose
            return;
        }

        const frameRate = 30; // Assumed recording FPS

        // Function to update robot pose based on video time
        const updateRobotPose = () => {
            // These conditions are crucial to stop the animation loop
            if (!isPlayingRecordedVideo || !isPlayingRecordedData || !videoPlayer || videoPlayer.paused || videoPlayer.ended) {
                console.log("[UrdfUploader] Stopping robot animation loop (video stopped, paused, ended, or data playback disabled).");
                setRobotJointStates({}); // Reset robot pose to default
                setIsPlayingRecordedData(false); // Ensure this flag is false on stop
                if (videoPlayer) {
                    videoPlayer.removeEventListener('timeupdate', updateRobotPose); 
                    videoPlayer.removeEventListener('pause', updateRobotPose); 
                    videoPlayer.removeEventListener('ended', updateRobotPose); 
                }
                return;
            }

            const currentTime = videoPlayer.currentTime; 
            const totalFrames = playbackData.length; 
            const frameIndexFloat = currentTime * frameRate; 

            const lowerIndex = Math.floor(frameIndexFloat);
            const upperIndex = Math.ceil(frameIndexFloat);
            const alpha = frameIndexFloat - lowerIndex; 

            let interpolatedStates = {};

            if (lowerIndex >= 0 && lowerIndex < totalFrames) {
                const currentFrameStates = playbackData[lowerIndex]; 
                if (upperIndex < totalFrames && alpha > 0) {
                    const nextFrameStates = playbackData[upperIndex]; 
                    for (const jointName in currentFrameStates) {
                        if (typeof currentFrameStates[jointName] === 'number' && typeof nextFrameStates[jointName] === 'number') {
                            interpolatedStates[jointName] = currentFrameStates[jointName] + (nextFrameStates[jointName] - currentFrameStates[jointName]) * alpha;
                        } else {
                            interpolatedStates[jointName] = currentFrameStates[jointName]; 
                        }
                    }
                } else {
                    interpolatedStates = { ...currentFrameStates };
                }
            } else if (totalFrames > 0) { 
                interpolatedStates = { ...playbackData[totalFrames - 1] }; 
            } else {
                console.warn("[UrdfUploader] No recorded joint data to animate for current frame.");
                interpolatedStates = {};
            }
            
            const finalSmoothedStates = {};
            const previousStates = prevJointStatesRef.current; 
            for (const jointName in interpolatedStates) {
                if (typeof interpolatedStates[jointName] === 'number') {
                    const currentVal = previousStates[jointName] !== undefined ? previousStates[jointName] : interpolatedStates[jointName];
                    finalSmoothedStates[jointName] = currentVal + (interpolatedStates[jointName] - currentVal) * smoothingFactor;
                }
            }
            // Ensure React detects the state change by always providing a new object
            setRobotJointStates({ ...finalSmoothedStates });
            prevJointStatesRef.current = { ...finalSmoothedStates }; 
        };
        
        // Add event listeners for video playback to drive robot animation
        videoPlayer.removeEventListener('timeupdate', updateRobotPose);
        videoPlayer.removeEventListener('pause', updateRobotPose); 
        videoPlayer.removeEventListener('ended', updateRobotPose); 

        videoPlayer.addEventListener('timeupdate', updateRobotPose);
        videoPlayer.addEventListener('pause', updateRobotPose); 
        videoPlayer.addEventListener('ended', updateRobotPose); 
        
        // Call once immediately to set initial pose from the start of the recorded data
        updateRobotPose();

        console.log("[UrdfUploader] Robot animation started, synchronized with video playback.");

    }, [isPlayingRecordedVideo, smoothingFactor, recordedVideoPlayerRef]);

    // MediaPipe results processing (for live robot control)
    const onResults = useCallback((results) => {
        // !!! IMPORTANT: If recorded data is playing, EXIT IMMEDIATELY to prevent live control !!!
        if (isPlayingRecordedData) {
            // console.log("[UrdfUploader] onResults: Skipping live update as recorded data is playing."); // Debugging
            return;
        }
        
        // Use the ref for recording status
        const isCurrentlyRecording = isRecordingActiveRef.current; 
        // console.log("onResults: isCurrentlyRecording =", isCurrentlyRecording); 

        let newJointStates = {};

        if (results.poseLandmarks) {
            setPoseLandmarks(results.poseLandmarks); // Always update raw landmarks for drawing on canvas
            
            if (results.poseLandmarks[0] && loadedRobotInstanceRef.current) {
                const headYaw = mapRange(results.poseLandmarks[0].x, 0, 1, Math.PI, -Math.PI);
                const headPitch = mapRange(results.poseLandmarks[0].y, 0, 1, Math.PI, -Math.PI);
                newJointStates = { ...newJointStates, 'HEAD_JOINT0': -headYaw, 'HEAD_JOINT1': -headPitch };
            }
        } else {
            setPoseLandmarks(null);
        }

        if (results.leftHandLandmarks) {
            setLeftHandLandmarks(results.leftHandLandmarks);
            if (loadedRobotInstanceRef.current) {
                const wrist = results.leftHandLandmarks[0];
                const elbow = results.poseLandmarks?.[13]; // Left elbow landmark
                const shoulder = results.poseLandmarks?.[11]; // Left shoulder landmark
                if (wrist && elbow && shoulder) {
                    const shoulderPitch = mapRange(wrist.y, 0, 0.75, Math.PI, -Math.PI/6);
                    const shoulderRoll = mapRange(wrist.x, 0, 1, Math.PI/4, -Math.PI/4);
                    const leftElbowAngleRad = calculateAngle(shoulder, elbow, wrist);
                    const humanElbowMinAngle = 0.1;
                    const humanElbowMaxAngle = Math.PI - 0.1;
                    const robotElbowStraightAngle = 0;
                    const robotElbowBentAngle = Math.PI / 2;
                    const elbowJointAngle = mapRange(leftElbowAngleRad, humanElbowMinAngle, humanElbowMaxAngle, robotElbowBentAngle, robotElbowStraightAngle);
                    newJointStates = { ...newJointStates, 'LARM_JOINT0': -shoulderRoll, 'LARM_JOINT1': -shoulderPitch, 'LARM_JOINT4': -elbowJointAngle };
                }
            }
        } else {
            setLeftHandLandmarks(null);
        }

        if (results.rightHandLandmarks) {
            setRightHandLandmarks(results.rightHandLandmarks);
            if (loadedRobotInstanceRef.current) {
                const wrist = results.rightHandLandmarks[0];
                const elbow = results.poseLandmarks?.[14]; // Right elbow landmark
                const shoulder = results.poseLandmarks?.[12]; // Right shoulder landmark
                if (wrist && elbow && shoulder) {
                    const shoulderPitch = mapRange(wrist.y, 0, 0.75, Math.PI, -Math.PI/6);
                    const shoulderRoll = mapRange(wrist.x, 0, 1, Math.PI/4, -Math.PI/4);
                    const rightElbowAngleRad = calculateAngle(shoulder, elbow, wrist);
                    const humanElbowMinAngle = 0.1;
                    const humanElbowMaxAngle = Math.PI - 0.1;
                    const robotElbowStraightAngle = 0;
                    const robotElbowBentAngle = Math.PI / 2;
                    const elbowJointAngle = mapRange(rightElbowAngleRad, humanElbowMinAngle, humanElbowMaxAngle, robotElbowBentAngle, robotElbowStraightAngle);
                    newJointStates = { ...newJointStates, 'RARM_JOINT0': -shoulderRoll, 'RARM_JOINT1': -shoulderPitch, 'RARM_JOINT4': -elbowJointAngle };
                }
            }
        } else {
            setRightHandLandmarks(null);
        }

        // Apply updated joint states and record if active
        // Only update robotJointStates if not playing recorded data
        if (Object.keys(newJointStates).length > 0) {
            const currentSmoothedStates = {};
            const previousStates = prevJointStatesRef.current;
            for (const jointName in newJointStates) {
                if (typeof newJointStates[jointName] === 'number') {
                    const currentVal = previousStates[jointName] !== undefined ? previousStates[jointName] : newJointStates[jointName];
                    currentSmoothedStates[jointName] = currentVal + (newJointStates[jointName] - currentVal) * smoothingFactor;
                }
            }
            setRobotJointStates({ ...currentSmoothedStates }); // Update live robot
            prevJointStatesRef.current = { ...currentSmoothedStates }; // Store for live smoothing

            if (isCurrentlyRecording) { // Use ref value here
                currentJointStatesBufferRef.current.push({ ...newJointStates }); 
                // console.log("Joint states added to buffer. Current buffer size:", currentJointStatesBufferRef.current.length); 
            }
        } else {
            if (!results.poseLandmarks && !results.leftHandLandmarks && !results.rightHandLandmarks) {
                setPoseLandmarks(null); 
            }
            if (isCurrentlyRecording && Object.keys(prevJointStatesRef.current).length > 0) { 
                 currentJointStatesBufferRef.current.push({ ...prevJointStatesRef.current }); 
            }
        }
    }, [isPlayingRecordedData, mapRange, calculateAngle, smoothingFactor]); 

    // MediaPipe initialization and cleanup 
    useEffect(() => {
        const initializeMediaPipe = async () => {
            try {
                console.log("[UrdfUploader] Initializing MediaPipe Holistic.");
                
                holistic.current = new Holistic({
                    locateFile: (file) => {
                        return `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`; 
                    }
                });

                holistic.current.setOptions({
                    modelComplexity: 0, 
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

                    console.log("[UrdfUploader] Starting camera.");
                    cameraInstance.current.start();
                }
            } catch (error) {
                console.error("[UrdfUploader] Error initializing MediaPipe:", error);
                setStatus("Error initializing body tracking. Please check your camera permissions.");
            }
        };

        initializeMediaPipe();

        return () => {
            console.log("[UrdfUploader] Cleaning up MediaPipe resources.");
            if (cameraInstance.current) {
                cameraInstance.current.stop();
            }
            if (holistic.current) {
                holistic.current.close();
            }
        };
    }, [onResults]);

    // Effect for drawing MediaPipe landmarks on the visible canvas 
    useEffect(() => {
        const video = videoRef.current;
        const drawingCanvas = drawingCanvasRef.current;
        
        if (!video || !drawingCanvas) return;

        const ctx = drawingCanvas.getContext('2d');

        const drawLandmarks = (landmarks, color) => {
            if (!landmarks) return;
            
            ctx.fillStyle = color;
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            
            for (const landmark of landmarks) {
                const x = landmark.x * drawingCanvas.width;
                const y = landmark.y * drawingCanvas.height;
                
                ctx.beginPath();
                ctx.arc(x, y, 5, 0, 2 * Math.PI, true);
                ctx.fill();
            }
        };

        let animationFrameId;

        const drawLoop = () => {
            if (video.videoWidth > 0 && video.videoHeight > 0) {
                if (drawingCanvas.width !== video.videoWidth || drawingCanvas.height !== video.videoHeight) {
                    drawingCanvas.width = video.videoWidth;
                    drawingCanvas.height = video.videoHeight;
                }
            } else if (drawingCanvas.width === 0 || drawingCanvas.height === 0) {
                drawingCanvas.width = 640;
                drawingCanvas.height = 480;
            }

            ctx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
            ctx.drawImage(video, 0, 0, drawingCanvas.width, drawingCanvas.height);
            
            if (!isPlayingRecordedData) { // Only draw landmarks on live feed
                if (poseLandmarks) drawLandmarks(poseLandmarks, '#4285F4');
                if (leftHandLandmarks) drawLandmarks(leftHandLandmarks, '#EA4335');
                if (rightHandLandmarks) drawLandmarks(rightHandLandmarks, '#34A853');
            }
            
            animationFrameId = requestAnimationFrame(drawLoop);
        };
        
        const handleVideoMetadataLoaded = () => {
            console.log("[UrdfUploader] Video metadata loaded. Starting landmark drawing loop.");
            if (!animationFrameId) {
                drawLoop();
            }
        };

        video.addEventListener('loadedmetadata', handleVideoMetadataLoaded);
        if (video.readyState >= 2) {
            handleVideoMetadataLoaded();
        }
        
        return () => {
            video.removeEventListener('loadedmetadata', handleVideoMetadataLoaded);
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
        };
    }, [poseLandmarks, leftHandLandmarks, rightHandLandmarks, isPlayingRecordedData]);

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
        
        setStatus("Processing mesh files.");
        
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
        setStatus("Loading robot model.");
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
        setRecordedVideoBlob(null);
        setIsPlayingRecordedVideo(false);
        setRecordedJointStatesSequence([]);
        setIsPlayingRecordedData(false);
        currentJointStatesBufferRef.current = [];
        setStatus("Files cleared. Upload new URDF and mesh files.");
        
        if (urdfInputRef.current) urdfInputRef.current.value = '';
        if (meshesInputRef.current) meshesInputRef.current.value = '';
        
        if (recordedVideoPlayerRef.current) {
            recordedVideoPlayerRef.current.src = '';
            recordedVideoPlayerRef.current.load();
        }

        console.log("[UrdfUploader] All files and states cleared.");
    }, []);

    const currentRobotJointStates = robotJointStates;

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

                        {/* VideoRecorder Component */}
                        <VideoRecorder
                            recordingSourceRef={drawingCanvasRef} 
                            onRecordingStatusChange={handleRecordingStatusChange}
                            onVideoAvailable={handleVideoAvailable}
                            isRobotLoaded={!!loadedRobotInstanceRef.current} 
                            recordedVideoBlob={recordedVideoBlob} 
                            isPlayingRecordedVideo={isPlayingRecordedVideo} 
                            setIsPlayingRecordedVideo={setIsPlayingRecordedVideo} 
                            recordedJointStatesData={recordedJointStatesSequence}
                            onPlayRecordedData={handlePlayRecordedData}
                            recordedVideoPlayerRef={recordedVideoPlayerRef}
                        />

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
                            <div className="w-full h-full bg-white">
                                <Canvas
                                    camera={{ position: [2, 2, 2], fov: 50 }}
                                    style={{ width: '100%', height: '100%' }}
                                    ref={canvasRef}
                                >
                                    <ambientLight intensity={0.8} />
                                    <directionalLight position={[5, 5, 5]} intensity={1} />
                                    <pointLight position={[-5, 5, 5]} intensity={0.3} />
                                    
                                    <Suspense fallback={
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
                                            jointStates={currentRobotJointStates}
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
                                        <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-2xl font-semibold text-gray-800 mb-2">Upload Robot Files</h3>
                                    <p className="text-gray-500">Select URDF and mesh files to load your robot</p>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    {/* MediaPipe Camera Feed (hidden input) */}
                    <video
                        ref={videoRef}
                        style={{ display: 'none' }} // This video is hidden, used only as source for MediaPipe
                        autoPlay
                        muted
                        playsInline
                    />

                    {/* Display Area for Camera Feeds - side by side */}
                    <div className="absolute top-3 right-3 m-2 z-10 flex flex-row space-x-2">
                        {/* Live Camera Feed (MediaPipe processed output) */}
                        <div className="w-48 h-48 relative bg-black rounded-lg border-2 border-purple-500/50 shadow-lg">
                            <canvas
                                ref={drawingCanvasRef}
                                className="w-full h-full rounded-lg"
                                // Always show live feed unless recorded video is explicitly playing AND available
                                style={{ display: (isPlayingRecordedVideo && recordedVideoBlob) ? 'none' : 'block' }} 
                            />
                            {/* Only show live tracking status if live feed is displayed */}
                            {(!isPlayingRecordedVideo || !recordedVideoBlob) && (
                                <>
                                    {poseLandmarks && (
                                        <div className="absolute top-1 left-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-2 py-0.5 rounded-full text-xs font-semibold shadow-lg">
                                            👤 Tracking
                                        </div>
                                    )}
                                    {!poseLandmarks && (
                                        <div className="absolute top-1 left-1 bg-gradient-to-r from-slate-600 to-slate-700 text-white px-2 py-0.5 rounded-full text-xs font-semibold">
                                            ❌ No Tracking
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Recorded Video Playback */}
                        <div className="w-48 h-48 relative bg-black rounded-lg border-2 border-purple-500/50 shadow-lg">
                            <video
                                ref={recordedVideoPlayerRef} // Use the ref declared at the top
                                className="w-full h-full rounded-lg"
                                autoPlay={false} // Controlled by VideoRecorder
                                muted // Often good for initial playback to avoid unexpected sound
                                playsInline
                                // Show this video only if there's a blob and playback is active
                                style={{ display: (isPlayingRecordedVideo && recordedVideoBlob) ? 'block' : 'none' }}
                            />
                            {(isPlayingRecordedVideo && recordedVideoBlob) && (
                                <div className="absolute top-1 left-1 bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-2 py-0.5 rounded-full text-xs font-semibold shadow-lg">
                                    ▶️ Playback
                                </div>
                            )}
                            {/* Display a placeholder if no recorded video available, and not playing live */}
                            {!recordedVideoBlob && (
                                <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-xs text-center p-2">
                                    Recorded video will appear here.
                                </div>
                            )}
                        </div>
                    </div> {/* End of camera feeds display area */}
                </div>
            </div>
        </div>
    );
};

export default UrdfUploader;