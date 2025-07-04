// src/pages/UrdfUploader.jsx
import React, { useRef, useState, Suspense, useEffect, useCallback, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import { Text } from '@react-three/drei';
import { Holistic } from '@mediapipe/holistic';
import { Camera } from '@mediapipe/camera_utils';
import { UrdfRobotModel, CameraUpdater } from '../components/UrdfRobotModel';
import VideoRecorder from '../components/VideoRecorder'; // Keep VideoRecorder

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
    const [isPlayingRecordedVideo, setIsPlayingRecordedVideo] = useState(false); // Controls playback video element visibility
    const [recordedJointStatesSequence, setRecordedJointStatesSequence] = useState([]); 
    const [isRecording, setIsRecording] = useState(false); // State for recording status (from VideoRecorder)

    // MediaPipe and Robot control states
    const [poseLandmarks, setPoseLandmarks] = useState(null); // MediaPipe landmarks
    const [leftHandLandmarks, setLeftHandLandmarks] = useState(null); // MediaPipe landmarks
    const [rightHandLandmarks, setRightHandLandmarks] = useState(null); // MediaPipe landmarks
    const [robotJointStates, setRobotJointStates] = useState({}); // Current joint states for the robot

    // Refs for DOM elements and MediaPipe instances
    const urdfInputRef = useRef(null);
    const meshesInputRef = useRef(null);
    const videoRef = useRef(null); // Hidden video for LIVE MediaPipe camera feed input
    const holistic = useRef(null);
    const cameraInstance = useRef(null); // Controls LIVE camera feed for Mediapipe
    const canvasRef = useRef(null); // React-Three-Fiber Canvas ref
    const drawingCanvasRef = useRef(null); // HTML Canvas for MediaPipe landmark drawing (visible)
    const recordedVideoPlayerRef = useRef(null); // Ref for the playback video element in UrdfUploader
    const hiddenMediapipeInputCanvasRef = useRef(null);
    const [useSmoothing, setUseSmoothing] = useState(true); // NEW: Hidden canvas to feed recorded video frames to MediaPipe
    
    const loadedRobotInstanceRef = useRef(null); // Ref to hold the loaded Three.js robot object
    const [cameraUpdateTrigger, setCameraUpdateTrigger] = useState(0); // Trigger for CameraUpdater

    const currentJointStatesBufferRef = useRef([]); // Buffer to accumulate joint states during recording
    const isRecordingActiveRef = useRef(false); // Ref for recording active status 

    // For joint state smoothing
    // const [useSmoothing, setUseSmoothing] = useState(true); // Smoothing enabled by default
    const smoothingFactor = 0.2
    const prevJointStatesRef = useRef({}); // Store previous joint states for interpolation
     // Adjust this value (0.1 to 0.9) for more/less smoothing

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
    // const mapRange = useCallback((value, inMin, inMax, outMin, outMax) => {
    //     const clampedValue = Math.max(inMin, Math.min(value, inMax));
    //     return (clampedValue - inMin) * (outMax - outMin) / (inMax - inMin) + outMax; // Corrected mapping direction
    // }, []);

    // const calculateAngle = useCallback((a, b, c) => {
    //     if (!a || !b || !c) return 0;
    //     const rad = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    //     let angle = Math.abs(rad);
    //     if (angle > Math.PI) {
    //         angle = 2 * Math.PI - angle;
    //     }
    //     return angle;
    // }, []);

    // Callback from VideoRecorder to update recording status and collect data
    const handleRecordingStatusChange = useCallback((message, isRecordingNow) => {
        setStatus(message);
        isRecordingActiveRef.current = isRecordingNow; // Update the ref directly 
        setIsRecording(isRecordingNow); // Update state for button disable logic
        console.log("[UrdfUploader] isRecordingActiveRef updated to:", isRecordingNow); 

        if (!isRecordingNow) { // Recording stopped
            console.log("[UrdfUploader] Joint states buffer length on recording stop:", currentJointStatesBufferRef.current.length); 
            setRecordedJointStatesSequence([...currentJointStatesBufferRef.current]); // Store recorded sequence
            currentJointStatesBufferRef.current = []; // Clear buffer
            console.log("[UrdfUploader] Final recorded joint states sequence length:", recordedJointStatesSequence.length);
        } else { // Recording started
            currentJointStatesBufferRef.current = []; // Ensure buffer is clear at start
            setRecordedJointStatesSequence([]); // Clear any previous recorded sequence
            prevJointStatesRef.current = {}; // Reset smoothing on new recording
            console.log("[UrdfUploader] Recording started. Joint states buffer cleared.");
        }
    }, [recordedJointStatesSequence.length]); // Added dependency to allow state update

    // Callback from VideoRecorder when video blob is available
    const handleVideoAvailable = useCallback((blob) => {
        setRecordedVideoBlob(blob);
    }, []);

    // Playback Logic - Drive MediaPipe from recorded video frames
    const handlePlayRecordedData = useCallback(async () => { 
        if (!recordedVideoBlob || !recordedVideoPlayerRef.current || !hiddenMediapipeInputCanvasRef.current || !holistic.current) {
            alert("⚠️ No recorded video or essential elements for playback.");
            return;
        }

        // Stop live MediaPipe processing (Camera instance)
        if (cameraInstance.current) {
            cameraInstance.current.stop();
            console.log("[UrdfUploader] Live MediaPipe processing stopped for playback.");
        }
        
        setIsPlayingRecordedVideo(true); // Signal that playback is active

        const video = recordedVideoPlayerRef.current;
        const canvas = hiddenMediapipeInputCanvasRef.current;
        const ctx = canvas.getContext("2d");

        // Clear previous source and load new blob
        video.src = URL.createObjectURL(recordedVideoBlob);
        video.controls = true; // Show playback controls
        video.loop = false;

        // Set canvas dimensions to match video
        video.onloadedmetadata = () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            video.play().catch(e => console.error("Error playing recorded video:", e));
        };

        let animationFrameId;

        const processRecordedFrame = async () => {
            if (!video.paused && !video.ended) {
                // Draw video frame to hidden canvas
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                try {
                    // Send hidden canvas image to Holistic for processing
                    await holistic.current.send({ image: canvas });
                } catch (e) {
                    console.error("🎥 Error sending recorded frame to Holistic:", e);
                }
                animationFrameId = requestAnimationFrame(processRecordedFrame);
            }
        };

        video.onplay = () => {
            console.log("▶️ Playing recorded video with pose tracking...");
            animationFrameId = requestAnimationFrame(processRecordedFrame);
        };

        video.onpause = () => {
            cancelAnimationFrame(animationFrameId);
            console.log("⏸️ Playback paused.");
        };

        video.onended = () => {
            cancelAnimationFrame(animationFrameId);
            setIsPlayingRecordedVideo(false); // Playback finished
            console.log("✅ Playback finished. Re-enabling live camera.");

            // Revoke blob URL to free memory
            if (video.src) URL.revokeObjectURL(video.src);
            video.src = '';
            video.controls = false;

            // Restart live MediaPipe processing
            if (cameraInstance.current) {
                try {
                    cameraInstance.current.start();
                } catch (e) {
                    console.error("Error restarting camera after playback:", e);
                }
            }
        };

        console.log("🎬 Playback initiated for recorded video.");

        return () => { // Cleanup function for when component unmounts or playback is interrupted
            cancelAnimationFrame(animationFrameId);
            if (video) {
                video.onplay = null;
                video.onpause = null;
                video.onended = null;
                video.pause(); // Ensure video stops
                if (video.src) URL.revokeObjectURL(video.src); // Clean up blob URL
                video.src = '';
                video.controls = false;
            }
            if (cameraInstance.current) { // Ensure live camera restarts if playback was ongoing
                try {
                    cameraInstance.current.start();
                } catch (e) {
                    console.error("Error restarting camera on cleanup:", e);
                }
            }
        };

    }, [recordedVideoBlob]); // Dependency array for handlePlayRecordedData

    // MediaPipe results processing (receives results from whichever source Holistic is processing)
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

