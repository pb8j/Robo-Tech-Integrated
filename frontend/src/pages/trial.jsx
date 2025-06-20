import React, { useEffect, useRef, useState, Suspense, useCallback,useMemo  } from "react";
import { io } from "socket.io-client";
import { Canvas, useLoader, useThree } from "@react-three/fiber";
import URDFLoader from 'urdf-loader';
import { OrbitControls, Environment } from "@react-three/drei";
import * as THREE from 'three';
import { Text } from '@react-three/drei';
import { LoadingManager, FileLoader } from 'three';
// REMOVE THIS LINE: import * as Zlib from 'browser-zlib';
import JSZip from 'jszip'; 

// Configuration Constant
const NODE_SERVER_URL = "https://backend-746d.onrender.com";
const PHONE_DEVICE_ID = `phone-${Math.random().toString(36).substring(7)}`;

// const URDF_CONTENT_KEY = '___URDF_CONTENT___';

const UrdfRobotModel = ({ jointStates, controlMode, onRobotLoaded, urdfContent, fileMap, initialPosition = [0, 0, 0], scale = 1.0 }) => {
    const robotRef = useRef(null);

    const robotLoadedInstance = useLoader(URDFLoader, urdfContent, (loader) => {
        const customLoadingManager = new LoadingManager();
        const customFileLoader = new FileLoader(customLoadingManager);
        customFileLoader.setResponseType('arraybuffer');
        customLoadingManager.addHandler('file', customFileLoader);
        loader.manager = customLoadingManager;

        // --- SIMPLIFIED AND CORRECTED setURLModifier for relative paths ---
       // ... inside UrdfRobotModel.jsx, within useLoader ...

// UrdfRobotModel.jsx - inside the useLoader hook, within loader.manager.setURLModifier((url) => { ... })

// UrdfRobotModel.jsx - inside the useLoader hook, within loader.manager.setURLModifier((url) => { ... })

loader.manager.setURLModifier((url) => {
    console.log(`[UrdfRobotModel][URLModifier Debug] INCOMING URL from URDFLoader: '${url}'`);

    let lookupKeyCandidate = url; // Start with the full URL

    // Step 1: Check if it's already a 'blob:' URL that contains a path
    if (url.startsWith('blob:http://localhost:5173/')) {
        // Extract the path part, assuming a structure like 'blob:http://localhost:5173/meshes/thorax.STL'
        // We need to get 'meshes/thorax.STL' from this.
        const pathAfterDomain = url.substring('blob:http://localhost:5173/'.length);
        lookupKeyCandidate = pathAfterDomain;
        console.log(`[UrdfRobotModel][URLModifier Debug] Extracted path from blob URL: '${lookupKeyCandidate}'`);
    }

    // Step 2: Handle common URDF prefixes if they are still present after blob extraction
    // (This might be redundant if the blob URL extraction already handled it, but safe to keep for robustness)
    if (lookupKeyCandidate.startsWith('package://')) {
        lookupKeyCandidate = lookupKeyCandidate.substring('package://'.length);
        console.log(`[UrdfRobotModel][URLModifier Debug] After package:// removal: '${lookupKeyCandidate}'`);
    } else if (lookupKeyCandidate.startsWith('model://')) {
        lookupKeyCandidate = lookupKeyCandidate.substring('model://'.length);
        console.log(`[UrdfRobotModel][URLModifier Debug] After model:// removal: '${lookupKeyCandidate}'`);
    }
    if (lookupKeyCandidate.startsWith('./')) {
        lookupKeyCandidate = lookupKeyCandidate.substring('./'.length);
        console.log(`[UrdfRobotModel][URLModifier Debug] After ./ removal: '${lookupKeyCandidate}'`);
    }

    // Step 3: Normalize path separators (Windows to Unix)
    lookupKeyCandidate = lookupKeyCandidate.replace(/\\/g, '/');
    console.log(`[UrdfRobotModel][URLModifier Debug] After path normalization: '${lookupKeyCandidate}'`);

    // Step 4: Remove leading slash if present
    if (lookupKeyCandidate.startsWith('/')) {
        lookupKeyCandidate = lookupKeyCandidate.substring(1);
        console.log(`[UrdfRobotModel][URLModifier Debug] After leading slash removal: '${lookupKeyCandidate}'`);
    }

    // Step 5: Convert to lowercase to match your fileMap keys
    const lookupKey = lookupKeyCandidate.toLowerCase(); // <-- THIS MUST BE TO LOWERCASE
    console.log(`[UrdfRobotModel][URLModifier Debug] COMPUTED LOOKUP KEY for fileMap: '${lookupKey}'`);

    if (fileMap && fileMap[lookupKey]) {
        const blobUrl = fileMap[lookupKey];
        console.log(`[UrdfRobotModel][URLModifier Debug] ✅ FOUND IN FILEMAP! Returning blob URL: '${blobUrl}' for key: '${lookupKey}'`);
        return blobUrl;
    }

    // If we reach here, it means we couldn't find the asset in our fileMap.
    // If the original URL was already a blob URL (that we couldn't resolve),
    // we should return it anyway to let the browser try. This might be
    // a valid blob URL for something not in our zip (e.g., textures loaded directly from web).
    if (url.startsWith('blob:')) {
        console.warn(`[UrdfRobotModel][URLModifier] ⚠️ Blob URL already provided but not in our fileMap. Returning original blob URL: '${url}'`);
        return url;
    } else {
        console.warn(`[UrdfRobotModel][URLModifier] ❌ ASSET NOT FOUND in fileMap for key: '${lookupKey}' (original URL: '${url}'). Returning ORIGINAL URL.`);
        return url; // This is the case for non-blob URLs that were not found.
    }
});

        loader.parseVisual = true;
        loader.parseCollision = false;
    });

    // --- The rest of your UrdfRobotModel.jsx code remains exactly the same ---
    useEffect(() => {
        if (robotLoadedInstance) {
            console.log(`[UrdfRobotModel] URDF Robot Loaded:`, robotLoadedInstance);
            console.log(`[UrdfRobotModel] Available Joints:`, Object.keys(robotLoadedInstance.joints));

            robotRef.current = robotLoadedInstance;
            robotLoadedInstance.scale.set(scale, scale, scale);
            robotLoadedInstance.position.set(...initialPosition);

            if (onRobotLoaded) {
                onRobotLoaded(robotLoadedInstance);
            }
        }
    }, [robotLoadedInstance, onRobotLoaded, scale, initialPosition]);

    useEffect(() => {
        const robot = robotRef.current;
        if (!robot || controlMode !== 'urdf' || !jointStates || (!jointStates.cmd && Object.keys(jointStates).length === 0)) {
            return;
        }

        const rotationAmount = 0.1;
        const liftAmount = 0.1;
        const moveAmount = 0.05;

        const getJointValue = (jointName) => {
            const joint = robot.joints[jointName];
            return joint ? (joint.angle || 0) : 0;
        };

        let commandHandled = false;
        let robotType = 'unknown';

        if (robot.joints['coxa_joint_r1'] || robot.joints['femur_joint_r1']) {
            robotType = 'hexapod';
        } else if (robot.joints['LLEG_JOINT0'] || robot.joints['RLEG_JOINT0']) {
            robotType = 'humanoid';
        }

        if (jointStates.cmd) {
            if (robotType === 'hexapod') {
                switch (jointStates.cmd) {
                    case 'left':
                        ['coxa_joint_r1', 'coxa_joint_r2', 'coxa_joint_r3'].forEach(jointName => {
                            if (robot.joints[jointName]) robot.setJointValue(jointName, getJointValue(jointName) + rotationAmount);
                        });
                        commandHandled = true;
                        break;
                    case 'right':
                        ['coxa_joint_r1', 'coxa_joint_r2', 'coxa_joint_r3'].forEach(jointName => {
                            if (robot.joints[jointName]) robot.setJointValue(jointName, getJointValue(jointName) - rotationAmount);
                        });
                        commandHandled = true;
                        break;
                    case 'jump':
                        const hexapodFemurJoints = [
                            'femur_joint_r1', 'femur_joint_r2', 'femur_joint_r3',
                            'femur_joint_r4', 'femur_joint_r5', 'femur_joint_r6',
                            'femur_joint_l1', 'femur_joint_l2', 'femur_joint_l3',
                            'femur_joint_l4', 'femur_joint_l5', 'femur_joint_l6'
                        ];
                        hexapodFemurJoints.forEach(jointName => {
                            if (robot.joints[jointName]) robot.setJointValue(jointName, getJointValue(jointName) - liftAmount);
                        });
                        setTimeout(() => {
                            hexapodFemurJoints.forEach(jointName => {
                                if (robot.joints[jointName]) robot.setJointValue(jointName, getJointValue(jointName) + liftAmount);
                            });
                        }, 300);
                        commandHandled = true;
                        break;
                    default:
                        break;
                }
            } else if (robotType === 'humanoid') {
                // ... (your existing humanoid logic)
            }
        }

        if (!commandHandled && jointStates.cmd) {
            switch (jointStates.cmd) {
                case 'forward':
                    robot.position.z -= moveAmount;
                    break;
                case 'backward':
                    robot.position.z += moveAmount;
                    break;
                case 'up':
                    robot.position.y += moveAmount;
                    break;
                case 'down':
                    robot.position.y -= moveAmount;
                    break;
                default:
                    break;
            }
            commandHandled = true;
        }

        for (const jointName in jointStates) {
            if (jointName !== 'cmd' && jointName !== 'timestamp') {
                const targetAngle = jointStates[jointName];
                const urdfJoint = robot.joints[jointName];
                if (urdfJoint) {
                    if (typeof targetAngle === 'number' && !isNaN(targetAngle)) {
                        if (urdfJoint.angle !== targetAngle) {
                            robot.setJointValue(jointName, targetAngle);
                        }
                    } else {
                        console.warn(`[UrdfRobotModel][Direct] Invalid angle for ${jointName}:`, targetAngle);
                    }
                }
            }
        }
    }, [jointStates, controlMode, robotRef]);

    if (!robotLoadedInstance) {
        return null;
    }

    return <primitive object={robotLoadedInstance} />;
};


