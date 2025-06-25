// src/pages/UrdfUploader.jsx
import React, { useRef, useState, Suspense, useEffect, useCallback, useMemo } from 'react';
import { Canvas, useLoader, useThree } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import URDFLoader from 'urdf-loader';
import * as THREE from 'three';
import { Text } from '@react-three/drei';
import { LoadingManager, FileLoader } from 'three';

// Import MediaPipe Hands and CameraUtil
import { Hands } from '@mediapipe/hands';
import { FaceMesh } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils'; // Import drawing utilities

// Helper component to control the camera within the R3F Canvas.
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

            // Calculate a suitable camera distance based on the robot's largest dimension
            const maxDim = Math.max(size.x, size.y, size.z);
            const fov = camera.fov * (Math.PI / 180);
            let cameraDistance = maxDim / (2 * Math.tan(fov / 2));
            cameraDistance *= 1.8; 
            camera.position.set(
                center.x + cameraDistance * 0.5, // Slightly to the right
                center.y + size.y * 0.7,         // Significantly above the base
                center.z + cameraDistance        // In front
            );
            camera.lookAt(center); // Always look at the robot's center

            // Set OrbitControls target to the robot's center for proper rotation pivot
            orbitControlsRef.current.target.copy(center);
            orbitControlsRef.current.update(); // Update controls to apply changes

            // Adjust camera frustum for optimal viewing
            camera.far = cameraDistance * 3;
            camera.near = 0.001;
            camera.updateProjectionMatrix();

            console.log("[CameraUpdater] Camera adjusted. Position:", camera.position, "Target:", orbitControlsRef.current.target);
        }
    }, [loadedRobotInstanceRef, triggerUpdate, camera]);

    return (
        <OrbitControls
            ref={orbitControlsRef}
            enableDamping={true} // Enable damping for smoother rotation
            dampingFactor={0.05} // Adjust damping factor for desired smoothness
        />
    );
};


// Define robot configurations for models (if needed for default loads)
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

/**
 
 * @param {object} props
 * @param {string} props.urdfContent - The Blob URL of the URDF file content. Required.
 * @param {object} props.fileMap - A plain object mapping filenames (keys) to Blob URLs (values) of mesh files. Required.
 * @param {object} [props.jointStates={}] - Object containing joint commands and target angles.
 * @param {string} [props.selectedRobotName='hexapod_robot'] - The key of the currently selected robot model (e.g., 'hexapod_robot' or 'jaxon_jvrc').
 * @param {function} [props.onRobotLoaded] - Optional callback when the robot model is loaded (receives the Three.js robot object).
 * @param {Array<number>} [props.initialPosition=[0,0,0]] - Initial position for the robot.
 * @param {number} [props.scale=1.0] - Initial scale for the robot.
 */
