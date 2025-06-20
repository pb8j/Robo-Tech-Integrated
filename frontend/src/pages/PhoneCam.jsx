// src/pages/PhoneCam.jsx
import React, { useEffect, useRef, useState, Suspense, useCallback } from "react"; // Added useCallback
import { io } from "socket.io-client";
import { Canvas, useLoader } from "@react-three/fiber";
import URDFLoader from 'urdf-loader';
import { OrbitControls, Environment, Text } from "@react-three/drei";
import * as THREE from 'three';

// Node server URL for Socket.IO and WebRTC signaling
const NODE_SERVER_URL = "https://backend-746d.onrender.com";
const PHONE_DEVICE_ID = `phone-${Math.random().toString(36).substring(7)}`;

// Define robot configurations for both models
const ROBOT_MODELS = {
    hexapod_robot: {
        urdfPath: "/hexapod_robot/crab_model.urdf",
        packagePath: "/", // Assuming public/hexapod_robot/ contains meshes folder
        name: "Hexapod Robot"
    },
    jaxon_jvrc: {
        urdfPath: "/hexapod_robot2/jaxon_jvrc.urdf",
        packagePath: "/", // Assuming public/hexapod_robot2/ contains meshes folder
        name: "JAXON JVRC"
    }
};

/**
 * React component for loading and displaying a URDF robot model in a Three.js canvas.
 * Handles joint state updates based on control commands.
 * @param {object} props - Component props
 * @param {object} props.jointStates - Object containing robot joint commands (e.g., { cmd: 'forward' })
 * @param {string} props.controlMode - Current display mode ('video' or 'urdf')
 * @param {function} props.onRobotLoaded - Callback function when the robot model is loaded,
 * passing the loaded THREE.Object3D
 * @param {string} props.selectedRobotName - The key of the currently selected robot model (e.g., 'hexapod_robot')
 */
