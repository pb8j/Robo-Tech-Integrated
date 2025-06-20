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
import { Camera } from '@mediapipe/camera_utils';


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

            // Calculate a suitable camera distance based on the robot's size
            const maxDim = Math.max(size.x, size.y, size.z);
            const fov = camera.fov * (Math.PI / 180);
            let cameraDistance = maxDim / (2 * Math.tan(fov / 2));
            cameraDistance *= 1.8; // Adjust multiplier for desired distance

            // Set camera position to view the robot from its "front" relative to its bounding box center
            // Assuming robot's front is along -Z or +Z axis, and positive X is right, positive Y is up.
            // We want to be at X=center.x, Y=center.y + (some height), Z=center.z + cameraDistance
            // This places the camera directly in front of the robot (looking towards -Z by default)
            // You might need to experiment with +/- Z, X, Y components based on your specific URDF's orientation.
            camera.position.set(center.x, center.y + size.y / 2 + (maxDim * 0.5), center.z + cameraDistance); // Adjusted Y for better overhead view if needed
            camera.lookAt(center); // Always look at the center of the robot

            // Update OrbitControls target to the robot's center
            orbitControlsRef.current.target.copy(center);
            orbitControlsRef.current.update();

            // Adjust camera frustum
            camera.far = cameraDistance * 3;
            camera.near = 0.001;
            camera.updateProjectionMatrix();

            console.log("[CameraUpdater] Camera adjusted. Position:", camera.position, "Target:", orbitControlsRef.current.target);
        }
    }, [loadedRobotInstanceRef, triggerUpdate, camera]);

    return <OrbitControls ref={orbitControlsRef} />;
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
 * UrdfRobotModel component handles loading and displaying a URDF robot model.
 * It uses a custom file loader with a URL modifier to resolve mesh paths from an in-memory file map.
 * It also applies joint states for animation.
 * This component is inlined for direct use within UrdfUploader.
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
            robotLoadedInstance.scale.set(scale, scale, scale);
            robotLoadedInstance.position.set(...initialPosition);

            if (onRobotLoaded) {
                onRobotLoaded(robotLoadedInstance);
            }
        }
    }, [robotLoadedInstance, onRobotLoaded, scale, initialPosition]);

    useEffect(() => {
        const robot = robotRef.current;
        if (!robot || !jointStates || (!jointStates.cmd && Object.keys(jointStates).length === 0)) {
            return;
        }

        const rotationAmount = 0.2;
        const translationAmount = 0.1;

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
                console.log(`[UrdfRobotModel] Moved joint '${jointName}' to ${newValue.toFixed(3)} radians (delta: ${delta.toFixed(3)})`);
            } else {
                console.warn(`[UrdfRobotModel] Joint '${jointName}' not found. Cannot apply movement.`);
            }
        };

        let robotType = 'unknown';
        if (Object.keys(robot.joints).some(name => name.includes('coxa_joint_r') || name.includes('femur_joint_r'))) {
            robotType = 'hexapod';
        } else if (Object.keys(robot.joints).some(name => name.includes('LLEG_JOINT') || name.includes('RLEG_JOINT') || name.includes('BODY'))) {
            robotType = 'humanoid';
        }

        if (jointStates.cmd) {
            if (robotType === 'hexapod') {
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
            } else if (robotType === 'humanoid') { // JAXON JVRC or similar
                console.log(`[UrdfRobotModel] JAXON JVRC: Processing command: ${jointStates.cmd}`);

                const JOINT_MAX_RANGE = Math.PI / 2;
                const JOINT_MIN_RANGE = -Math.PI / 2;

                switch (jointStates.cmd) {
                    case 'left':
                        applyJointMovement('CHEST_JOINT0', rotationAmount, -1.0, 1.0); // Yaw
                        applyJointMovement('LARM_JOINT0', rotationAmount, -1.5, 1.5); // L shoulder roll
                        applyJointMovement('RARM_JOINT0', -rotationAmount, -1.5, 1.5); // R shoulder roll
                        break;
                    case 'right':
                        applyJointMovement('CHEST_JOINT0', -rotationAmount, -1.0, 1.0); // Yaw
                        applyJointMovement('LARM_JOINT0', -rotationAmount, -1.5, 1.5); // L shoulder roll
                        applyJointMovement('RARM_JOINT0', rotationAmount, -1.5, 1.5); // R shoulder roll
                        break;
                    case 'up':
                        applyJointMovement('LARM_JOINT1', -rotationAmount, -3.14, 3.14);
                        applyJointMovement('RARM_JOINT1', -rotationAmount, -3.14, 3.14);
                        applyJointMovement('CHEST_JOINT1', rotationAmount, -0.5, 0.7);
                        applyJointMovement('HEAD_JOINT1', rotationAmount, -0.6, 0.7);
                        break;
                    case 'down':
                        applyJointMovement('LARM_JOINT1', rotationAmount, -3.14, 3.14);
                        applyJointMovement('RARM_JOINT1', rotationAmount, -3.14, 3.14);
                        applyJointMovement('CHEST_JOINT1', -rotationAmount, -0.5, 0.7);
                        applyJointMovement('HEAD_JOINT1', -rotationAmount, -0.6, 0.7);
                        break;
                    case 'jump':
                        robot.position.y += translationAmount * 5;
                        console.log("JAXON JVRC: Attempting 'jump' (body lift). New Y:", robot.position.y);
                        setTimeout(() => {
                            robot.position.y -= translationAmount * 5;
                        }, 300);
                        break;
                    case 'open_fingers_l':
                        applyJointMovement('LARM_F_JOINT0', rotationAmount, -1.5, 1.5);
                        applyJointMovement('LARM_F_JOINT1', rotationAmount, -1.5, 1.5);
                        break;
                    case 'close_fingers_l':
                        applyJointMovement('LARM_F_JOINT0', -rotationAmount, -1.5, 1.5);
                        applyJointMovement('LARM_F_JOINT1', -rotationAmount, -1.5, 1.5);
                        break;
                    case 'open_fingers_r':
                        applyJointMovement('RARM_F_JOINT0', rotationAmount, -1.5, 1.5);
                        applyJointMovement('RARM_F_JOINT1', rotationAmount, -1.5, 1.5);
                        break;
                    case 'close_fingers_r':
                        applyJointMovement('RARM_F_JOINT0', -rotationAmount, -1.5, 1.5);
                        applyJointMovement('RARM_F_JOINT1', -rotationAmount, -1.5, 1.5);
                        break;
                    default:
                        console.log(`[UrdfRobotModel] Unhandled humanoid command: ${jointStates.cmd}`);
                        break;
                }
            } else {
                console.log(`[UrdfRobotModel] Command '${jointStates.cmd}' ignored for unknown robot type.`);
            }
        }

        for (const jointName in jointStates) {
            if (jointName !== 'cmd' && jointName !== 'timestamp') {
                const targetAngle = jointStates[jointName];
                const urdfJoint = robot.joints[jointName];
                if (urdfJoint) {
                    if (typeof targetAngle === 'number' && !isNaN(targetAngle)) {
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
    const hands = useRef(null); // MediaPipe Hands instance
    const cameraInstance = useRef(null); // MediaPipe Camera instance

    const [handLandmarks, setHandLandmarks] = useState(null); // Raw MediaPipe hand landmarks
    const [robotJointStates, setRobotJointStates] = useState({}); // Joint states for the robot
    const loadedRobotInstanceRef = useRef(null); // Ref to hold the actual Three.js robot object
    const [cameraUpdateTrigger, setCameraUpdateTrigger] = useState(0); // To force CameraUpdater re-run

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
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            const landmarks = results.multiHandLandmarks[0];
            setHandLandmarks(landmarks);

            if (!loadedRobotInstanceRef.current) {
                console.warn("[UrdfUploader] Robot not yet loaded or recognized for gesture control.");
                return;
            }

            const robot = loadedRobotInstanceRef.current;
            const newJoints = {};
            const JOINT_MAX_RANGE = Math.PI / 2;
            const JOINT_MIN_RANGE = -Math.PI / 2;

            const distance = (p1, p2) => Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2) + Math.pow(p2.z - p1.z, 2));
            const mapRange = (value, inMin, inMax, outMin, outMax) => {
                const clampedValue = Math.max(inMin, Math.min(value, inMax));
                return (clampedValue - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
            };

            // HEAD MOVEMENT
            if (robot.joints['HEAD_JOINT0'] && robot.joints['HEAD_JOINT1'] && landmarks[0]) {
                const headYaw = mapRange(landmarks[0].x, 0, 1, JOINT_MAX_RANGE, JOINT_MIN_RANGE);
                const headPitch = mapRange(landmarks[0].y, 0, 1, JOINT_MAX_RANGE, JOINT_MIN_RANGE);
                newJoints['HEAD_JOINT0'] = headYaw;
                newJoints['HEAD_JOINT1'] = headPitch;
            }

            // ARM MOVEMENT (Shoulder Pitch/Extension)
            if (robot.joints['LARM_JOINT1'] && robot.joints['RARM_JOINT1'] && landmarks[0]) {
                const armPitchValue = mapRange(landmarks[0].z, -0.2, 0.2, JOINT_MAX_RANGE, JOINT_MIN_RANGE);
                newJoints['LARM_JOINT1'] = armPitchValue;
                newJoints['RARM_JOINT1'] = armPitchValue;
            }

            // SHOULDER ROLL / ARM OUT-IN
            if (robot.joints['LARM_JOINT0'] && robot.joints['RARM_JOINT0'] && landmarks[0]) {
                const armRollValue = mapRange(landmarks[0].x, 0, 1, -JOINT_MAX_RANGE, JOINT_MAX_RANGE);
                newJoints['LARM_JOINT0'] = armRollValue;
                newJoints['RARM_JOINT0'] = -armRollValue;
            }

            // FINGER MOVEMENT
            const thumbTip = landmarks[4];
            const indexTip = landmarks[8];
            const middleTip = landmarks[12];
            if (thumbTip && indexTip && middleTip && robot.joints['LARM_F_JOINT0'] && robot.joints['LARM_F_JOINT1']) {
                const thumbIndexDistance = distance(thumbTip, indexTip);
                const thumbMiddleDistance = distance(thumbTip, middleTip);

                const isOpen = thumbIndexDistance > 0.08 && thumbMiddleDistance > 0.08;
                const isClosed = thumbIndexDistance < 0.04 && thumbMiddleDistance < 0.04;

                let fingerAngle = 0;
                if (isOpen) {
                    fingerAngle = mapRange(thumbIndexDistance, 0.08, 0.15, 0, 1.0);
                } else if (isClosed) {
                    fingerAngle = mapRange(thumbIndexDistance, 0.03, 0.06, 1.0, 0);
                }
                fingerAngle = Math.max(0, Math.min(fingerAngle, 1.0));

                newJoints['LARM_F_JOINT0'] = fingerAngle;
                newJoints['LARM_F_JOINT1'] = fingerAngle;
                if (robot.joints['RARM_F_JOINT0'] && robot.joints['RARM_F_JOINT1']) {
                    newJoints['RARM_F_JOINT0'] = fingerAngle;
                    newJoints['RARM_F_JOINT1'] = fingerAngle;
                }
            }

            // CHASSIS/BODY MOVEMENT
            if (robot.joints['CHEST_JOINT0'] && robot.joints['CHEST_JOINT1'] && landmarks[0]) {
                 const chestYaw = mapRange(landmarks[0].x, 0, 1, JOINT_MAX_RANGE, JOINT_MIN_RANGE);
                 const chestPitch = mapRange(landmarks[0].y, 0, 1, JOINT_MAX_RANGE, JOINT_MIN_RANGE);
                 newJoints['CHEST_JOINT0'] = chestYaw * 0.3;
                 newJoints['CHEST_JOINT1'] = chestPitch * 0.3;
            }

            setRobotJointStates(prev => ({ ...prev, ...newJoints, timestamp: Date.now() }));

        } else {
            setHandLandmarks(null);
        }
    }, [loadedRobotInstanceRef]);

    // Setup Camera and MediaPipe Hands
    const setupMediaPipe = useCallback(() => {
        const videoElement = videoRef.current;
        if (!videoElement) {
            setStatus("Video element not found. Retrying setup...");
            return;
        }

        // Initialize MediaPipe Hands
        hands.current = new Hands({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });
        hands.current.setOptions({
            maxNumHands: 1,
            modelComplexity: 1,
            minDetectionConfidence: 0.7,
            minTrackingConfidence: 0.6
        });
        hands.current.onResults(onResults);

        // Setup Camera Stream
        cameraInstance.current = new Camera(videoElement, {
            onFrame: async () => {
                if (videoElement.readyState === 4) {
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
    }, [onResults]);

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
    }, [setupMediaPipe]);

    // Callback to get the loaded robot instance from UrdfRobotModel
    const handleUrdfRobotLoaded = useCallback((robotObject) => {
        console.log("[UrdfUploader] UrdfRobotModel reported robot loaded:", robotObject);
        loadedRobotInstanceRef.current = robotObject;
        setCameraUpdateTrigger(prev => prev + 1);
    }, []);


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
                    // Store the ArrayBuffer as the value.
                    // Key is the original filename.
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

    const getUrdfBasePath = () => {
        return '/';
    };


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
                    <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white text-sm px-2 py-1 rounded">
                        Your Camera Feed
                    </div>
                    {handLandmarks && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-green-400 text-5xl animate-pulse">✋</span>
                        </div>
                    )}
                </div>

                {/* URDF Robot Display */}
                {robotLoadRequested && urdfFile && meshFiles.size > 0 ? (
                    <div className="w-full md:w-1/2 aspect-[4/3] h-[600px] bg-gray-700 rounded-lg overflow-hidden shadow-inner border border-gray-600"> {/* Increased height */}
                        <Canvas camera={{ position: [1, 1, 1], fov: 75 }}>
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
                    <div className="w-full md:w-1/2 aspect-[4/3] h-[600px] bg-gray-700 rounded-lg overflow-hidden shadow-inner border border-gray-600 flex items-center justify-center text-gray-400 text-xl"> {/* Increased height */}
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