const UrdfRobotModel = ({
    urdfContent,
    fileMap,
    jointStates = {},
    selectedRobotName = 'hexapod_robot',
    onRobotLoaded,
    initialPosition = [0, 0, 0],
    scale = 1.0
}) => {
    const robotRef = useRef(null);

    const robotLoadedInstance = useLoader(URDFLoader, urdfContent, (loader) => {
        const customLoadingManager = new LoadingManager();
        const customFileLoader = new FileLoader(customLoadingManager);
        customFileLoader.setResponseType('arraybuffer');
        customLoadingManager.addHandler('file', customFileLoader);
        loader.manager = customLoadingManager;

        loader.manager.setURLModifier((url) => {
            console.log(`[UrdfRobotModel][URLModifier Debug] INCOMING URL from URDFLoader: '${url}'`);

            let lookupKeyCandidate = url;

            if (url.startsWith('blob:http')) {
                try {
                    const parsedUrl = new URL(url);
                    lookupKeyCandidate = parsedUrl.pathname.substring(1);
                    console.log(`[UrdfRobotModel][URLModifier Debug] Extracted path from blob URL: '${lookupKeyCandidate}'`);
                } catch (e) {
                    console.warn(`[UrdfRobotModel][URLModifier] Could not parse blob URL: ${url}`, e);
                }
            }

            if (lookupKeyCandidate.startsWith('package://')) {
                const parts = lookupKeyCandidate.substring('package://'.length).split('/');
                if (parts.length > 1) {
                    lookupKeyCandidate = parts.slice(1).join('/');
                } else {
                    lookupKeyCandidate = '';
                }
                console.log(`[UrdfRobotModel][URLModifier Debug] After package:// removal: '${lookupKeyCandidate}'`);
            } else if (lookupKeyCandidate.startsWith('model://')) {
                lookupKeyCandidate = lookupKeyCandidate.substring('model://'.length);
                console.log(`[UrdfRobotModel][URLModifier Debug] After model:// removal: '${lookupKeyCandidate}'`);
            }
            if (lookupKeyCandidate.startsWith('./')) {
                lookupKeyCandidate = lookupKeyCandidate.substring('./'.length);
                console.log(`[UrdfRobotModel][URLModifier Debug] After ./ removal: '${lookupKeyCandidate}'`);
            }
            if (lookupKeyCandidate.startsWith('../')) {
                lookupKeyCandidate = lookupKeyCandidate.substring('../'.length);
                console.log(`[UrdfRobotModel][URLModifier Debug] After ../ removal: '${lookupKeyCandidate}'`);
            }

            lookupKeyCandidate = lookupKeyCandidate.replace(/\\/g, '/');
            console.log(`[UrdfRobotModel][URLModifier Debug] After path normalization: '${lookupKeyCandidate}'`);

            if (lookupKeyCandidate.startsWith('/')) {
                lookupKeyCandidate = lookupKeyCandidate.substring(1);
                console.log(`[UrdfRobotModel][URLModifier Debug] After leading slash removal: '${lookupKeyCandidate}'`);
            }

            let foundBlobUrl = null;
            let usedKey = null;

            const possibleLookupKeys = [
                lookupKeyCandidate,
                lookupKeyCandidate.toLowerCase(),
                lookupKeyCandidate.split('/').pop(),
                lookupKeyCandidate.split('/').pop().toLowerCase()
            ];

            const uniquePossibleKeys = [...new Set(possibleLookupKeys.filter(key => key !== ''))];
            console.log(`[UrdfRobotModel][URLModifier Debug] Trying lookup keys in fileMap: ${uniquePossibleKeys.join(', ')}`);


            if (fileMap && typeof fileMap === 'object') {
                for (const keyAttempt of uniquePossibleKeys) {
                    if (fileMap[keyAttempt]) {
                        foundBlobUrl = fileMap[keyAttempt];
                        usedKey = keyAttempt;
                        break;
                    }
                }
            }


            if (foundBlobUrl) {
                console.log(`[UrdfRobotModel][URLModifier] ✅ SUCCESS! Provided data for URDF requested URL: "${url}" using key: "${usedKey}".`);
                return foundBlobUrl;
            } else {
                console.warn(`[UrdfRobotModel][URLModifier] ❌ ASSET NOT FOUND in fileMap for original URL: '${url}'.`);
                console.log("Current keys in provided fileMap (your uploaded mesh filenames):", fileMap ? Object.keys(fileMap) : "fileMap is null/empty");
                console.log("Please ensure one of the following keys is present in fileMap:", uniquePossibleKeys);

                return url;
            }
        });

        loader.parseVisual = true;
        loader.parseCollision = false;
        loader.workingPath = "/";
    });

    useEffect(() => {
        if (robotLoadedInstance) {
            console.log("URDF Robot Loaded (Three.js object):", robotLoadedInstance);
            console.log("Available Joints:", Object.keys(robotLoadedInstance.joints));

            robotRef.current = robotLoadedInstance;

            // Apply global rotation for JAXON JVRC to stand upright
            if (selectedRobotName === 'jaxon_jvrc' || selectedRobotName === 'trial' || selectedRobotName === 'hexapod_robot') {
                // Rotate -90 degrees on X to make Z-up models stand upright on Y-axis
                robotLoadedInstance.rotation.x = Math.PI / 2;
                robotLoadedInstance.rotation.y = Math.PI;
                robotLoadedInstance.rotation.z = Math.PI/1.8;
                console.log("[UrdfRobotModel] JAXON JVRC: Applied initial upright rotation (X: -PI/2).");
                // Adjust scale for JAXON
                robotLoadedInstance.scale.set(0.001, 0.001, 0.001);
            } else {
                 robotLoadedInstance.scale.set(scale, scale, scale); // Apply prop scale for others
            }


            // Adjust position AFTER rotation and scaling to put base on origin
            const box = new THREE.Box3().setFromObject(robotLoadedInstance);
            const center = box.getCenter(new THREE.Vector3());
            // Position robot to sit on the origin plane (y=0)
            robotLoadedInstance.position.set(initialPosition[0] - center.x, initialPosition[1] - box.min.y, initialPosition[2] - center.z);
            console.log("Robot positioned to origin and scaled.");


            if (onRobotLoaded) {
                onRobotLoaded(robotLoadedInstance);
            }
        }
    }, [robotLoadedInstance, onRobotLoaded, scale, initialPosition, selectedRobotName]);

    useEffect(() => {
        const robot = robotRef.current;
        if (!robot || !jointStates || (!jointStates.cmd && Object.keys(jointStates).length === 0)) {
            return;
        }

        const rotationAmount = 0.2; // Keep for manual commands
        const translationAmount = 0.1; // Keep for manual commands

        const getJointValue = (jointName) => {
            const joint = robot.joints[jointName];
            return joint ? (joint.angle || 0) : 0;
        };

        const applyJointMovement = (jointName, delta, minLimit = -Math.PI, maxLimit = Math.PI) => {
            const joint = robot.joints[jointName];
            if (joint) {
                let newValue = getJointValue(jointName) + delta;
                newValue = Math.max(minLimit, Math.min(maxLimit, newValue));
                joint.setJointValue(newValue);
                // console.log(`[UrdfRobotModel] Moved joint '${jointName}' to ${newValue.toFixed(3)} radians (delta: ${delta.toFixed(3)})`);
            } else {
                // console.warn(`[UrdfRobotModel] Joint '${jointName}' not found. Cannot apply movement.`);
            }
        };

        let robotType = 'unknown';
        if (Object.keys(robot.joints).some(name => name.includes('coxa_joint_r') || name.includes('femur_joint_r'))) {
            robotType = 'hexapod';
        } else if (Object.keys(robot.joints).some(name => name.includes('LLEG_JOINT') || name.includes('RLEG_JOINT') || name.includes('BODY'))) {
            robotType = 'humanoid';
        }

        // Apply direct joint states received from MediaPipe, overriding manual commands if they share joints
        // Only process 'cmd' if there are no direct joint states for a humanoid
        if (jointStates.cmd && robotType === 'hexapod') { // Manual commands for hexapod only
             switch (jointStates.cmd) {
                case 'left':
                    ['coxa_joint_r1', 'coxa_joint_r2', 'coxa_joint_r3'].forEach(jointName => {
                        if (robot.joints[jointName]) robot.joints[jointName].setJointValue(getJointValue(jointName) + rotationAmount);
                    });
                    ['coxa_joint_l1', 'coxa_joint_l2', 'coxa_joint_l3'].forEach(jointName => {
                        if (robot.joints[jointName]) robot.joints[jointName].setJointValue(getJointValue(jointName) - rotationAmount);
                    });
                    console.log("Hexapod: Attempting 'left' turn.");
                    break;
                case 'right':
                    ['coxa_joint_r1', 'coxa_joint_r2', 'coxa_joint_r3'].forEach(jointName => {
                        if (robot.joints[jointName]) robot.joints[jointName].setJointValue(getJointValue(jointName) - rotationAmount);
                    });
                    ['coxa_joint_l1', 'coxa_joint_l2', 'coxa_joint_l3'].forEach(jointName => {
                        if (robot.joints[jointName]) robot.joints[jointName].setJointValue(getJointValue(jointName) + rotationAmount);
                    });
                    console.log("Hexapod: Attempting 'right' turn.");
                    break;
                case 'jump':
                    const hexapodFemurJoints = [
                        'femur_joint_r1', 'femur_joint_r2', 'femur_joint_r3',
                        'femur_joint_l1', 'femur_joint_l2', 'femur_joint_l3'
                    ];
                    hexapodFemurJoints.forEach(jointName => {
                        if (robot.joints[jointName]) robot.joints[jointName].setJointValue(getJointValue(jointName) - rotationAmount);
                    });
                    setTimeout(() => {
                        hexapodFemurJoints.forEach(jointName => {
                            if (robot.joints[jointName]) robot.joints[jointName].setJointValue(getJointValue(jointName) + rotationAmount);
                        });
                    }, 300);
                    console.log("Hexapod: Attempting 'jump'.");
                    break;
                case 'forward':
                    robot.position.z -= translationAmount * 5;
                    console.log("Hexapod: Moving forward. New Z:", robot.position.z);
                    break;
                case 'backward':
                    robot.position.z += translationAmount * 5;
                    console.log("Hexapod: Moving backward. New Z:", robot.position.z);
                    break;
                case 'up':
                    robot.position.y += translationAmount * 5;
                    console.log("Hexapod: Moving up. New Y:", robot.position.y);
                    break;
                case 'down':
                    robot.position.y -= translationAmount * 5;
                    console.log("Hexapod: Moving down. New Y:", robot.position.y);
                    break;
                default:
                    console.log(`[UrdfRobotModel] Unhandled hexapod command: ${jointStates.cmd}`);
                    break;
            }
        }

        // Always apply specific joint values, which come from MediaPipe in the humanoid case
        for (const jointName in jointStates) {
            if (jointName !== 'cmd' && jointName !== 'timestamp') { // 'cmd' is for hexapod, 'timestamp' is metadata
                const targetAngle = jointStates[jointName];
                const urdfJoint = robot.joints[jointName];
                if (urdfJoint) {
                    if (typeof targetAngle === 'number' && !isNaN(targetAngle)) {
                        // Only update if the value has changed to avoid unnecessary re-renders
                        if (urdfJoint.angle !== targetAngle) {
                            urdfJoint.setJointValue(targetAngle);
                        }
                    } else {
                        console.warn(`[UrdfRobotModel][Direct] Invalid angle for ${jointName}:`, targetAngle);
                    }
                }
            }
        }
    }, [jointStates, robotLoadedInstance]);


    useEffect(() => {
        return () => {
            if (urdfContent && urdfContent.startsWith('blob:')) {
                try {
                    URL.revokeObjectURL(urdfContent);
                    console.log(`[UrdfRobotModel] Revoked URDF Blob URL (component unmount): ${urdfContent}`);
                } catch (e) {
                    // Ignore errors if URL was already revoked or invalid
                }
            }
        };
    }, [urdfContent]);


    if (!robotLoadedInstance) {
        return null;
    }

    return <primitive object={robotLoadedInstance} />;
};