// In the onResults callback:
const onResults = useCallback((results) => {
    setPoseLandmarks(results.poseLandmarks || null);
    setLeftHandLandmarks(results.leftHandLandmarks || null);
    setRightHandLandmarks(results.rightHandLandmarks || null);

    let newJointStates = {};

    // Head control
    if (results.poseLandmarks?.[0] && loadedRobotInstanceRef.current) {
        const headYaw = mapRange(results.poseLandmarks[0].x, 0, 1, Math.PI, -Math.PI);
        const headPitch = mapRange(results.poseLandmarks[0].y, 0, 1, Math.PI, -Math.PI);
        newJointStates = { 
            ...newJointStates, 
            'HEAD_JOINT0': -headYaw,
            'HEAD_JOINT1': -headPitch 
        };
    }

    // Left arm control
    if (results.leftHandLandmarks && results.poseLandmarks?.[11] && results.poseLandmarks?.[13]) {
        const wrist = results.leftHandLandmarks[0];
        const elbow = results.poseLandmarks[13];
        const shoulder = results.poseLandmarks[11];

        const shoulderPitch = mapRange(wrist.y, 0, 0.75, Math.PI, -Math.PI/6);
        const shoulderRoll = mapRange(wrist.x, 0, 1, Math.PI/4, -Math.PI/4);
        const leftElbowAngleRad = calculateAngle(shoulder, elbow, wrist);
        const elbowJointAngle = mapRange(leftElbowAngleRad, 0.1, Math.PI - 0.1, Math.PI/2, 0);

        newJointStates = { 
            ...newJointStates, 
            'LARM_JOINT0': -shoulderRoll,
            'LARM_JOINT1': -shoulderPitch,
            'LARM_JOINT4': -elbowJointAngle
        };
    }

    // Right arm control
    if (results.rightHandLandmarks && results.poseLandmarks?.[12] && results.poseLandmarks?.[14]) {
        const wrist = results.rightHandLandmarks[0];
        const elbow = results.poseLandmarks[14];
        const shoulder = results.poseLandmarks[12];

        const shoulderPitch = mapRange(wrist.y, 0, 0.75, Math.PI, -Math.PI/6);
        const shoulderRoll = mapRange(wrist.x, 0, 1, Math.PI/4, -Math.PI/4);
        const rightElbowAngleRad = calculateAngle(shoulder, elbow, wrist);
        const elbowJointAngle = mapRange(rightElbowAngleRad, 0.1, Math.PI - 0.1, Math.PI/2, 0);

        newJointStates = { 
            ...newJointStates, 
            'RARM_JOINT0': -shoulderRoll,
            'RARM_JOINT1': -shoulderPitch,
            'RARM_JOINT4': -elbowJointAngle
        };
    }

    // Apply smoothing if enabled
    if (Object.keys(newJointStates).length > 0) {
        let finalJointStates = newJointStates;
        
        if (useSmoothing) {
            const currentSmoothedStates = {};
            const previousStates = prevJointStatesRef.current;
            
            for (const jointName in newJointStates) {
                if (typeof newJointStates[jointName] === 'number') {
                    const currentVal = previousStates[jointName] !== undefined ? 
                        previousStates[jointName] : newJointStates[jointName];
                    currentSmoothedStates[jointName] = 
                        currentVal + (newJointStates[jointName] - currentVal) * smoothingFactor;
                }
            }
            finalJointStates = currentSmoothedStates;
            prevJointStatesRef.current = currentSmoothedStates;
        } else {
            prevJointStatesRef.current = newJointStates;
        }
        
        setRobotJointStates(finalJointStates);
        
        if (isRecordingActiveRef.current) {
            currentJointStatesBufferRef.current.push({ ...finalJointStates });
        }
    } else if (isRecordingActiveRef.current && Object.keys(prevJointStatesRef.current).length > 0) {
        currentJointStatesBufferRef.current.push({ ...prevJointStatesRef.current });
    }
}, [mapRange, calculateAngle, useSmoothing, smoothingFactor]);

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
                            if (holistic.current && videoRef.current && !isPlayingRecordedVideo) {
                                // Only send live video frames to MediaPipe if not playing recorded video
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
                cameraInstance.current = null; // Clear ref on cleanup
            }
            if (holistic.current) {
                holistic.current.close();
                holistic.current = null; // Clear ref on cleanup
            }
        };
    }, [onResults, isPlayingRecordedVideo]); // Added isPlayingRecordedVideo as dependency

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
            // Determine the source video element for drawing
            const sourceVideo = isPlayingRecordedVideo ? recordedVideoPlayerRef.current : videoRef.current;
            
            if (!sourceVideo || sourceVideo.readyState < 2) { // Ensure source video is ready
                animationFrameId = requestAnimationFrame(drawLoop);
                return;
            }

            if (sourceVideo.videoWidth > 0 && sourceVideo.videoHeight > 0) {
                if (drawingCanvas.width !== sourceVideo.videoWidth || drawingCanvas.height !== sourceVideo.videoHeight) {
                    drawingCanvas.width = sourceVideo.videoWidth;
                    drawingCanvas.height = sourceVideo.videoHeight;
                }
            } else if (drawingCanvas.width === 0 || drawingCanvas.height === 0) {
                drawingCanvas.width = 640;
                drawingCanvas.height = 480;
            }

            ctx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
            
            // Draw the current video frame
            ctx.drawImage(sourceVideo, 0, 0, drawingCanvas.width, drawingCanvas.height);

            // Draw landmarks on top
            if (poseLandmarks) drawLandmarks(poseLandmarks, '#4285F4');
            if (leftHandLandmarks) drawLandmarks(leftHandLandmarks, '#EA4335');
            if (rightHandLandmarks) drawLandmarks(rightHandLandmarks, '#34A853');
            
            animationFrameId = requestAnimationFrame(drawLoop);
        };
        
        const handleVideoMetadataLoaded = () => {
            console.log("[UrdfUploader] Video metadata loaded. Starting landmark drawing loop.");
            if (!animationFrameId) {
                drawLoop();
            }
        };

        // Attach listener to both potential video sources for metadata loaded
        if (videoRef.current) {
            videoRef.current.addEventListener('loadedmetadata', handleVideoMetadataLoaded);
            if (videoRef.current.readyState >= 2) handleVideoMetadataLoaded();
        }
        if (recordedVideoPlayerRef.current) {
            recordedVideoPlayerRef.current.addEventListener('loadedmetadata', handleVideoMetadataLoaded);
            if (recordedVideoPlayerRef.current.readyState >= 2) handleVideoMetadataLoaded();
        }
        
        return () => {
            // Clean up listeners for both potential video sources
            if (videoRef.current) videoRef.current.removeEventListener('loadedmetadata', handleVideoMetadataLoaded);
            if (recordedVideoPlayerRef.current) recordedVideoPlayerRef.current.removeEventListener('loadedmetadata', handleVideoMetadataLoaded);
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
        };
    }, [poseLandmarks, leftHandLandmarks, rightHandLandmarks, isPlayingRecordedVideo]); // Only isPlayingRecordedVideo determines the source for drawing

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
        // setIsPlayingRecordedData(false); // This is managed by handlePlayRecordedData cleanup
        currentJointStatesBufferRef.current = [];
        setStatus("Files cleared. Upload new URDF and mesh files.");
        
        if (urdfInputRef.current) urdfInputRef.current.value = '';
        if (meshesInputRef.current) meshesInputRef.current.value = '';
        
        if (recordedVideoPlayerRef.current) {
            recordedVideoPlayerRef.current.src = '';
            recordedVideoPlayerRef.current.load();
            recordedVideoPlayerRef.current.controls = false;
        }
        // Ensure camera is active after clearing
        if (cameraInstance.current) {
            try {
                cameraInstance.current.start();
            } catch (e) {
                console.error("Error restarting camera on clear files:", e);
            }
        }
        console.log("[UrdfUploader] All files and states cleared.");
    }, []);

    const currentRobotJointStates = robotJointStates;