const PhoneCam = () => {
    const localVideoRef = useRef(null);
    const peerConnection = useRef(null);
    const socket = useRef(null);
    const orbitControlsRef = useRef();
    const cameraRef = useRef();

    const [status, setStatus] = useState("Connecting to server...");
    const [jointStates, setJointStates] = useState({});
    const [displayMode, setDisplayMode] = useState('video');
    const [callActive, setCallActive] = useState(false);
    const loadedRobotInstanceRef = useRef(null);
     const [urdfLoading, setUrdfLoading] = useState(false);
    // New state for uploaded URDF
    const [uploadedUrdfContent, setUploadedUrdfContent] = useState(null);
     const [robotLoaded, setRobotLoaded] = useState(false);
    const [uploadedFileMap, setUploadedFileMap] = useState(null);
    const [controlMode, setControlMode] = useState('urdf');
    const [fileMap, setFileMap] = useState(null);
    const [selectedRobotKey, setSelectedRobotKey] = useState(null);
    const urdfInputRef = useRef(null);
    const zipInputRef = useRef(null);

    // Callback to store the loaded robot instance from UrdfRobotModel
    const handleRobotLoaded = useCallback((robotObject) => {
        console.log("[PhoneCam] Robot instance received in handleRobotLoaded:", robotObject);
        loadedRobotInstanceRef.current = robotObject;
    }, []);

    // Function to get local media stream
    const getLocalStream = useCallback(async () => {
        try {
            console.log("[PhoneCam] Requesting local media stream...");
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }
            console.log("[PhoneCam] Local stream obtained.");
            return stream;
        } catch (err) {
            console.error("[PhoneCam] Camera error:", err);
            setStatus(`Camera access denied or unavailable: ${err.message}`);
            alert("Camera access denied or unavailable. Please allow camera permissions.");
            return null;
        }
    }, []);

    // Function to set up WebRTC peer connection
    const setupPeerConnection = useCallback(async (requestingLaptopSocketId) => {
        console.log("[PhoneCam] Setting up PeerConnection...");
        if (peerConnection.current) {
            console.log("[PhoneCam] Closing existing PeerConnection.");
            peerConnection.current.close();
            peerConnection.current = null;
        }

        const pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });
        peerConnection.current = pc;

        pc.oniceconnectionstatechange = () => {
            console.log('[PhoneCam] ICE connection state:', pc.iceConnectionState);
            setStatus(`ICE State: ${pc.iceConnectionState}`);
        };

        const stream = localVideoRef.current?.srcObject;
        if (stream) {
            stream.getTracks().forEach(track => {
                console.log(`[PhoneCam] Adding track: ${track.kind}`);
                pc.addTrack(track, stream);
            });
            console.log("[PhoneCam] Local stream tracks added to PeerConnection.");
        } else {
            console.error("[PhoneCam] No local stream found to add to PeerConnection.");
            setStatus("Error: No local stream to start WebRTC.");
            return;
        }

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                console.log("[PhoneCam] Sending ICE candidate to laptop.");
                socket.current.emit("ice_candidate_from_phone", {
                    candidate: event.candidate,
                    phoneDeviceId: PHONE_DEVICE_ID,
                    requestingLaptopSocketId: requestingLaptopSocketId
                });
            }
        };

        try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            console.log("[PhoneCam] Sending SDP Offer to laptop.");
            socket.current.emit("sdp_offer_from_phone", {
                sdpOffer: offer,
                phoneDeviceId: PHONE_DEVICE_ID,
                requestingLaptopSocketId: requestingLaptopSocketId
            });
            setStatus("Offer sent. Waiting for answer...");
        } catch (error) {
            console.error("[PhoneCam] Error creating or sending offer:", error);
            setStatus(`Error setting up WebRTC: ${error.message}`);
        }
    }, []);

    // Socket.IO and WebRTC signaling setup
    useEffect(() => {
        socket.current = io(NODE_SERVER_URL);
        console.log(`[PhoneCam] Initializing Socket.IO connection to ${NODE_SERVER_URL}`);

        socket.current.on("connect", () => {
            setStatus("Connected to server. Registering phone...");
            console.log(`[PhoneCam] Socket connected. Emitting 'register_phone' with ID: ${PHONE_DEVICE_ID}`);
            socket.current.emit("register_phone", PHONE_DEVICE_ID);
        });

        socket.current.on("connect_error", (err) => {
            console.error("[PhoneCam] Socket.IO Connect Error:", err);
            setStatus(`Connection Error: ${err.message}`);
        });

        socket.current.on("start_webrtc_offer", async ({ requestingLaptopSocketId }) => {
            console.log(`[PhoneCam] Laptop (Socket ID: ${requestingLaptopSocketId}) requested stream.`);
            setStatus("Laptop requested stream. Setting up WebRTC...");
            await setupPeerConnection(requestingLaptopSocketId);
            setCallActive(true);
        });

        socket.current.on("sdp_answer_from_laptop", async (sdpAnswer) => {
            console.log("[PhoneCam] Received SDP Answer.");
            setStatus("Received SDP Answer. Establishing connection...");
            if (peerConnection.current && peerConnection.current.remoteDescription === null) {
                try {
                    await peerConnection.current.setRemoteDescription(new RTCSessionDescription(sdpAnswer));
                    console.log("[PhoneCam] Remote description set (Answer).");
                } catch (error) {
                    console.error("[PhoneCam] Error setting remote description:", error);
                    setStatus(`Error setting remote description: ${error.message}`);
                }
            } else {
                console.warn("[PhoneCam] Peer connection not ready or remote description already set when answer received.");
            }
        });

        socket.current.on("ice_candidate_from_laptop", async (candidate) => {
            console.log("[PhoneCam] Received ICE candidate from laptop.");
            if (peerConnection.current && candidate) {
                try {
                    await peerConnection.current.addIceCandidate(candidate);
                    console.log("[PhoneCam] Added remote ICE candidate.");
                } catch (error) {
                    console.error("[PhoneCam] Error adding ICE candidate:", error);
                }
            }
        });

        socket.current.on("control", (cmd) => {
            console.log(`[PhoneCam] Control command received: ${cmd}`);
            setStatus(`Command received: ${cmd}`);
            if (typeof cmd === 'string') {
                setJointStates({ cmd: cmd, timestamp: Date.now() });
            } else if (typeof cmd === 'object' && cmd !== null) {
                setJointStates({ ...cmd, timestamp: Date.now() });
            }

            if (displayMode === 'video') {
                const char = document.getElementById("character");
                if (!char) return;

                const currentLeft = parseInt(char.style.left || "140");

                if (cmd === "left") {
                    char.style.left = Math.max(currentLeft - 20, 0) + "px";
                } else if (cmd === "right") {
                    char.style.left = Math.min(currentLeft + 20, 280) + "px";
                } else if (cmd === "jump") {
                    char.style.transition = "bottom 0.3s ease-out";
                    char.style.bottom = "100px";
                    setTimeout(() => {
                        char.style.bottom = "10px";
                    }, 300);
                }
            }
        });

        socket.current.on("disconnect", () => {
            setStatus("Disconnected from server.");
            console.log("[PhoneCam] Disconnected from server.");
            setCallActive(false);
            if (peerConnection.current) {
                peerConnection.current.close();
                peerConnection.current = null;
            }
            if (localVideoRef.current && localVideoRef.current.srcObject) {
                localVideoRef.current.srcObject.getTracks().forEach(track => track.stop());
                localVideoRef.current.srcObject = null;
            }
        });

        getLocalStream();

        return () => {
            console.log("[PhoneCam] Cleaning up on component unmount.");
            if (peerConnection.current) {
                peerConnection.current.close();
                peerConnection.current = null;
            }
            if (localVideoRef.current && localVideoRef.current.srcObject) {
                localVideoRef.current.srcObject.getTracks().forEach(track => track.stop());
                localVideoRef.current.srcObject = null;
            }
            if (socket.current) {
                socket.current.disconnect();
            }
        };
    }, [displayMode, setupPeerConnection, getLocalStream]);

    // File Upload Handlers
    const handleUrdfFileUpload = (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                setUploadedUrdfContent(e.target.result);
                setUploadedFileMap({}); // For a single URDF, initialize an empty map for now
                setStatus(`URDF file "${file.name}" loaded.`);
                console.log(`[PhoneCam] URDF file "${file.name}" loaded.`);
            };
            reader.onerror = (e) => {
                console.error("Error reading URDF file:", e);
                setStatus("Error reading URDF file.");
            };
            reader.readAsText(file);
        }
    };

 // ... (inside PhoneCam.jsx) ...

const handleZipFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) {
        return;
    }

    // Clean up previous blob URLs if new files are loaded
    if (fileMap) {
        console.log("[PhoneCam] Revoking previous fileMap Blob URLs...");
        Object.values(fileMap).forEach(blobUrl => {
            try {
                URL.revokeObjectURL(blobUrl);
            } catch (e) {
                console.warn("[PhoneCam] Error revoking blob URL:", blobUrl, e);
            }
        });
    }
    if (uploadedUrdfContent) {
        try {
            URL.revokeObjectURL(uploadedUrdfContent);
        } catch (e) {
            console.warn("[PhoneCam] Error revoking main URDF blob URL:", uploadedUrdfContent, e);
        }
    }

    setUrdfLoading(true);
    setRobotLoaded(false);

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const zip = await JSZip.loadAsync(e.target.result);
            const tempFileMap = {}; // This is the map that needs to contain ALL assets
            let mainUrdfContentBlobUrl = null;
            let urdfFileCount = 0;

            for (const filename in zip.files) {
                const zipEntry = zip.files[filename];
                if (!zipEntry.dir) {
                    const normalizedPath = filename.replace(/\\/g, '/'); // e.g., "meshes/thorax.STL" or "crab_model.urdf"

                    // --- DEBUGGING STEP 1: Log every file being processed ---
                    console.log(`[PhoneCam Debug] Processing file: ${normalizedPath}`);

                    if (normalizedPath.toLowerCase().endsWith('.urdf') || normalizedPath.toLowerCase().endsWith('.xml')) {
                        const urdfTextContent = await zipEntry.async("text");
                        const urdfBlob = new Blob([urdfTextContent], { type: 'application/xml' });
                        const urdfBlobUrl = URL.createObjectURL(urdfBlob);

                        // Store URDF blob URL in the map using its ORIGINAL (normalized) path
                        tempFileMap[normalizedPath] = urdfBlobUrl;

                        if (mainUrdfContentBlobUrl === null) {
                            mainUrdfContentBlobUrl = urdfBlobUrl;
                            console.log(`[PhoneCam] Identified main URDF: ${normalizedPath}, Blob URL: ${urdfBlobUrl}`);
                        } else {
                            console.log(`[PhoneCam] Found additional URDF: ${normalizedPath}, added to file map.`);
                        }
                        urdfFileCount++;
                        console.log(`[PhoneCam Debug] Added URDF to tempFileMap: ${normalizedPath}`);

                    } else if (normalizedPath.toLowerCase().endsWith('.stl') || normalizedPath.toLowerCase().endsWith('.dae') || normalizedPath.toLowerCase().endsWith('.obj') || normalizedPath.toLowerCase().endsWith('.glb') || normalizedPath.toLowerCase().endsWith('.gltf')) {
  const blob = await zipEntry.async("blob");
    const blobUrl = URL.createObjectURL(blob);

    // This should remain .toLowerCase() because your Final File map shows lowercase keys
    tempFileMap[normalizedPath.toLowerCase()] = blobUrl;
    console.log(`[PhoneCam] Created blob for mesh: ${normalizedPath}, Blob URL: ${blobUrl}`);
    console.log(`[PhoneCam Debug] Added mesh to tempFileMap: ${normalizedPath.toLowerCase()}`); // Match the key
}
                }
            }

            if (urdfFileCount === 0 || !mainUrdfContentBlobUrl) {
                setStatus("Error: No .urdf or .xml file found in the ZIP archive.");
                setUrdfLoading(false);
                Object.values(tempFileMap).forEach(blobUrl => {
                    try { URL.revokeObjectURL(blobUrl); } catch (e) { /* ignore */ }
                });
                return;
            }

            setUploadedUrdfContent(mainUrdfContentBlobUrl);
            setFileMap(tempFileMap); // This fileMap now has original casing for keys
            setSelectedRobotKey(file.name);
            setStatus(`ZIP file "${file.name}" processed.`);
            console.log("[PhoneCam] ZIP file processed. Final File map:", tempFileMap);

            setUrdfLoading(false);
            setRobotLoaded(true);
        } catch (error) {
            console.error("Error processing ZIP file:", error);
            setStatus(`Error processing ZIP file: ${error.message}`);
            setUrdfLoading(false);
            setRobotLoaded(false);
        }
    };
    reader.readAsArrayBuffer(file);
};


    return (
        <div style={styles.container}>
            <h2 style={styles.heading}>📱 Phone Camera & Robot</h2>
            <p style={styles.statusText}>Status: <span style={styles.statusValue}>{status}</span></p>
            <p style={styles.deviceIdText}>Your Device ID: <strong style={styles.deviceIdValue}>{PHONE_DEVICE_ID}</strong></p>

            <div style={styles.modeToggleContainer}>
                <button
                    onClick={() => setDisplayMode('video')}
                    style={{ ...styles.modeButton, ...(displayMode === 'video' && styles.modeButtonActive) }}
                >
                    Show Camera Feed
                </button>
                <button
                    onClick={() => setDisplayMode('urdf')}
                    style={{ ...styles.modeButton, ...(displayMode === 'urdf' && styles.modeButtonActive) }}
                >
                    Show URDF Robot
                </button>
            </div>

            {displayMode === 'urdf' && (
                <div style={styles.modelUploadContainer}>
                    <h3>Upload Robot Model:</h3>
                    <div style={styles.uploadButtons}>
                        <label htmlFor="urdf-upload" style={styles.uploadLabel}>
                            Upload .urdf file
                        </label>
                        <input
                            type="file"
                            id="urdf-upload"
                            ref={urdfInputRef}
                            accept=".urdf"
                            onChange={handleUrdfFileUpload}
                            style={styles.hiddenInput}
                        />
                        <label htmlFor="zip-upload" style={styles.uploadLabel}>
                            Upload .zip (URDF + Meshes)
                        </label>
                        <input
                            type="file"
                            id="zip-upload"
                            ref={zipInputRef}
                            accept=".zip"
                            onChange={handleZipFileUpload}
                            style={styles.hiddenInput}
                        />
                    </div>
                    {uploadedUrdfContent && (
                        <p style={styles.uploadedFileName}>
                            Loaded URDF: <span style={{ fontWeight: 'bold' }}>{urdfInputRef.current?.files[0]?.name || zipInputRef.current?.files[0]?.name || 'Unknown'}</span>
                        </p>
                    )}
                </div>
            )}

            <div style={{
                ...styles.videoContainer,
                display: displayMode === 'video' ? 'block' : 'none'
            }}>
                <video ref={localVideoRef} autoPlay playsInline muted style={styles.videoStream} />
                <div
                    style={{
                        position: "relative",
                        width: "100%",
                        maxWidth: "320px",
                        height: "240px",
                        backgroundColor: "#eee",
                        marginTop: "10px",
                        overflow: "hidden",
                        border: "1px solid #ccc",
                        borderRadius: "8px",
                        margin: "10px auto",
                    }}
                >
                    <div
                        id="character"
                        style={{
                            width: "40px",
                            height: "40px",
                            backgroundColor: "blue",
                            borderRadius: "50%",
                            position: "absolute",
                            bottom: "10px",
                            left: "50%",
                            transform: "translateX(-50%)",
                            transition: "left 0.3s ease-out, bottom 0.3s ease-out",
                        }}
                    ></div>
                </div>
            </div>

            {displayMode === 'urdf' && uploadedUrdfContent && ( // Only render Canvas if URDF content is available
                <div style={styles.urdfContainer}>
                    <Canvas
                        camera={{ fov: 50, near: 0.01, far: 2000 }} // Adjusted near plane
                        onCreated={({ camera }) => {
                            cameraRef.current = camera;
                            console.log("[PhoneCam] R3F Canvas created, camera ref set.");
                        }}
                    >
                        <ambientLight intensity={0.8} />
                        <directionalLight position={[2, 5, 2]} intensity={1} />
                        <directionalLight position={[-2, -5, -2]} intensity={0.5} />
                        <Environment preset="studio" />
                        <Suspense fallback={<Text color="black" anchorX="center" anchorY="middle">Loading Robot...</Text>}>
                           <UrdfRobotModel
    jointStates={jointStates}
    controlMode={controlMode}
  onRobotLoaded={handleRobotLoaded}
    urdfContent={uploadedUrdfContent} // This now receives the Blob URL
    fileMap={fileMap}
/>
                        </Suspense>
                        {/* CameraUpdater will render OrbitControls and manage camera position */}
                        <CameraUpdater
                            loadedRobotInstanceRef={loadedRobotInstanceRef}
                            // Pass selectedRobotKey as a dummy prop to trigger effect on new model load
                            // We don't have a 'key' for uploaded models, so rely on uploadedUrdfContent changing
                            selectedRobotKey={uploadedUrdfContent}
                        />
                    </Canvas>
                </div>
            )}
            {displayMode === 'urdf' && !uploadedUrdfContent && (
                <div style={styles.urdfContainerNoModel}>
                    <p style={styles.noModelText}>Please upload a URDF robot model to view it here.</p>
                </div>
            )}
        </div>
    );
};