const UrdfRobotModel = ({ jointStates, controlMode, onRobotLoaded, selectedRobotName }) => {
    // Get the URDF and package paths based on the selected robot name
    const robotConfig = ROBOT_MODELS[selectedRobotName] || ROBOT_MODELS.hexapod_robot; // Default to hexapod_robot

    // Use the useLoader hook from @react-three/fiber to load the URDF model
    const robot = useLoader(URDFLoader, robotConfig.urdfPath, (loader) => {
        // Set the working path for the URDF loader to resolve relative mesh paths (e.g., "meshes/...")
        loader.workingPath = robotConfig.packagePath;
        loader.parseVisual = true; // Parse visual elements
        loader.parseCollision = false; // Do not parse collision elements (optional, can be true)
    });

    // Effect to run once the robot model is loaded
    useEffect(() => {
        if (robot) {
            console.log(`URDF Robot Loaded (${robotConfig.name}):`, robot);
            console.log(`Available Joints (${robotConfig.name}):`, Object.keys(robot.joints));

            // Apply a scale factor to make the robot visible and appropriately sized
            // These scale and position values might need adjustment per robot model
            const scaleFactor = 10;
            robot.scale.set(scaleFactor, scaleFactor, scaleFactor);
            // Adjust the robot's initial position for better viewing in the scene
            // This position brings the robot roughly to the center of the view
            robot.position.set(0, -2.0 * scaleFactor, 0); // Adjust Y based on robot's height if needed

            // Call the callback if provided, to notify parent component about the loaded robot
            if (onRobotLoaded) {
                onRobotLoaded(robot);
            }
        }
    }, [robot, onRobotLoaded, robotConfig.name]); // Depend on robot, callback, and config name

    // Effect to update robot joint states and position based on received commands
    useEffect(() => {
        // Apply commands ONLY if the selected robot is the 'hexapod_robot' AND a command is issued
        if (selectedRobotName === 'hexapod_robot' && robot && controlMode === 'urdf' && jointStates.cmd) {
            const rotationAmount = 0.1; // Amount for joint rotation
            const liftAmount = 0.1;     // Amount for vertical lift (jump)
            const moveAmount = 0.5;     // Amount for translational movement

            // Helper function to safely get a joint's current value
            const getJointValue = (jointName) => {
                const joint = robot.joints[jointName];
                // Return current joint angle or 0 if not found/defined
                return joint ? (joint.angle || 0) : 0;
            };

            // Process different control commands for Hexapod Robot
            if (jointStates.cmd === 'left') {
                // Rotate right coxa joints positively and left coxa joints negatively for turning
                ['coxa_joint_r1', 'coxa_joint_r2', 'coxa_joint_r3'].forEach(jointName => {
                    const joint = robot.joints[jointName];
                    if (joint) {
                        joint.setJointValue(getJointValue(jointName) + rotationAmount);
                    }
                });
                ['coxa_joint_l1', 'coxa_joint_l2', 'coxa_joint_l3'].forEach(jointName => {
                    const joint = robot.joints[jointName];
                    if (joint) {
                        joint.setJointValue(getJointValue(jointName) - rotationAmount);
                    }
                });
                console.log("Hexapod: Attempting 'left' turn.");
            } else if (jointStates.cmd === 'right') {
                // Rotate right coxa joints negatively and left coxa joints positively for turning
                ['coxa_joint_r1', 'coxa_joint_r2', 'coxa_joint_r3'].forEach(jointName => {
                    const joint = robot.joints[jointName];
                    if (joint) {
                        joint.setJointValue(getJointValue(jointName) - rotationAmount);
                    }
                });
                ['coxa_joint_l1', 'coxa_joint_l2', 'coxa_joint_l3'].forEach(jointName => {
                    const joint = robot.joints[jointName];
                    if (joint) {
                        joint.setJointValue(getJointValue(jointName) + rotationAmount);
                    }
                });
                console.log("Hexapod: Attempting 'right' turn.");
            } else if (jointStates.cmd === 'jump') {
                const allFemurJoints = [
                    'femur_joint_r1', 'femur_joint_r2', 'femur_joint_r3',
                    'femur_joint_l1', 'femur_joint_l2', 'femur_joint_l3'
                ];

                // Lower all femur joints for jump preparation (simulated)
                allFemurJoints.forEach(jointName => {
                    const joint = robot.joints[jointName];
                    if (joint) {
                        joint.setJointValue(getJointValue(jointName) - liftAmount);
                    }
                });

                // After a short delay, lift them back up to simulate jump
                setTimeout(() => {
                    allFemurJoints.forEach(jointName => {
                        const joint = robot.joints[jointName];
                        if (joint) {
                            joint.setJointValue(getJointValue(jointName) + liftAmount);
                        }
                    });
                }, 300); // 300ms delay

                console.log("Hexapod: Attempting 'jump'.");
            } else if (jointStates.cmd === 'forward') {
                robot.position.z -= moveAmount; // Move robot along the Z-axis
                console.log("Hexapod: Moving forward. New Z:", robot.position.z);
            } else if (jointStates.cmd === 'backward') {
                robot.position.z += moveAmount; // Move robot along the Z-axis
                console.log("Hexapod: Moving backward. New Z:", robot.position.z);
            } else if (jointStates.cmd === 'up') {
                robot.position.y += moveAmount; // Move robot along the Y-axis (up)
                console.log("Hexapod: Moving up. New Y:", robot.position.y);
            } else if (jointStates.cmd === 'down') {
                robot.position.y -= moveAmount; // Move robot along the Y-axis (down)
                console.log("Hexapod: Moving down. New Y:", robot.position.y);
            }
        } else if (selectedRobotName !== 'hexapod_robot' && jointStates.cmd) {
            // Log if commands are ignored for other robots
            console.log(`Command '${jointStates.cmd}' ignored for ${robotConfig.name}. Only Hexapod Robot supports movement.`);
        }
    }, [jointStates, robot, controlMode, selectedRobotName]); // Depend on relevant states for re-evaluation

    // Render the loaded robot model
    return <primitive object={robot} />;
};


