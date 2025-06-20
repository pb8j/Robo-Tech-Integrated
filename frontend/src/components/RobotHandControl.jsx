// src/components/RobotHandControl.jsx
import React, { useEffect, useRef, useState, useCallback, Suspense, useMemo } from 'react'; // Added useMemo
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { Text } from '@react-three/drei';

// Import MediaPipe Hands and CameraUtil
import { Hands } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';

// Import the reusable UrdfRobotModel component
import UrdfRobotModel from './UrdfRobotModel';

/**
 * Helper component to control the camera within the R3F Canvas.
 * Adjusts camera position and target to frame the loaded robot.
 */
const CameraUpdater = ({ loadedRobotInstanceRef, triggerUpdate }) => {
    const { camera } = useThree();
    const orbitControlsRef = useRef();

    useEffect(() => {
        const robot = loadedRobotInstanceRef.current;
        if (robot && orbitControlsRef.current) {
            console.log("[CameraUpdater] Adjusting camera based on new robot.");
            const box = new THREE.Box3().setFromObject(robot);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());

            const maxDim = Math.max(size.x, size.y, size.z);
            const fov = camera.fov * (Math.PI / 180);
            let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
            cameraZ *= 1.8; // Further adjustment for distance

            // Set camera position to look at the center of the robot from a good distance
            camera.position.set(center.x, center.y + size.y / 2, cameraZ + center.z);
            camera.lookAt(center);

            // Update OrbitControls target
            orbitControlsRef.current.target.copy(center);
            orbitControlsRef.current.update();

            // Adjust camera frustum
            camera.far = cameraZ * 3; // Ensure far enough to see entire scene
            camera.near = 0.001; // Closer near plane for details
            camera.updateProjectionMatrix();

            console.log("[CameraUpdater] Camera adjusted. Position:", camera.position, "Target:", orbitControlsRef.current.target);
        }
    }, [loadedRobotInstanceRef, triggerUpdate, camera]); // triggerUpdate ensures this runs when the robot instance updates

    return <OrbitControls ref={orbitControlsRef} />;
};

/**
 * RobotHandControl component: Manages MediaPipe camera, gesture recognition,
 * and passes joint commands to the UrdfRobotModel.
 * @param {object} props
 * @param {File} props.urdfFile - The File object of the uploaded URDF.
 * @param {Map<string, ArrayBuffer>} props.meshFiles - Map of uploaded mesh filenames to their ArrayBuffer content.
 */