// Helper component to trigger camera adjustment inside Canvas context
const CameraUpdater = ({ loadedRobotInstanceRef, selectedRobotKey }) => {
    const { camera } = useThree();
    const orbitControls = useRef(); // Declare orbitControls ref here

    useEffect(() => {
        const robot = loadedRobotInstanceRef.current;
        if (robot && orbitControls.current) {
            console.log("[CameraUpdater] Adjusting camera based on new robot/model selection...");
            const box = new THREE.Box3().setFromObject(robot);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());

            const maxDim = Math.max(size.x, size.y, size.z);
            const fov = camera.fov * (Math.PI / 180);
            let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
            cameraZ *= 1.5; // Adjust distance

            camera.position.set(center.x, center.y + size.y / 2, cameraZ + center.z);
            camera.lookAt(center);

            orbitControls.current.target.copy(center);
            orbitControls.current.update();

            camera.far = cameraZ * 2;
            camera.near = 0.01;
            camera.updateProjectionMatrix();

            console.log("[CameraUpdater] Camera adjusted to center:", center, "and position:", camera.position);
        }
    }, [loadedRobotInstanceRef, selectedRobotKey, camera]); // Re-run when model changes or robot instance updates (through ref)

    // Render OrbitControls here and attach the ref
    return <OrbitControls ref={orbitControls} />;
};