/**
 * Main PhoneCam component to display camera feed or URDF robot,
 * and handle WebRTC and Socket.IO communication.
 */
const PhoneCam = () => {
    // Refs for video element, WebRTC peer connection, and Socket.IO instance
    const localVideoRef = useRef(null);
    const peerConnection = useRef(null);
    const socket = useRef(null);
    // Refs for Three.js camera and OrbitControls for dynamic adjustments
    const orbitControlsRef = useRef();
    const cameraRef = useRef();

    // State variables for UI and robot control
    const [status, setStatus] = useState("Connecting to server...");
    const [jointStates, setJointStates] = useState({});
    const [displayMode, setDisplayMode] = useState('video'); // Default to video feed
    const [callActive, setCallActive] = useState(false); // Indicates if a WebRTC call is active
    // New state for selected robot model
    const [selectedRobotName, setSelectedRobotName] = useState('hexapod_robot'); // Default to hexapod_robot

    // State to hold the loaded robot object for camera adjustments
    const [loadedRobot, setLoadedRobot] = useState(null);
    // State to hold the local media stream
    const [localStream, setLocalStream] = useState(null); // Managed separately

    // Callback when the URDF robot model finishes loading
    const handleRobotLoaded = (robotObject) => {
        setLoadedRobot(robotObject);
    };

    // Function to get local media stream (camera and microphone)
    // Memoize with useCallback to prevent unnecessary re-creations
    const getLocalStream = useCallback(async () => {
        if (localStream) return localStream; // Return existing stream if already acquired
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }
            setLocalStream(stream); // Store the stream in state
            return stream;
        } catch (err) {
            setStatus(`Camera access denied or unavailable: ${err.message}`);
            console.error("Camera error:", err);
            const messageBox = document.createElement('div');
            messageBox.style.cssText = `
                position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                background-color: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                z-index: 1000; text-align: center; color: #333; font-family: sans-serif;
            `;
            messageBox.innerHTML = `
                <p>Camera access denied or unavailable. Please allow camera permissions.</p>
                <button onclick="this.parentNode.remove()" style="margin-top: 15px; padding: 8px 15px; background-color: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">OK</button>
            `;
            document.body.appendChild(messageBox);
            return null;
        }
    }, [localStream]); // Dependency on localStream to ensure it doesn't try to get a new one if already available

    // Effect for Socket.IO setup on component mount
    useEffect(() => {
        // Initialize Socket.IO connection
        socket.current = io(NODE_SERVER_URL);

        // Request local stream immediately when the component mounts
        // This ensures the camera is active regardless of display mode.
        getLocalStream();

        // Socket.IO event listeners
        socket.current.on("connect", () => {
            setStatus("Connected to server. Registering phone...");
            socket.current.emit("register_phone", PHONE_DEVICE_ID);
        });

        socket.current.on("connect_error", (err) => {
            console.error("Socket.IO Connect Error:", err);
            setStatus(`Connection Error: ${err.message}`);
        });

        socket.current.on("start_webrtc_offer", async ({ requestingLaptopSocketId }) => {
            setStatus("Laptop requested stream. Setting up WebRTC...");
            // Set up WebRTC peer connection and send SDP offer
            // Pass the localStream to setupPeerConnection
            const currentStream = await getLocalStream(); // Ensure stream is available
            if (currentStream) {
                await setupPeerConnection(requestingLaptopSocketId, currentStream);
                setCallActive(true);
            } else {
                console.error("Cannot setup WebRTC: Local stream not available.");
                setStatus("Error: Cannot start streaming. Camera not accessible.");
            }
        });

        socket.current.on("sdp_answer_from_laptop", async (sdpAnswer) => {
            setStatus("Received SDP Answer. Establishing connection...");
            if (peerConnection.current && peerConnection.current.remoteDescription === null) {
                await peerConnection.current.setRemoteDescription(new RTCSessionDescription(sdpAnswer));
                console.log("Phone: Remote description set (Answer).");
            }
        });

        socket.current.on("ice_candidate_from_laptop", async (candidate) => {
            if (peerConnection.current && candidate) {
                await peerConnection.current.addIceCandidate(candidate);
                console.log("Phone: Added remote ICE candidate.");
            }
        });

        socket.current.on("control", (cmd) => {
            setStatus(`Command received: ${cmd}`);
            // Only update joint states if in URDF mode and for the hexapod robot
            if (displayMode === 'urdf' && selectedRobotName === 'hexapod_robot') {
                setJointStates({ cmd: cmd, timestamp: Date.now() });
            }
        });

        socket.current.on("disconnect", () => {
            setStatus("Disconnected from server.");
            console.log("Phone: Disconnected from server.");
            setCallActive(false);
            // Do NOT stop localStream here. Keep it active.
        });

        // Cleanup function for useEffect: close peer connection, disconnect socket
        return () => {
            if (peerConnection.current) {
                peerConnection.current.close();
                peerConnection.current = null;
            }
            // IMPORTANT: Do NOT stop localStream tracks here.
            // The localStream should persist across mode changes.
            if (socket.current) {
                socket.current.disconnect();
            }
        };
    }, [getLocalStream, displayMode, selectedRobotName]); // Added getLocalStream to dependencies

    // Effect to adjust camera and orbit controls when the robot model is loaded in URDF mode
    useEffect(() => {
        if (displayMode === 'urdf' && loadedRobot && orbitControlsRef.current && cameraRef.current) {
            console.log("Adjusting camera and orbit controls for the loaded robot...");
            const box = new THREE.Box3().setFromObject(loadedRobot);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());

            const maxDim = Math.max(size.x, size.y, size.z);
            const fov = cameraRef.current.fov * (Math.PI / 180);
            let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));

            cameraZ *= 1.5;
            cameraRef.current.position.set(center.x, center.y + size.y / 2, cameraZ + center.z);
            cameraRef.current.lookAt(center);

            orbitControlsRef.current.target.copy(center);
            orbitControlsRef.current.update();

            cameraRef.current.far = cameraZ * 2;
            cameraRef.current.near = 0.01;
            cameraRef.current.updateProjectionMatrix();

            console.log("Camera adjusted to center:", center, "and position:", cameraRef.current.position);
        }
    }, [displayMode, loadedRobot]);

    /**
     * Sets up the WebRTC peer connection.
     * @param {string} requestingLaptopSocketId - The socket ID of the laptop requesting the stream.
     * @param {MediaStream} stream - The local media stream to add to the peer connection.
     */
    const setupPeerConnection = async (requestingLaptopSocketId, stream) => {
        if (peerConnection.current) {
            peerConnection.current.close();
        }

        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
            ]
        });
        peerConnection.current = pc;

        pc.oniceconnectionstatechange = () => {
            console.log('Phone ICE connection state:', pc.iceConnectionState);
            setStatus(`ICE State: ${pc.iceConnectionState}`);
        };

        // Add local video tracks to the peer connection only when setting up connection
        if (stream) {
            stream.getTracks().forEach(track => pc.addTrack(track, stream));
            console.log("Phone: Local stream tracks added to PeerConnection.");
        } else {
            console.error("Phone: No stream provided to add to PeerConnection.");
            setStatus("Error: No local stream to start WebRTC. Please allow camera permissions.");
            return;
        }

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                console.log("Phone: Sending ICE candidate to laptop.");
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
            console.log("Phone: Sending SDP Offer to laptop.");
            socket.current.emit("sdp_offer_from_phone", {
                sdpOffer: offer,
                phoneDeviceId: PHONE_DEVICE_ID,
                requestingLaptopSocketId: requestingLaptopSocketId
            });
            setStatus("Offer sent. Waiting for answer...");
        } catch (error) {
            console.error("Phone: Error creating or sending offer:", error);
            setStatus(`Error setting up WebRTC: ${error.message}`);
        }
    };

    return (
        <div style={styles.container}>
            <h2 style={styles.heading}>📱 Phone Camera & Robot</h2>
            <p style={styles.statusText}>Status: <span style={styles.statusValue}>{status}</span></p>
            <p style={styles.deviceIdText}>Your Device ID: <strong style={styles.deviceIdValue}>{PHONE_DEVICE_ID}</strong></p>

            {/* Mode Toggle Buttons */}
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

            {/* Robot Model Selection (only visible in URDF mode) */}
            {displayMode === 'urdf' && (
                <div style={styles.robotSelectContainer}>
                    <label htmlFor="robot-select" style={styles.label}>Select Robot: </label>
                    <select
                        id="robot-select"
                        value={selectedRobotName}
                        onChange={(e) => setSelectedRobotName(e.target.value)}
                        style={styles.select}
                    >
                        {Object.entries(ROBOT_MODELS).map(([key, value]) => (
                            <option key={key} value={key}>{value.name}</option>
                        ))}
                    </select>
                </div>
            )}

            {/* Video Stream Container (visible in 'video' mode) */}
            <div style={{ ...styles.videoContainer, display: displayMode === 'video' ? 'block' : 'none' }}>
                <video ref={localVideoRef} autoPlay playsInline muted style={styles.videoStream} />
            </div>


            {/* URDF Robot Container (visible in 'urdf' mode) */}
            {displayMode === 'urdf' && (
                <div style={styles.urdfContainer}>
                    <Canvas
                        camera={{ fov: 50, near: 0.1, far: 2000 }}
                        onCreated={({ camera }) => { cameraRef.current = camera; }}
                    >
                        {/* Lighting for the scene */}
                        <ambientLight intensity={0.8} />
                        <directionalLight position={[2, 5, 2]} intensity={1} />
                        <directionalLight position={[-2, -5, -2]} intensity={0.5} />
                        {/* Environment for realistic lighting and reflections */}
                        <Environment preset="studio" />
                        {/* Suspense to handle loading state of the URDF model */}
                        <Suspense fallback={<Text color="white" anchorX="center" anchorY="middle">Loading Robot...</Text>}>
                            <UrdfRobotModel
                                jointStates={jointStates}
                                controlMode={displayMode}
                                onRobotLoaded={handleRobotLoaded}
                                selectedRobotName={selectedRobotName}
                            />
                        </Suspense>
                        {/* OrbitControls for interactive camera manipulation */}
                        <OrbitControls ref={orbitControlsRef} />
                    </Canvas>
                </div>
            )}
        </div>
    );
};