const RobotHandControl = ({ urdfFile, meshFiles }) => {
    const videoRef = useRef(null); // Ref for the local video element
    const hands = useRef(null); // MediaPipe Hands instance
    const cameraInstance = useRef(null); // MediaPipe Camera instance
    const animationFrameId = useRef(null); // For requestAnimationFrame loop

    const [status, setStatus] = useState("Loading camera...");
    const [handLandmarks, setHandLandmarks] = useState(null); // Raw MediaPipe hand landmarks
    const [robotJointStates, setRobotJointStates] = useState({}); // Joint states for the robot
    const loadedRobotInstanceRef = useRef(null); // Ref to hold the actual Three.js robot object
    const [cameraUpdateTrigger, setCameraUpdateTrigger] = useState(0); // To force CameraUpdater re-run


    // Memoize Blob URLs for UrdfRobotModel props
    const urdfContentBlobUrl = useMemo(() => {
        if (urdfFile) {
            return URL.createObjectURL(urdfFile);
        }
        return null;
    }, [urdfFile]);

    const fileMapForModel = useMemo(() => {
        const obj = {};
        if (meshFiles) {
            // Convert Map to plain object for UrdfRobotModel
            meshFiles.forEach((arrayBuffer, filename) => {
                obj[filename] = URL.createObjectURL(new Blob([arrayBuffer]));
            });
        }
        return obj;
    }, [meshFiles]);


    // MediaPipe Hand Landmark Processing and Gesture-to-Joint Mapping
    const onResults = useCallback((results) => {
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            const landmarks = results.multiHandLandmarks[0]; // Process the first detected hand
            setHandLandmarks(landmarks); // Update state for visualization (if needed)

            if (!loadedRobotInstanceRef.current) {
                console.warn("[RobotHandControl] Robot not yet loaded for gesture control.");
                return;
            }

            const robot = loadedRobotInstanceRef.current;
            const newJoints = {};
            // const rotationScale = 0.5; // Controls sensitivity of joint movement (if not using mapRange)
            // Define a typical range for humanoid joint movements (e.g., +/- PI/2 or PI/4)
            const JOINT_MAX_RANGE = Math.PI / 2; // 90 degrees
            const JOINT_MIN_RANGE = -Math.PI / 2; // -90 degrees

            // Helper to get distance between two points (normalized 0-1 coordinates)
            const distance = (p1, p2) => Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2) + Math.pow(p2.z - p1.z, 2));

            // Helper to map a value from one range to another
            const mapRange = (value, inMin, inMax, outMin, outMax) => {
                const clampedValue = Math.max(inMin, Math.min(value, inMax)); // Clamp input value
                return (clampedValue - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
            };

            // --- HEAD MOVEMENT (Mapping Hand X/Y to Head Yaw/Pitch) ---
            // Wrist X maps to HEAD_JOINT0 (Yaw) - moving hand left/right
            // Wrist Y maps to HEAD_JOINT1 (Pitch) - moving hand up/down
            // Assuming wrist landmark (index 0) provides a good reference
            if (robot.joints['HEAD_JOINT0'] && robot.joints['HEAD_JOINT1'] && landmarks[0]) {
                // X-movement of wrist: Map to Head Yaw. Invert X for intuitive control (move hand right, robot head right)
                const headYaw = mapRange(landmarks[0].x, 0, 1, JOINT_MAX_RANGE, JOINT_MIN_RANGE);
                newJoints['HEAD_JOINT0'] = headYaw;

                // Y-movement of wrist: Map to Head Pitch. Moving hand up makes robot look up.
                const headPitch = mapRange(landmarks[0].y, 0, 1, JOINT_MAX_RANGE, JOINT_MIN_RANGE); // Check if inverted
                newJoints['HEAD_JOINT1'] = headPitch;
            }


            // --- ARM MOVEMENT (Mapping Wrist Z-depth to Shoulder Pitch/Extension) ---
            // Wrist Z (depth) maps to shoulder pitch (e.g., LARM_JOINT1/RARM_JOINT1 - arm forward/backward)
            // Smaller Z means hand is closer to camera (more extended forward)
            if (robot.joints['LARM_JOINT1'] && robot.joints['RARM_JOINT1'] && landmarks[0]) {
                // Assuming Z range is -0.5 (close) to 0.5 (far). Adjust these values based on actual camera input.
                const armPitchValue = mapRange(landmarks[0].z, -0.2, 0.2, JOINT_MAX_RANGE, JOINT_MIN_RANGE); // Map Z to pitch angle
                newJoints['LARM_JOINT1'] = armPitchValue;
                newJoints['RARM_JOINT1'] = armPitchValue; // Both arms move together for simplicity
            }

            // --- SHOULDER ROLL / ARM OUT-IN (Mapping Hand X to LARM_JOINT0/RARM_JOINT0) ---
            // This is a common way to control shoulder roll (arm outward/inward rotation)
            if (robot.joints['LARM_JOINT0'] && robot.joints['RARM_JOINT0'] && landmarks[0]) {
                const armRollValue = mapRange(landmarks[0].x, 0, 1, -JOINT_MAX_RANGE, JOINT_MAX_RANGE);
                newJoints['LARM_JOINT0'] = armRollValue;
                newJoints['RARM_JOINT0'] = -armRollValue; // Opposite direction for right arm for symmetry
            }


            // --- FINGER MOVEMENT (Mapping thumb tip to index tip distance for open/close) ---
            const thumbTip = landmarks[4];
            const indexTip = landmarks[8];
            const middleTip = landmarks[12]; // Using middle finger for more robust grasp
            // Example: Control LARM_F_JOINT0 and LARM_F_JOINT1 for left hand fingers
            if (thumbTip && indexTip && middleTip && robot.joints['LARM_F_JOINT0'] && robot.joints['LARM_F_JOINT1']) {
                const thumbIndexDistance = distance(thumbTip, indexTip);
                const thumbMiddleDistance = distance(thumbTip, middleTip);

                // Determine if hand is "open" or "closed" (these thresholds need tuning)
                const isOpen = thumbIndexDistance > 0.08 && thumbMiddleDistance > 0.08; // Example threshold
                const isClosed = thumbIndexDistance < 0.04 && thumbMiddleDistance < 0.04; // Example threshold

                let fingerAngle = 0; // Default to closed (or resting)
                if (isOpen) {
                    fingerAngle = mapRange(thumbIndexDistance, 0.08, 0.15, 0, 1.0); // Open angle range
                } else if (isClosed) {
                    fingerAngle = mapRange(thumbIndexDistance, 0.03, 0.06, 1.0, 0); // Close angle range
                }
                // Clamp finger angle within reasonable limits
                fingerAngle = Math.max(0, Math.min(fingerAngle, 1.0)); // Example: 0 to 1 radian

                newJoints['LARM_F_JOINT0'] = fingerAngle; // Apply to primary finger joint
                newJoints['LARM_F_JOINT1'] = fingerAngle; // Apply to secondary finger joint

                // Apply to right hand fingers if they exist and are meant to mirror
                if (robot.joints['RARM_F_JOINT0'] && robot.joints['RARM_F_JOINT1']) {
                    newJoints['RARM_F_JOINT0'] = fingerAngle;
                    newJoints['RARM_F_JOINT1'] = fingerAngle;
                }
            }


            // --- CHASSIS/BODY MOVEMENT (for JAXON JVRC's CHEST_JOINT0/1) ---
            // Lean or twist based on hand X/Y (less sensitive than head)
            if (robot.joints['CHEST_JOINT0'] && robot.joints['CHEST_JOINT1'] && landmarks[0]) {
                 const chestYaw = mapRange(landmarks[0].x, 0, 1, JOINT_MAX_RANGE, JOINT_MIN_RANGE);
                 const chestPitch = mapRange(landmarks[0].y, 0, 1, JOINT_MAX_RANGE, JOINT_MIN_RANGE);
                 newJoints['CHEST_JOINT0'] = chestYaw * 0.3; // Less sensitive
                 newJoints['CHEST_JOINT1'] = chestPitch * 0.3;
            }

            // Update robotJointStates, using a timestamp to force useEffect re-run even if values are same
            setRobotJointStates(prev => ({ ...prev, ...newJoints, timestamp: Date.now() }));

        } else {
            setHandLandmarks(null); // No hand detected
            // Optionally, reset joints to a default resting pose if no hand is detected
            // setRobotJointStates({}); // This would reset all joints to 0
        }
    }, [loadedRobotInstanceRef]);


    // Setup Camera and MediaPipe Hands
    useEffect(() => {
        const videoElement = videoRef.current;
        if (!videoElement) {
            setStatus("Video element not found.");
            return;
        }

        // Initialize MediaPipe Hands
        hands.current = new Hands({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });
        hands.current.setOptions({
            maxNumHands: 1, // Detect one hand
            modelComplexity: 1, // 0 (fastest) to 1 (accurate)
            minDetectionConfidence: 0.7, // Higher confidence for detection
            minTrackingConfidence: 0.6 // Higher confidence for tracking
        });
        hands.current.onResults(onResults); // Attach our results handler

        // Setup Camera Stream
        cameraInstance.current = new Camera(videoElement, {
            onFrame: async () => {
                if (videoElement.readyState === 4) { // Ensure video is ready to send frames
                    await hands.current.send({ image: videoElement });
                }
            },
            width: 640,
            height: 480
        });

        cameraInstance.current.start()
            .then(() => {
                setStatus("Camera started. Move your hand!");
                console.log("[RobotHandControl] MediaPipe Camera started.");
            })
            .catch(err => {
                setStatus(`Camera error: ${err.message}`);
                console.error("[RobotHandControl] Failed to start camera:", err);
                // Use custom modal for alerts, not alert()
                const messageBox = document.createElement('div');
                messageBox.style.cssText = `
                    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                    background-color: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                    z-index: 1000; text-align: center; color: #333; font-family: sans-serif;
                `;
                messageBox.innerHTML = `
                    <p>Error starting camera: ${err.message}. Please allow camera permissions.</p>
                    <button onclick="this.parentNode.remove()" style="margin-top: 15px; padding: 8px 15px; background-color: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">OK</button>
                `;
                document.body.appendChild(messageBox);
            });

        // Cleanup function for useEffect
        return () => {
            console.log("[RobotHandControl] Cleaning up MediaPipe and Camera.");
            if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current);
            }
            if (cameraInstance.current) {
                cameraInstance.current.stop();
            }
            if (hands.current) {
                hands.current.close();
            }
            // Revoke Blob URLs when component unmounts (important for memory management)
            if (urdfContentBlobUrl) {
                try { URL.revokeObjectURL(urdfContentBlobUrl); } catch (e) { console.warn("Error revoking URDF Blob URL:", e); }
            }
            if (fileMapForModel) {
                Object.values(fileMapForModel).forEach(url => {
                    try { URL.revokeObjectURL(url); } catch (e) { console.warn("Error revoking mesh Blob URL:", e); }
                });
            }
        };
    }, [onResults, urdfContentBlobUrl, fileMapForModel]); // Dependencies for useEffect


    // Callback to get the loaded robot instance from UrdfRobotModel
    const handleUrdfRobotLoaded = useCallback((robotObject) => {
        console.log("[RobotHandControl] UrdfRobotModel reported robot loaded:", robotObject);
        loadedRobotInstanceRef.current = robotObject;
        // Trigger a camera update to frame the newly loaded robot
        setCameraUpdateTrigger(prev => prev + 1);
    }, []);


    return (
        <div className="flex flex-col items-center justify-center w-full max-w-4xl">
            <h3 className="text-2xl font-bold text-gray-200 mb-4">Robot Control with Hand Gestures</h3>
            <p className="text-lg text-gray-300 mb-4">Status: <span className="font-semibold text-yellow-400">{status}</span></p>

            <div className="flex flex-col md:flex-row gap-4 w-full">
                {/* Camera Feed for User's Gestures */}
                <div className="relative w-full md:w-1/2 aspect-video bg-gray-700 rounded-lg overflow-hidden shadow-inner border border-gray-600">
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover transform scaleX(-1)" // Mirror the video for intuitive control
                    />
                    <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white text-sm px-2 py-1 rounded">
                        Your Camera Feed
                    </div>
                    {/* Basic visual feedback for hand detection */}
                    {handLandmarks && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            {/* You could draw landmarks here using a canvas overlay if desired */}
                            <span className="text-green-400 text-5xl animate-pulse">✋</span>
                        </div>
                    )}
                </div>

                {/* URDF Robot Display Area */}
                <div className="w-full md:w-1/2 aspect-video bg-gray-700 rounded-lg overflow-hidden shadow-inner border border-gray-600">
                    {urdfContentBlobUrl && fileMapForModel ? (
                        <Canvas camera={{ position: [1, 1, 1], fov: 75 }}>
                            <ambientLight intensity={0.8} />
                            <directionalLight position={[2, 5, 2]} intensity={1} />
                            <directionalLight position={[-2, -5, -2]} intensity={0.5} />
                            <Environment preset="studio" />
                            <Suspense fallback={<Text color="white" anchorX="center" anchorY="middle">Loading Robot Model...</Text>}>
                                <UrdfRobotModel
                                    urdfContent={urdfContentBlobUrl}
                                    fileMap={fileMapForModel}
                                    jointStates={robotJointStates} // Pass dynamic joint states
                                    onRobotLoaded={handleUrdfRobotLoaded} // Get the loaded robot instance
                                    selectedRobotName="jaxon_jvrc" // Assume JAXON for hand control
                                    scale={0.001} // Initial scale specific for JAXON JVRC (usually very large)
                                    initialPosition={[0, -1, 0]} // Initial position specific for JAXON JVRC
                                />
                            </Suspense>
                            <CameraUpdater
                                loadedRobotInstanceRef={loadedRobotInstanceRef}
                                triggerUpdate={cameraUpdateTrigger}
                            />
                        </Canvas>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-xl">
                            Upload URDF and mesh files to view robot.
                        </div>
                    )}
                </div>
            </div>
            <p className="mt-4 text-gray-400">
                Move your hand in front of the camera to control the robot's head, arms, and fingers.
            </p>
        </div>
    );
};

export default RobotHandControl;