/**
 * UrdfUploader component: Manages file uploads (URDF and meshes), displays camera feed,
 * and controls the uploaded robot via MediaPipe hand gestures.
 */
const UrdfUploader = () => {
    // File upload states
    const [urdfFile, setUrdfFile] = useState(null);
    const [meshFiles, setMeshFiles] = useState(new Map()); // Map: filename -> ArrayBuffer
    const [status, setStatus] = useState("Upload your URDF and mesh files.");
    const [robotLoadRequested, setRobotLoadRequested] = useState(false);

    const urdfInputRef = useRef(null);
    const meshesInputRef = useRef(null);

    // MediaPipe & Camera states and refs
    const videoRef = useRef(null); // Ref for the local video element
    const canvasRef = useRef(null); // Ref for the 2D canvas overlay
    const hands = useRef(null); // MediaPipe Hands instance
    const faceMeshRef = useRef(null); // MediaPipe FaceMesh instance (NEW REF)
    const cameraInstance = useRef(null); // MediaPipe Camera instance

    const [handLandmarks, setHandLandmarks] = useState(null); // Raw MediaPipe hand landmarks
    const [robotJointStates, setRobotJointStates] = useState({}); // Joint states for the robot
    const loadedRobotInstanceRef = useRef(null); // Ref to hold the actual Three.js robot object
    const [cameraUpdateTrigger, setCameraUpdateTrigger] = useState(0); // To force CameraUpdater re-run

    // Callback to get the loaded robot instance from UrdfRobotModel
    // Moved this declaration earlier in the component to avoid ReferenceError
    const handleUrdfRobotLoaded = useCallback((robotObject) => {
        console.log("[UrdfUploader] UrdfRobotModel reported robot loaded:", robotObject);
        loadedRobotInstanceRef.current = robotObject;
        setCameraUpdateTrigger(prev => prev + 1);
    }, []);

    // Memoized Blob URL for URDF content
    const urdfContentBlobUrl = useMemo(() => {
        if (urdfFile) {
            return URL.createObjectURL(urdfFile);
        }
        return null;
    }, [urdfFile]);

    // Memoized fileMap for model (contains Blob URLs for meshes)
    const fileMapForModel = useMemo(() => {
        const obj = {};
        if (meshFiles) {
            meshFiles.forEach((arrayBuffer, filename) => {
                obj[filename] = URL.createObjectURL(new Blob([arrayBuffer]));
            });
        }
        return obj;
    }, [meshFiles]);

    // Cleanup Blob URLs created for mesh files when component unmounts or meshFiles change
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


    // --- MediaPipe Hand Landmark Processing and Gesture-to-Joint Mapping ---
    const onResults = useCallback((results) => {
        const canvasElement = canvasRef.current;
        const videoElement = videoRef.current;
        const canvasCtx = canvasElement?.getContext('2d');

        if (!canvasCtx || !videoElement) {
            console.warn("Canvas or video element not ready for drawing.");
            return;
        }

        // Clear the canvas
        canvasCtx.save();
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

        // Draw the mirrored video feed onto the canvas
        // This is crucial for matching landmark coordinates if the video is mirrored.
        canvasCtx.translate(canvasElement.width, 0);
        canvasCtx.scale(-1, 1);
        canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
        canvasCtx.restore(); // Restore to apply transformations only to drawing, not canvas state

        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            const landmarks = results.multiHandLandmarks[0];
            setHandLandmarks(landmarks); // Store raw landmarks for potential debug or other use

            // Draw hand landmarks and connections
            drawConnectors(canvasCtx, landmarks, Hands.HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 5 });
            drawLandmarks(canvasCtx, landmarks, { color: '#FF0000', lineWidth: 2 });

            if (!loadedRobotInstanceRef.current) {
                // console.warn("[UrdfUploader] Robot not yet loaded or recognized for gesture control.");
                return;
            }

            const robot = loadedRobotInstanceRef.current;
            const newJoints = {};
            const JOINT_MAX_RANGE_HEAD_YAW = Math.PI / 2; // Max 45 degrees left/right
            const JOINT_MIN_RANGE_HEAD_YAW = -Math.PI / 2;
            const JOINT_MAX_RANGE_HEAD_PITCH = Math.PI / 2; // Max 30 degrees up/down
            const JOINT_MIN_RANGE_HEAD_PITCH = -Math.PI / 2;

            const JOINT_MAX_RANGE_ARM_SWING = Math.PI / 2; // Max 90 degrees shoulder swing
            const JOINT_MIN_RANGE_ARM_SWING = -Math.PI / 2;
            const JOINT_MAX_RANGE_ARM_ROLL = Math.PI ;
            const JOINT_MIN_RANGE_ARM_ROLL = -Math.PI ;
            const JOINT_MAX_RANGE_ARM_PITCH = Math.PI ;
            const JOINT_MIN_RANGE_ARM_PITCH = -Math.PI ;

            const FINGER_JOINT_RANGE = 1.0; // Assuming a 0-1 range for fingers for simplicity

            const distance = (p1, p2) => Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2) + Math.pow(p2.z - p1.z, 2));
            const mapRange = (value, inMin, inMax, outMin, outMax) => {
                const clampedValue = Math.max(inMin, Math.min(value, inMax));
                return (clampedValue - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
            };

            // Assuming a single hand for control. Typically right hand for right arm, left for left.
            // For now, let's use the first detected hand to control both if only one is present,
            // or consider it the 'right hand' if only one.
            const wrist = landmarks[0]; // Landmark 0 is the wrist
            const thumbTip = landmarks[4];
            const indexTip = landmarks[8];
            const middleTip = landmarks[12];
            const pinkyTip = landmarks[20];

            // --- HEAD MOVEMENT ---
            if (results.faceLandmarks && results.faceLandmarks.length > 0) {
                        anyLandmarksDetected = true;
                        const faceLandmarks = results.faceLandmarks[0]; // Get the first detected face
            
                        // Draw face mesh connections for visualization
                        drawConnectors(canvasCtx, faceLandmarks, FaceMesh.FACEMESH_TESSELATION, { color: '#C0C0C070', lineWidth: 1 });
                        drawConnectors(canvasCtx, faceLandmarks, FaceMesh.FACEMESH_CONTOURS, { color: '#00FF00', lineWidth: 2 });
                        // drawLandmarks(canvasCtx, faceLandmarks, { color: '#FF0000', lineWidth: 2 }); // Optionally draw individual landmarks
            
                        // Landmark 1 is typically the nose tip in FaceMesh.
                        // We use its X position for yaw (left/right) and Y position for pitch (up/down).
                        const noseTip = faceLandmarks[1];
            
                        if (robot.joints['HEAD_JOINT0'] && robot.joints['HEAD_JOINT1'] && noseTip) {
                            // Map X position (left-right) to head yaw
                            // The input range (0.3 to 0.7) can be adjusted for sensitivity
                            const headYaw = mapRange(noseTip.x, 0.3, 0.7, JOINT_MAX_RANGE_HEAD_YAW, JOINT_MIN_RANGE_HEAD_YAW);
                            // Map Y position (up-down) to head pitch
                            const headPitch = mapRange(noseTip.y, 0.3, 0.7, JOINT_MAX_RANGE_HEAD_PITCH, JOINT_MIN_RANGE_HEAD_PITCH);
            
                            newJoints['HEAD_JOINT0'] = headYaw;
                            newJoints['HEAD_JOINT1'] = headPitch;
                        }
                    }

            // --- ARM MOVEMENT (JAXON JVRC has LARM_JOINT0, LARM_JOINT1, RARM_JOINT0, RARM_JOINT1) ---
            // LARM_JOINT0: Shoulder Roll (side-to-side, out-in)
            // LARM_JOINT1: Shoulder Pitch (forward-back, up-down)
            // Using wrist X for shoulder roll and wrist Y for shoulder pitch.
            // The depth (Z) can be used for arm extension if applicable, but for simple rotation, X/Y are easier.

            if (robot.joints['LARM_JOINT0'] && robot.joints['RARM_JOINT0'] && robot.joints['LARM_JOINT1'] && robot.joints['RARM_JOINT1'] && wrist) {
                // Map wrist X to shoulder roll (LARM_JOINT0 and RARM_JOINT0)
                // If wrist moves left (smaller X), left arm goes out (positive angle), right arm goes in (negative angle)
                const armRollValue = mapRange(wrist.x, 0.2, 0.8, JOINT_MAX_RANGE_ARM_ROLL, JOINT_MIN_RANGE_ARM_ROLL);
                newJoints['LARM_JOINT0'] = armRollValue;
                newJoints['RARM_JOINT0'] = -armRollValue; // Invert for the right arm

                // Map wrist Y to shoulder pitch (LARM_JOINT1 and RARM_JOINT1)
                // If wrist moves up (smaller Y), arms go up (negative angle for pitch)
                const armPitchValue = mapRange(wrist.y, 0.2, 0.8, JOINT_MAX_RANGE_ARM_PITCH, JOINT_MIN_RANGE_ARM_PITCH);
                newJoints['LARM_JOINT1'] = armPitchValue;
                newJoints['RARM_JOINT1'] = armPitchValue;
            }

            // --- FINGER MOVEMENT (Revisiting the original logic for clarity) ---
            if (thumbTip && indexTip && middleTip && pinkyTip) {
                // Simplified "grasp" gesture: when thumb is close to index/middle/ring/pinky.
                // We'll use a single value to control all fingers for simplicity.
                // Distance between thumb tip (4) and index finger base (5) or index tip (8)
                const thumbIndexProximalDistance = distance(landmarks[4], landmarks[5]); // Thumb tip to index base
                // const indexPinkyDistance = distance(landmarks[8], landmarks[20]); // Index tip to pinky tip // Not used for this simple logic

                // Heuristic for open/close: if thumb-index distance is large, open. If small, closed.
                // Adjust these thresholds based on your hand size and gesture style.
                const openThreshold = 0.1; // If thumb-index distance > this, likely open
                const closedThreshold = 0.04; // If thumb-index distance < this, likely closed

                let fingerAngle = 0;

                if (thumbIndexProximalDistance > openThreshold) {
                    // Fully open
                    fingerAngle = 0;
                } else if (thumbIndexProximalDistance < closedThreshold) {
                    // Fully closed
                    fingerAngle = FINGER_JOINT_RANGE;
                } else {
                    // In between, interpolate
                    fingerAngle = mapRange(thumbIndexProximalDistance, closedThreshold, openThreshold, FINGER_JOINT_RANGE, 0);
                }

                if (robot.joints['LARM_F_JOINT0'] && robot.joints['LARM_F_JOINT1']) {
                    newJoints['LARM_F_JOINT0'] = fingerAngle; // Main finger joint
                    newJoints['LARM_F_JOINT1'] = fingerAngle; // Another finger joint if available
                }
                if (robot.joints['RARM_F_JOINT0'] && robot.joints['RARM_F_JOINT1']) {
                    newJoints['RARM_F_JOINT0'] = fingerAngle;
                    newJoints['RARM_F_JOINT1'] = fingerAngle;
                }
            }


            // --- CHASSIS/BODY MOVEMENT (Can be controlled by the hand's overall position relative to center) ---
            // If you want to move the chest by shifting your hand, for example:
            if (robot.joints['CHEST_JOINT0'] && robot.joints['CHEST_JOINT1'] && wrist) {
                // Map wrist X to chest yaw (side-to-side body lean)
                const chestYaw = mapRange(wrist.x, 0.2, 0.8, JOINT_MAX_RANGE_HEAD_YAW * 0.5, JOINT_MIN_RANGE_HEAD_YAW * 0.5); // Less sensitive than head
                // Map wrist Y to chest pitch (forward-backward body lean)
                const chestPitch = mapRange(wrist.y, 0.2, 0.8, JOINT_MAX_RANGE_HEAD_PITCH * 0.5, JOINT_MIN_RANGE_HEAD_PITCH * 0.5);

                newJoints['CHEST_JOINT0'] = chestYaw;
                newJoints['CHEST_JOINT1'] = chestPitch;
            }

            setRobotJointStates(prev => ({ ...prev, ...newJoints, timestamp: Date.now() }));

        } else {
            setHandLandmarks(null);
            // Clear canvas if no hands are detected
            if (canvasCtx) {
                canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
            }
        }
    }, [loadedRobotInstanceRef]); // Only re-create if loadedRobotInstanceRef changes

    // Setup Camera and MediaPipe Hands
    const setupMediaPipe = useCallback(() => {
        const videoElement = videoRef.current;
        const canvasElement = canvasRef.current; // Get canvas element here
        if (!videoElement || !canvasElement) { // Check for canvas too
            setStatus("Video or canvas element not found. Retrying setup...");
            return;
        }

        // Set canvas dimensions to match video
        canvasElement.width = videoElement.videoWidth || 640;
        canvasElement.height = videoElement.videoHeight || 480;

        // Initialize MediaPipe Hands
        hands.current = new Hands({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });
        hands.current.setOptions({
            maxNumHands: 1, // Focus on single hand for now to simplify control
            modelComplexity: 1,
            minDetectionConfidence: 0.7,
            minTrackingConfidence: 0.6
        });
        hands.current.onResults(onResults);
    
        faceMeshRef.current = new FaceMesh({ // Assign to ref
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
            }
        });
        faceMeshRef.current.setOptions({
            maxNumFaces: 1, // Only track one face for head control
            refineLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });
        faceMeshRef.current.onResults(onResults);

        // Setup Camera Stream
        cameraInstance.current = new Camera(videoElement, {
            onFrame: async () => {
                // FIX: Add null check for hands.current before sending image
                if (videoElement.readyState === 4 && hands.current) {
                    await hands.current.send({ image: videoElement });
                }
            },
            width: 640,
            height: 480
        });

        cameraInstance.current.start()
            .then(() => {
                setStatus("Camera started. Move your hand!");
                console.log("[UrdfUploader] MediaPipe Camera started.");
            })
            .catch(err => {
                setStatus(`Camera error: ${err.message}`);
                console.error("[UrdfUploader] Failed to start camera:", err);
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
    }, [onResults]); // setupMediaPipe depends on onResults, so it needs to be in dependency array.

    // Effect to manage MediaPipe lifecycle
    useEffect(() => {
        setupMediaPipe();

        return () => {
            console.log("[UrdfUploader] Cleaning up MediaPipe and Camera.");
            if (cameraInstance.current) {
                cameraInstance.current.stop();
                cameraInstance.current = null;
            }
            if (hands.current) {
                hands.current.close();
                hands.current = null;
            }
        };
    }, [setupMediaPipe]); // Depend on setupMediaPipe

    // --- File Upload Handlers ---
    const handleUrdfFileChange = (e) => {
        const file = e.target.files[0];
        if (file && (file.name.toLowerCase().endsWith('.urdf') || file.name.toLowerCase().endsWith('.xml'))) {
            setUrdfFile(file);
            setStatus(`URDF file selected: ${file.name}`);
            setRobotLoadRequested(false);
        } else {
            setUrdfFile(null);
            setStatus("Please select a .urdf or .xml file.");
            setRobotLoadRequested(false);
        }
    };

    const handleMeshFilesChange = (e) => {
        const files = Array.from(e.target.files);
        const newMeshMap = new Map();
        const readPromises = files.map(file => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (event) => {
                    newMeshMap.set(file.name, event.target.result);
                    console.log(`[UrdfUploader] Stored mesh in map: "${file.name}"`);
                    resolve();
                };
                reader.onerror = (event) => {
                    console.error(`[UrdfUploader] Error reading file "${file.name}":`, event.target.error);
                    reject(event.target.error);
                };
                reader.readAsArrayBuffer(file);
            });
        });

        Promise.all(readPromises)
            .then(() => {
                setMeshFiles(newMeshMap);
                setStatus(`Selected ${files.length} mesh files.`);
                console.log(`[UrdfUploader] All mesh files processed. Final Map keys:`, Array.from(newMeshMap.keys()));
                setRobotLoadRequested(false);
            })
            .catch(error => {
                setStatus(`Error reading some mesh files: ${error.message}`);
                setMeshFiles(new Map());
                setRobotLoadRequested(false);
                console.error("[UrdfUploader] Error during mesh file processing:", error);
            });
    };

    const handleDrop = useCallback((e, type) => {
        e.preventDefault();
        e.stopPropagation();
        e.target.classList.remove('border-blue-500', 'bg-blue-900');

        const files = Array.from(e.dataTransfer.files);

        if (type === 'urdf') {
            const urdf = files.find(f => f.name.toLowerCase().endsWith('.urdf') || f.name.toLowerCase().endsWith('.xml'));
            if (urdf) {
                setUrdfFile(urdf);
                setStatus(`URDF file dropped: ${urdf.name}`);
                setRobotLoadRequested(false);
            } else {
                setStatus("Dropped file is not a .urdf or .xml file.");
                setUrdfFile(null);
                setRobotLoadRequested(false);
            }
        } else if (type === 'meshes') {
            const meshFilesDropped = files.filter(f => f.name.toLowerCase().match(/\.(stl|obj|dae|gltf|glb)$/));
            if (meshFilesDropped.length > 0) {
                 const newMeshMap = new Map();
                 const readPromises = meshFilesDropped.map(file => {
                    return new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                            newMeshMap.set(file.name, event.target.result);
                            console.log(`[UrdfUploader] Stored dropped mesh: "${file.name}"`);
                            resolve();
                        };
                        reader.onerror = (event) => {
                            console.error(`[UrdfUploader] Error reading dropped file "${file.name}":`, event.target.error);
                            reject(event.target.error);
                        };
                        reader.readAsArrayBuffer(file);
                    });
                });

                Promise.all(readPromises)
                    .then(() => {
                        setMeshFiles(newMeshMap);
                        setStatus(`Dropped ${meshFilesDropped.length} mesh files.`);
                        console.log(`[UrdfUploader] All dropped mesh files processed. Final Map keys:`, Array.from(newMeshMap.keys()));
                        setRobotLoadRequested(false);
                    })
                    .catch(error => {
                        setStatus(`Error reading some dropped mesh files: ${error.message}`);
                        setMeshFiles(new Map());
                        setRobotLoadRequested(false);
                        console.error("[UrdfUploader] Error during dropped mesh file processing:", error);
                    });

            } else {
                setStatus("No valid mesh files (.obj, .stl, .dae, .gltf, .glb) dropped.");
                setMeshFiles(new Map());
                setRobotLoadRequested(false);
            }
        }
    }, []);

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.target.classList.add('border-blue-500', 'bg-blue-900');
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.target.classList.remove('border-blue-500', 'bg-blue-900');
    };

    const handleLoadRobot = () => {
        if (!urdfFile) {
            setStatus("Please upload a URDF file first.");
            return;
        }
        if (meshFiles.size === 0) {
            setStatus("Please upload the associated mesh files.");
            return;
        }
        setStatus("Loading robot...");
        setRobotLoadRequested(true);
    };

    const handleClearFiles = () => {
        setUrdfFile(null);
        setMeshFiles(new Map());
        setRobotLoadRequested(false);
        setStatus("Files cleared. Ready for new uploads.");
        if (urdfInputRef.current) urdfInputRef.current.value = '';
        if (meshesInputRef.current) meshesInputRef.current.value = '';
    };

    // This function is not used in the current setup, but was present in original
    // const getUrdfBasePath = () => {
    //     return '/';
    // };


    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-700 flex flex-col items-center justify-center p-4 sm:p-6 font-inter text-white">
            <div className="bg-gray-800 p-6 sm:p-8 rounded-xl shadow-2xl w-full max-w-4xl text-center border border-gray-700 mb-8">
                <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-6 tracking-tight">
                    Upload & View URDF Robot
                </h2>
                <p className={`text-lg mb-6 py-2 px-4 rounded-lg
                    ${status.includes('Error') ? 'bg-red-600' : status.includes('Loading') ? 'bg-blue-600' : 'bg-green-600'}
                    text-white font-semibold shadow-md`}
                >
                    Status: <span className="font-mono">{status}</span>
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    {/* URDF File Upload */}
                    <div
                        className="border-2 border-dashed border-gray-600 rounded-lg p-6 bg-gray-700 text-gray-300 hover:border-blue-500 hover:bg-gray-900 transition-all duration-200 cursor-pointer"
                        onDrop={(e) => handleDrop(e, 'urdf')}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onClick={() => urdfInputRef.current.click()}
                    >
                        <p className="text-xl mb-2">Drag & Drop URDF File Here</p>
                        <p className="text-sm">(or click to select) - .urdf or .xml</p>
                        <input
                            type="file"
                            accept=".urdf,.xml"
                            onChange={handleUrdfFileChange}
                            ref={urdfInputRef}
                            className="hidden"
                        />
                        {urdfFile && (
                            <p className="mt-2 text-blue-300 font-medium">Selected: {urdfFile.name}</p>
                        )}
                    </div>

                    {/* Mesh Files Upload */}
                    <div
                        className="border-2 border-dashed border-gray-600 rounded-lg p-6 bg-gray-700 text-gray-300 hover:border-blue-500 hover:bg-gray-900 transition-all duration-200 cursor-pointer"
                        onDrop={(e) => handleDrop(e, 'meshes')}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onClick={() => meshesInputRef.current.click()}
                    >
                        <p className="text-xl mb-2">Drag & Drop Mesh Files Here</p>
                        <p className="text-sm">(e.g., .obj, .stl, .dae, .gltf, .glb - multiple files allowed)</p>
                        <input
                            type="file"
                            accept=".obj,.stl,.dae,.gltf,.glb"
                            multiple
                            onChange={handleMeshFilesChange}
                            ref={meshesInputRef}
                            className="hidden"
                        />
                        {meshFiles.size > 0 && (
                            <p className="mt-2 text-blue-300 font-medium">Selected: {meshFiles.size} files</p>
                        )}
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-center gap-4">
                    <button
                        onClick={handleLoadRobot}
                        disabled={!urdfFile || meshFiles.size === 0}
                        className="py-3 px-8 rounded-lg text-lg font-semibold bg-indigo-600 text-white shadow-lg transition duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Load Robot
                    </button>
                    <button
                        onClick={handleClearFiles}
                        className="py-3 px-8 rounded-lg text-lg font-semibold bg-gray-600 text-white shadow-lg transition duration-300 ease-in-out hover:bg-gray-700 transform hover:scale-105"
                    >
                        Clear Files
                    </button>
                </div>
            </div>

            {/* Camera and Robot Display Area */}
            <div className="flex flex-col md:flex-row gap-4 w-full max-w-4xl">
                {/* Camera Feed */}
                <div className="relative w-full md:w-1/2 aspect-video bg-gray-700 rounded-lg overflow-hidden shadow-inner border border-gray-600">
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover transform scaleX(-1)" // Mirror the video
                    />
                    {/* Add a canvas overlay for drawing landmarks */}
                    <canvas
                        ref={canvasRef}
                        className="absolute top-0 left-0 w-full h-full"
                        style={{ transform: 'scaleX(-1)' }} // Mirror the canvas drawing as well
                    />
                    <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white text-sm px-2 py-1 rounded">
                        Your Camera Feed
                    </div>
                    {/* Removed handLandmarks conditional rendering for hand emoji as we are drawing dots */}
                </div>

                {/* URDF Robot Display */}
                {robotLoadRequested && urdfFile && meshFiles.size > 0 ? (
                    <div className="w-full md:w-1/2 aspect-[4/3] h-[600px] bg-gray-700 rounded-lg overflow-hidden shadow-inner border border-gray-600">
                        <Canvas
                            camera={{ position: [0, 1.5, 3], fov: 50 }} // Use suggested fixed camera position
                        >
                            <ambientLight intensity={0.8} />
                            <directionalLight position={[2, 5, 2]} intensity={1} />
                            <directionalLight position={[-2, -5, -2]} intensity={0.5} />
                            <Environment preset="studio" />
                            <Suspense fallback={<Text color="white" anchorX="center" anchorY="middle">Loading Robot Model...</Text>}>
                                <UrdfRobotModel
                                    urdfContent={urdfContentBlobUrl}
                                    fileMap={fileMapForModel}
                                    jointStates={robotJointStates}
                                    onRobotLoaded={handleUrdfRobotLoaded}
                                    selectedRobotName="jaxon_jvrc" // Assuming JAXON for hand control
                                    scale={0.001} // Scale for JAXON JVRC
                                    initialPosition={[0, -1, 0]} // Position for JAXON JVRC
                                />
                            </Suspense>
                            <CameraUpdater
                                loadedRobotInstanceRef={loadedRobotInstanceRef}
                                triggerUpdate={cameraUpdateTrigger}
                            />
                        </Canvas>
                    </div>
                ) : (
                    <div className="w-full md:w-1/2 aspect-[4/3] h-[600px] bg-gray-700 rounded-lg overflow-hidden shadow-inner border border-gray-600 flex items-center justify-center text-gray-400 text-xl">
                        {urdfFile && meshFiles.size > 0 ? "Click 'Load Robot' to view." : "Upload URDF and mesh files to begin."}
                    </div>
                )}
            </div>
            <p className="mt-4 text-gray-400">
                Move your hand in front of the camera to control the robot's head, arms, and fingers.
            </p>
        </div>
    );
};

export default UrdfUploader;