// Styles object for the PhoneCam component
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
    robotSelectContainer: {
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        flexWrap: 'wrap',
    },
    label: {
        fontSize: '1em',
        color: '#555',
        fontWeight: 'bold',
    },
    select: {
        padding: '8px 15px',
        borderRadius: '8px',
        border: '1px solid #a0a0a0',
        backgroundColor: '#f9f9f9',
        fontSize: '0.9em',
        cursor: 'pointer',
        outline: 'none',
        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.08)',
        appearance: 'none',
        backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23333%22%20d%3D%22M287%20197.8c-3.6%203.6-7.8%205.4-12.8%205.4H18.2c-5%200-9.2-1.8-12.8-5.4-3.6-3.6-5.4-7.8-5.4-12.8s1.8-9.2%205.4-12.8L133.2%2017c3.6-3.6%207.8-5.4%2012.8-5.4s9.2%201.8%2012.8%205.4l127.8%20127.8c3.6%203.6%205.4%207.8%205.4%2012.8s-1.8%209.2-5.4%2012.8z%22%2F%3E%3C%2Fsvg%3E")',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 10px center',
        backgroundSize: '12px',
        paddingRight: '30px',
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
        height: '300px',
        border: '2px solid #e0e0e0',
        borderRadius: '10px',
        margin: '0 auto',
        overflow: 'hidden',
        backgroundColor: '#f5f5f5',
        boxShadow: '0 4px 15px rgba(0,0,0,0.08)',
    },
    '@media (max-width: 480px)': {
        modeButton: {
            maxWidth: '100%',
        },
        urdfContainer: {
            height: '250px',
        }
    }
};

export default PhoneCam;