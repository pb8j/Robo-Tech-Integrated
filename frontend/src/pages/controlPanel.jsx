// src/pages/controlPanel.jsx
import React, { useEffect, useRef, useState, Suspense, useCallback } from "react";
import { io } from "socket.io-client";
import { Canvas, useLoader } from "@react-three/fiber";
import URDFLoader from 'urdf-loader';
import { OrbitControls, Environment, Text } from "@react-three/drei";
import * as THREE from 'three';
import { useNavigate } from 'react-router-dom';

// Import MediaPipe Hands and CameraUtil
import { Hands } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';

// Node server URL for Socket.IO and WebRTC signaling
// Assuming your local backend is running on http://localhost:3001
const NODE_SERVER_URL = "https://backend-746d.onrender.com";

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
 * @param {string} props.selectedRobotName - The key of the currently selected robot model (e.g., 'hexapod_robot')
 */
const UrdfRobotModel = ({ jointStates, controlMode, selectedRobotName }) => {
    // Get the URDF and package paths based on the selected robot name
    const robotConfig = ROBOT_MODELS[selectedRobotName] || ROBOT_MODELS.hexapod_robot; // Default to hexapod_robot if name is invalid

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
        }
    }, [robot, robotConfig.name]); // Depend on robot and robotConfig.name to re-run on model change

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
                // Rotate all coxa joints positively for a general "left" movement/turn
                // You may need to fine-tune which joints to move for a desired effect.
                // For a "left" motion, typically all coxa joints rotate in one direction.
                ['coxa_joint_r1', 'coxa_joint_r2', 'coxa_joint_r3',
                'coxa_joint_l1', 'coxa_joint_l2', 'coxa_joint_l3'].forEach(jointName => {
                    const joint = robot.joints[jointName];
                    if (joint) {
                        joint.setJointValue(getJointValue(jointName) + rotationAmount);
                    }
                });
                console.log("Hexapod: Attempting 'left' (all joints).");
            } else if (jointStates.cmd === 'right') {
                // Rotate all coxa joints negatively for a general "right" movement/turn
                ['coxa_joint_r1', 'coxa_joint_r2', 'coxa_joint_r3',
                'coxa_joint_l1', 'coxa_joint_l2', 'coxa_joint_l3'].forEach(jointName => {
                    const joint = robot.joints[jointName];
                    if (joint) {
                        joint.setJointValue(getJointValue(jointName) - rotationAmount);
                    }
                });
                console.log("Hexapod: Attempting 'right' (all joints).");
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
 * Main ControlPanel component to manage phone connections, video streams,
 * URDF robot display, and send control commands.
 */
const ControlPanel = () => {
    const navigate = useNavigate(); // Hook for programmatically navigating
    // Refs for video element, WebRTC peer connection, and Socket.IO instance
    const remoteVideoRef = useRef(null);
    const peerConnection = useRef(null);
    const socket = useRef(null);

    // MediaPipe Hands specific refs and state
    const hands = useRef(null);
    const camera = useRef(null);
    const [handGesture, setHandGesture] = useState('None'); // State to store recognized hand gesture
    const lastCommandTime = useRef(0); // To debounce commands

    // State variables for UI and connection management
    const [availablePhones, setAvailablePhones] = useState([]); // List of connected phones
    const [selectedPhoneId, setSelectedPhoneId] = useState(""); // Currently selected phone for control/stream
    const [status, setStatus] = useState("Connecting to server..."); // Connection status message
    const [overlayOn, setOverlayOn] = useState(false); // Controls video overlay visibility
    const [localJointStates, setLocalJointStates] = useState({}); // Stores local joint commands for URDF mode
    const [displayMode, setDisplayMode] = useState('video'); // 'video' or 'urdf' for display
    const [showModal, setShowModal] = useState(false); // State for custom modal
    const [modalMessage, setModalMessage] = useState(""); // Message for custom modal
    // New state for selected robot model
    const [selectedRobotName, setSelectedRobotName] = useState('hexapod_robot'); // Default to hexapod_robot

    // Function to show custom modal
    const showCustomModal = (message) => {
        setModalMessage(message);
        setShowModal(true);
    };

    // Helper function to calculate distance between two 3D points
    const distance = (p1, p2) => {
        return Math.sqrt(
            Math.pow(p2.x - p1.x, 2) +
            Math.pow(p2.y - p1.y, 2) +
            Math.pow(p2.z - p1.z, 2)
        );
    };

    // Gesture Recognition Logic - UPDATED FOR OPEN_PALM_UP AND OPEN_PALM PRIORITY
    const recognizeGesture = useCallback((landmarks) => {
        if (!landmarks || landmarks.length === 0) return 'None';

        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        const middleTip = landmarks[12];
        const ringTip = landmarks[16];
        const pinkyTip = landmarks[20];
        const wrist = landmarks[0];

        const isFingerOpen = (tip, base) => distance(tip, base) > 0.08; 
        const isFingerClosed = (tip, base) => distance(tip, base) < 0.05; 


        const allFingersExtended =
            isFingerOpen(thumbTip, landmarks[2]) &&
            isFingerOpen(indexTip, landmarks[6]) &&
            isFingerOpen(middleTip, landmarks[10]) &&
            isFingerOpen(ringTip, landmarks[14]) &&
            isFingerOpen(pinkyTip, landmarks[18]);

        const isPalmFacingUp = indexTip.y < wrist.y && middleTip.y < wrist.y && ringTip.y < wrist.y;

        if (allFingersExtended && isPalmFacingUp) {
            return 'Open_Palm_Up';
        }

        // Check for GENERAL OPEN PALM (all fingers extended, but not necessarily pointing up)
        if (allFingersExtended) {
            return 'Open_Palm'; // This will be our "move right" gesture
        }

        // --- Other gestures (less priority/reliability, adjust as needed) ---

        // Check for a 'fist'
        const allFingersClosed =
            isFingerClosed(thumbTip, landmarks[2]) &&
            isFingerClosed(indexTip, landmarks[6]) &&
            isFingerClosed(middleTip, landmarks[10]) &&
            isFingerClosed(ringTip, landmarks[14]) &&
            isFingerClosed(pinkyTip, landmarks[18]);
        if (allFingersClosed) {
            return 'Fist';
        }

        // Example: 'Point Up' (index finger extended, others closed)
        const isIndexUp = isFingerOpen(indexTip, landmarks[6]) && indexTip.y < landmarks[5].y;
        const otherFingersBentForPoint =
            isFingerClosed(thumbTip, landmarks[2]) &&
            isFingerClosed(middleTip, landmarks[10]) &&
            isFingerClosed(ringTip, landmarks[14]) &&
            isFingerClosed(pinkyTip, landmarks[18]);
        if (isIndexUp && otherFingersBentForPoint) {
            return 'Point_Up';
        }

        return 'None'; // Default
    }, []);


    // Effect for Socket.IO and MediaPipe setup on component mount
    useEffect(() => {
        // Initialize Socket.IO connection
        socket.current = io(NODE_SERVER_URL);

        // Initialize MediaPipe Hands
        hands.current = new Hands({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
            }
        });

        hands.current.setOptions({
            maxNumHands: 1, // Detect one hand for simplicity
            modelComplexity: 1, // 0 (fastest) to 1 (accurate)
            minDetectionConfidence: 0.8,
            minTrackingConfidence: 0.7
        });

        hands.current.onResults((results) => {
            if (displayMode === 'video' && remoteVideoRef.current && results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
                const landmarks = results.multiHandLandmarks[0]; // Get landmarks for the first detected hand
                const gesture = recognizeGesture(landmarks);
                setHandGesture(gesture); // Update state with the recognized gesture

                // Debounce commands to avoid sending too many too quickly
                const now = Date.now();
                if (now - lastCommandTime.current > 500) { // 500ms debounce
                    let commandToSend = null;
                    // UPDATED GESTURE MAPPING FOR OPEN_PALM_UP AND OPEN_PALM
                    if (gesture === 'Open_Palm_Up') {
                        commandToSend = 'left'; // Map Open_Palm_Up to 'left'
                    } else if (gesture === 'Open_Palm') {
                        commandToSend = 'right'; // Map Open_Palm to 'right'
                    }
                    // You can add more mappings here if other gestures become reliable
                    else if (gesture === 'Point_Up') {
                        commandToSend = 'up'; // Example: Point_Up for 'up' movement
                    }
                    else if (gesture === 'Fist') {
                        // commandToSend = 'stop'; // Example for 'stop'
                    }


                    if (commandToSend && selectedRobotName === 'hexapod_robot') { // Only send if hexapod is selected
                        sendCommand(commandToSend, 'gesture'); // Indicate command came from gesture
                        lastCommandTime.current = now;
                    }
                }
            } else {
                setHandGesture('None'); // No hand detected or not in video mode
            }
        });


        // Socket.IO event listeners
        socket.current.on("connect", () => {
            setStatus("Connected to server. Registering laptop...");
            socket.current.emit("register_laptop"); // Register as a laptop device
            socket.current.emit("get_available_phones"); // Request list of available phones
        });

        socket.current.on("connect_error", (err) => {
            console.error("Socket.IO Connect Error:", err);
            setStatus(`Connection Error: ${err.message}`);
        });

        socket.current.on("available_phones", (phones) => {
            console.log("Available phones:", phones);
            setAvailablePhones(phones);
            // Automatically select the first available phone if none is selected
            if (!selectedPhoneId && phones.length > 0) {
                setSelectedPhoneId(phones[0]);
            }
        });

        socket.current.on("sdp_offer_from_phone", async ({ sdpOffer, phoneDeviceId }) => {
            setStatus(`Received SDP Offer from ${phoneDeviceId}. Setting up WebRTC...`);
            // Set up WebRTC peer connection and send SDP answer
            await setupPeerConnection(phoneDeviceId, sdpOffer);
        });

        socket.current.on("ice_candidate_from_phone", async (candidate) => {
            // Add remote ICE candidate to peer connection
            if (peerConnection.current && candidate) {
                await peerConnection.current.addIceCandidate(candidate);
                console.log("Laptop: Added remote ICE candidate.");
            }
        });

        socket.current.on("stream_error", (message) => {
            setStatus(`Stream Error: ${message}`);
            console.error("Stream Error:", message);
            showCustomModal(`Stream Error: ${message}`);
        });

        socket.current.on("disconnect", () => {
            setStatus("Disconnected from server.");
            console.log("Laptop: Disconnected from server.");
            if (camera.current) {
                camera.current.stop(); // Stop MediaPipe Camera when socket disconnects
            }
        });

        // Cleanup function for useEffect: close peer connection, disconnect socket, stop MediaPipe Camera
        return () => {
            if (peerConnection.current) {
                peerConnection.current.close();
                peerConnection.current = null;
            }
            if (socket.current) {
                socket.current.disconnect();
            }
            if (camera.current) {
                camera.current.stop();
            }
            if (hands.current) {
                hands.current.close();
            }
        };
    }, [displayMode, selectedRobotName, recognizeGesture]); // Add recognizeGesture to dependencies

    // Effect to run MediaPipe Camera when a video stream is active
    useEffect(() => {
        if (remoteVideoRef.current && displayMode === 'video' && hands.current) {
            // Stop any existing camera instance
            if (camera.current) {
                camera.current.stop();
            }
            // Initialize new Camera instance with the remote video stream
            camera.current = new Camera(remoteVideoRef.current, {
                onFrame: async () => {
                    if (remoteVideoRef.current && remoteVideoRef.current.readyState === 4) { // Ensure video is ready
                        await hands.current.send({ image: remoteVideoRef.current });
                    }
                },
                width: 640,
                height: 480
            });
            camera.current.start();
            console.log("MediaPipe Camera started for remote video stream.");
        } else if (camera.current) {
            camera.current.stop(); // Stop camera if not in video mode or video ref is null
            console.log("MediaPipe Camera stopped.");
            setHandGesture('None'); // Clear gesture when camera stops
        }
    }, [displayMode, selectedPhoneId]); // Depend on displayMode and selectedPhoneId to re-init camera

    /**
     * Sets up the WebRTC peer connection.
     * @param {string} phoneDeviceId - The ID of the phone device.
     * @param {RTCSessionDescriptionInit} [sdpOffer=null] - The SDP offer received from the phone.
     */
    const setupPeerConnection = async (phoneDeviceId, sdpOffer = null) => {
        // Close existing peer connection if any
        if (peerConnection.current) {
            peerConnection.current.close();
        }

        // Create a new RTCPeerConnection instance
        const pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }], // Google's public STUN server
        });
        peerConnection.current = pc;

        // Event listener for ICE connection state changes
        pc.oniceconnectionstatechange = () => {
            console.log('Laptop ICE connection state:', pc.iceConnectionState);
            setStatus(`ICE State: ${pc.iceConnectionState}`);
        };

        // Event listener for ICE candidates (network information)
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                // Emit ICE candidate to the phone via Socket.IO
                socket.current.emit("ice_candidate_from_laptop", {
                    candidate: event.candidate,
                    phoneDeviceId
                });
            }
        };

        // Event listener for remote tracks being added to the peer connection (video/audio from phone)
        pc.ontrack = (event) => {
            if (remoteVideoRef.current && event.streams && event.streams[0]) {
                remoteVideoRef.current.srcObject = event.streams[0];
                remoteVideoRef.current.play().catch(e => console.error("Video auto-play failed:", e));
                setStatus("Streaming live!");
            }
        };
        // Fallback for older browsers (onaddstream is deprecated)
        pc.onaddstream = (event) => {
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = event.stream;
                remoteVideoRef.current.play().catch(e => console.error("Video auto-play failed (onaddstream):", e));
                setStatus("Streaming live!");
            }
        };

        // If an SDP offer is provided, set remote description and create/send answer
        if (sdpOffer) {
            try {
                await pc.setRemoteDescription(new RTCSessionDescription(sdpOffer));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                // Emit SDP answer to the phone via Socket.IO
                socket.current.emit("sdp_answer_from_laptop", {
                    sdpAnswer: answer,
                    phoneDeviceId
                });
                setStatus("Answer sent. Stream should start...");
            } catch (error) {
                console.error("Error setting remote description or creating answer:", error);
                showCustomModal(`WebRTC Error: ${error.message}`);
                setStatus(`WebRTC Error: ${error.message}`);
            }
        }
    };

    /**
     * Handles selection of a phone device from the dropdown.
     * @param {Event} e - The change event from the select element.
     */
    const handleSelectPhone = (e) => {
        const id = e.target.value;
        setSelectedPhoneId(id);
        if (id) {
            setStatus(`Requesting stream from ${id}...`);
            if (socket.current) {
                // Request stream from the selected phone
                socket.current.emit("request_stream", {
                    phoneDeviceId: id,
                    laptopSocketId: socket.current.id
                });
                // Clear existing video stream while new one is connecting
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = null;
                }
            }
        }
    };

    /**
     * Sends a control command to the selected phone or updates local URDF.
     * @param {string} cmd - The control command (e.g., 'forward', 'jump').
     * @param {string} source - 'button' or 'gesture' to indicate command origin.
     */
    const sendCommand = (cmd, source = 'button') => {
        // Only allow commands if Hexapod Robot is selected
        if (selectedRobotName !== 'hexapod_robot') {
            if (source === 'button') { // Only show modal for button clicks
                showCustomModal(`Movement commands are only supported for the ${ROBOT_MODELS.hexapod_robot.name}.`);
            }
            return;
        }

        if (displayMode === 'urdf') {
            // If in URDF mode, update local joint states to animate the robot locally
            setLocalJointStates({ cmd: cmd, timestamp: Date.now() }); // Use timestamp to ensure effect re-runs
        } else {
            // If in video mode, send command to the selected phone
            if (!selectedPhoneId) {
                if (source === 'button') { // Only show modal for button clicks
                    showCustomModal("Please select a phone to control.");
                }
                return;
            }
            if (socket.current) {
                socket.current.emit("control", { cmd, targetPhoneId: selectedPhoneId });
                console.log(`Command "${cmd}" sent to ${selectedPhoneId}`);
            }
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-700 flex items-center justify-center p-4 sm:p-6 font-inter">
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <script src="https://cdn.tailwindcss.com"></script>

            <div className="bg-gray-800 p-6 sm:p-8 rounded-xl shadow-2xl w-full max-w-2xl text-center border border-gray-700">
                <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-6 tracking-tight">
                    Robot Control
                </h2>
                <p className={`text-lg mb-6 py-2 px-4 rounded-lg
                    ${status.includes('Connected') ? 'bg-green-600' : status.includes('Error') ? 'bg-red-600' : 'bg-blue-600'}
                    text-white font-semibold shadow-md`}
                >
                    Status: <span className="font-mono">{status}</span>
                </p>

                {/* Phone Selection */}
                <div className="mb-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                    <label htmlFor="phone-select" className="text-lg text-gray-300 font-medium whitespace-nowrap">
                        Select Phone Device:
                    </label>
                    <div className="relative w-full sm:w-2/3">
                        <select
                            id="phone-select"
                            value={selectedPhoneId}
                            onChange={handleSelectPhone}
                            className="block w-full py-2 px-4 pr-10 rounded-lg bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer appearance-none"
                        >
                            <option value="">-- Select a phone --</option>
                            {availablePhones.length === 0 && <option value="" disabled>No phones online</option>}
                            {availablePhones.map((id) => (
                                <option key={id} value={id}>{id}</option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                        </div>
                    </div>
                </div>

                {/* Display Mode & Navigation Buttons */}
                <div className="mb-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <button
                        onClick={() => setDisplayMode('video')}
                        className={`py-3 px-6 rounded-lg text-lg font-semibold transition duration-300 ease-in-out transform hover:scale-105
                            ${displayMode === 'video' ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-700 text-gray-300 border border-gray-600 hover:bg-blue-700 hover:text-white'}`}
                    >
                        Show Camera Feed
                    </button>
                    <button
                        onClick={() => setDisplayMode('urdf')}
                        className={`py-3 px-6 rounded-lg text-lg font-semibold transition duration-300 ease-in-out transform hover:scale-105
                            ${displayMode === 'urdf' ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-700 text-gray-300 border border-gray-600 hover:bg-blue-700 hover:text-white'}`}
                    >
                        Show URDF Robot (Local)
                    </button>
                    <button
                        onClick={() => navigate('/phonecam')}
                        className="py-3 px-6 rounded-lg text-lg font-semibold bg-green-600 text-white shadow-lg transition duration-300 ease-in-out hover:bg-green-700 transform hover:scale-105"
                    >
                        Go to Phone Camera Page
                    </button>
                </div>

                {/* Robot Model Selection (only visible in URDF mode) */}
                {displayMode === 'urdf' && (
                    <div className="mb-6 flex flex-col sm:flex-row items-center justify-center gap-4">
                        <label htmlFor="robot-model-select" className="text-lg text-gray-300 font-medium whitespace-nowrap">
                            Select Robot Model:
                        </label>
                        <div className="relative w-full sm:w-2/3">
                            <select
                                id="robot-model-select"
                                value={selectedRobotName}
                                onChange={(e) => setSelectedRobotName(e.target.value)}
                                className="block w-full py-2 px-4 pr-10 rounded-lg bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer appearance-none"
                            >
                                {Object.entries(ROBOT_MODELS).map(([key, value]) => (
                                    <option key={key} value={key}>{value.name}</option>
                                ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                            </div>
                        </div>
                    </div>
                )}

                {/* Video / URDF Display Area */}
                {displayMode === 'video' && (
                    <>
                        {selectedPhoneId ? (
                            <div className="relative w-full aspect-video bg-gray-700 rounded-lg overflow-hidden shadow-inner mb-6 border border-gray-600">
                                {/* The video element for the remote stream */}
                                <video
                                    ref={remoteVideoRef}
                                    autoPlay
                                    playsInline
                                    className="w-full h-full object-contain block"
                                    style={{ transform: 'scaleX(-1)' }} // Mirror the video for intuitive hand tracking
                                />
                                {overlayOn && (
                                    <div className="absolute inset-0 bg-gray-900 bg-opacity-95 text-white text-xl font-bold flex items-center justify-center rounded-lg">
                                        Stream Paused
                                    </div>
                                )}
                            </div>
                        ) : (
                            <p className="text-gray-400 text-lg my-6">Please select a phone to view its live feed.</p>
                        )}

                        {selectedPhoneId && (
                            <button
                                onClick={() => setOverlayOn(!overlayOn)}
                                className="py-2 px-4 rounded-lg bg-gray-600 text-white text-sm font-semibold transition duration-300 ease-in-out hover:bg-gray-700 shadow-md transform hover:scale-105"
                            >
                                {overlayOn ? "Turn On Stream View" : "Turn Off Stream View"}
                            </button>
                        )}
                        {/* Display Hand Gesture */}
                        <p className="text-gray-300 text-xl font-bold mt-4">
                            Detected Gesture: <span className="text-yellow-400">{handGesture}</span>
                        </p>
                    </>
                )}

                {displayMode === 'urdf' && (
                    <div className="w-full h-96 bg-gray-700 rounded-lg overflow-hidden shadow-inner mb-6 border border-gray-600">
                        <Canvas camera={{ position: [1, 1, 1], fov: 75 }}>
                            <ambientLight intensity={0.8} />
                            <directionalLight position={[2, 5, 2]} intensity={1} />
                            <directionalLight position={[-2, -5, -2]} intensity={0.5} />
                            <Environment preset="studio" />
                            <Suspense fallback={<Text color="white" anchorX="center" anchorY="middle">Loading Robot...</Text>}>
                                {/* Pass selectedRobotName to UrdfRobotModel */}
                                <UrdfRobotModel jointStates={localJointStates} controlMode={displayMode} selectedRobotName={selectedRobotName} />
                            </Suspense>
                            <OrbitControls />
                        </Canvas>
                    </div>
                )}

                {/* Robot Control Buttons */}
                <div className="mt-8">
                    <h3 className="text-2xl font-bold text-gray-200 mb-4">Robot Controls</h3>
                    {/* Only show controls if Hexapod Robot is selected */}
                    {selectedRobotName === 'hexapod_robot' ? (
                        <>
                            <div className="grid grid-cols-3 gap-3 md:grid-cols-4 md:gap-4 max-w-md mx-auto">
                                {/* Empty cell for spacing */}
                                <div></div>
                                <button onClick={() => sendCommand("up")} className="control-btn-dark">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 mx-auto">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
                                    </svg>
                                    Up
                                </button>
                                {/* Empty cell for spacing */}
                                <div></div>

                                <button onClick={() => sendCommand("left")} className="control-btn-dark">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 mx-auto">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                                    </svg>
                                    Left
                                </button>
                                <button onClick={() => sendCommand("forward")} className="control-btn-dark">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 mx-auto">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
                                    </svg>
                                    Forward
                                </button>
                                <button onClick={() => sendCommand("backward")} className="control-btn-dark">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 mx-auto">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" />
                                    </svg>
                                    Backward
                                </button>
                                <button onClick={() => sendCommand("right")} className="control-btn-dark">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 mx-auto">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                                    </svg>
                                    Right
                                </button>
                                {/* Empty cell for spacing */}
                                <div></div>
                                <button onClick={() => sendCommand("down")} className="control-btn-dark">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 mx-auto">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" />
                                    </svg>
                                    Down
                                </button>
                                {/* Empty cell for spacing */}
                                <div></div>
                            </div>
                            <div className="mt-4">
                                <button onClick={() => sendCommand("jump")} className="control-btn-dark-primary">
                                    <span className="text-2xl mr-2">🤸</span> Jump
                                </button>
                            </div>
                        </>
                    ) : (
                        <p className="text-gray-400 text-md">
                            Movement controls are only available for the <span className="font-semibold text-gray-300">Hexapod Robot</span>.
                        </p>
                    )}
                </div>
            </div>

            {/* Custom Modal for Alerts */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
                    <div className="bg-gray-800 p-8 rounded-lg shadow-xl border border-gray-700 text-center max-w-sm">
                        <p className="text-white text-lg mb-6">{modalMessage}</p>
                        <button
                            onClick={() => setShowModal(false)}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300 ease-in-out transform hover:scale-105"
                        >
                            OK
                        </button>
                    </div>
                </div>
            )}

            {/* Tailwind CSS custom styles (place at the end of the component or in a separate CSS file) */}
            <style jsx>{`
                .font-inter {
                    font-family: 'Inter', sans-serif;
                }
                .control-btn-dark {
                    @apply bg-gray-700 text-gray-200 py-3 px-4 rounded-xl font-bold flex flex-col items-center justify-center transition-all duration-200 ease-in-out transform hover:scale-105 hover:bg-gray-600 active:bg-gray-900 active:shadow-inner shadow-lg border border-gray-600 text-sm md:text-base;
                    box-shadow: 0 4px 10px rgba(0,0,0,0.2);
                }
                .control-btn-dark svg {
                    @apply mb-1;
                }
                .control-btn-dark-primary {
                    @apply bg-indigo-600 text-white py-3 px-6 rounded-xl font-bold flex items-center justify-center transition-all duration-200 ease-in-out transform hover:scale-105 hover:bg-indigo-700 active:bg-indigo-900 active:shadow-inner shadow-lg;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
                }
            `}</style>
        </div>
    );
};

export default ControlPanel;