// The `Text` component from @react-three/drei is used directly now.
// The previous simple div Text component is removed.

const styles = {
    container: {
        padding: '20px',
        maxWidth: '95%',
        margin: '20px auto',
        textAlign: 'center',
        fontFamily: "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
        backgroundColor: "#ffffff",
        borderRadius: "15px",
        boxShadow: "0 8px 25px rgba(0,0,0,0.15)",
        background: 'linear-gradient(145deg, #f0f0f0, #ffffff)',
        border: '1px solid #e0e0e0',
        boxSizing: 'border-box',
    },
    heading: {
        color: '#2c3e50',
        marginBottom: '15px',
        fontSize: '1.8em',
        fontWeight: '700',
        letterSpacing: '0.5px',
    },
    statusText: {
        fontSize: '1em',
        color: '#555',
        marginBottom: '8px',
    },
    statusValue: {
        fontWeight: 'bold',
        color: '#007bff',
    },
    deviceIdText: {
        fontSize: '0.9em',
        color: '#777',
        marginBottom: '20px',
        wordBreak: 'break-all',
    },
    deviceIdValue: {
        color: '#34495e',
    },
    modeToggleContainer: {
        marginBottom: '20px',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: '10px',
    },
    modeButton: {
        padding: '10px 20px',
        border: '2px solid #007bff',
        borderRadius: '25px',
        backgroundColor: '#ffffff',
        color: '#007bff',
        cursor: 'pointer',
        fontSize: '0.9em',
        fontWeight: '600',
        transition: 'all 0.3s ease',
        outline: 'none',
        boxShadow: '0 2px 5px rgba(0, 123, 255, 0.2)',
        flexGrow: 1,
        maxWidth: 'calc(50% - 10px)',
    },
    modeButtonActive: {
        backgroundColor: '#007bff',
        color: 'white',
        borderColor: '#0056b3',
        boxShadow: '0 4px 10px rgba(0, 123, 255, 0.4)',
    },
    modelUploadContainer: {
        marginBottom: '20px',
        borderTop: '1px solid #e0e0e0',
        paddingTop: '15px',
        marginTop: '15px',
    },
    uploadButtons: {
        display: 'flex',
        justifyContent: 'center',
        gap: '15px',
        marginBottom: '15px',
    },
    uploadLabel: {
        padding: '10px 20px',
        border: '2px dashed #007bff',
        borderRadius: '8px',
        backgroundColor: '#f8f9fa',
        color: '#007bff',
        cursor: 'pointer',
        fontSize: '0.9em',
        fontWeight: '600',
        transition: 'all 0.3s ease',
        display: 'inline-block',
        '&:hover': {
            backgroundColor: '#e9f3ff',
        }
    },
    hiddenInput: {
        display: 'none',
    },
    uploadedFileName: {
        fontSize: '0.9em',
        color: '#333',
        marginBottom: '10px',
    },
    videoContainer: {
        border: '2px solid #e0e0e0',
        borderRadius: '10px',
        overflow: 'hidden',
        boxShadow: '0 4px 15px rgba(0,0,0,0.08)',
        width: '100%',
        height: 'auto',
        aspectRatio: '16 / 9',
        margin: '0 auto',
        backgroundColor: '#f5f5f5',
    },
    videoStream: {
        width: '100%',
        height: '100%',
        display: 'block',
        objectFit: 'cover',
    },
    urdfContainer: {
        width: '100%',
        height: '350px', // Slightly increased height for better view
        border: '2px solid #e0e0e0',
        borderRadius: '10px',
        margin: '0 auto',
        overflow: 'hidden',
        backgroundColor: '#f5f5f5',
        boxShadow: '0 4px 15px rgba(0,0,0,0.08)',
        position: 'relative', // For Text overlay
    },
    urdfContainerNoModel: {
        width: '100%',
        height: '350px',
        border: '2px dashed #ccc',
        borderRadius: '10px',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f9f9f9',
        color: '#888',
        fontSize: '1.1em',
        fontStyle: 'italic',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
    },
    noModelText: {
        textAlign: 'center',
        padding: '20px',
    },
    '@media (max-width: 480px)': {
        modeButton: {
            maxWidth: '100%',
        },
        urdfContainer: {
            height: '300px', // Adjusted for smaller screens
        },
        urdfContainerNoModel: {
            height: '300px', // Adjusted for smaller screens
        }
    }
};

export default PhoneCam;