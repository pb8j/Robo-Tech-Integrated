// src/components/UrdfRobotModel.jsx
import React, { useEffect, Suspense } from "react";
import { Canvas, useLoader } from "@react-three/fiber";
import URDFLoader from 'urdf-loader';
import { OrbitControls, Environment, Text } from "@react-three/drei";
import * as THREE from 'three';

// Define robot configurations for both models (moved here for encapsulation)
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
 * @param {function} [props.onRobotLoaded] - Optional callback function when the robot model is loaded,
 * passing the loaded THREE.Object3D. Used by PhoneCam.
 */
const UrdfRobotModel = ({ jointStates, controlMode, selectedRobotName, onRobotLoaded }) => {
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
            const scaleFactor = 10;
            robot.scale.set(scaleFactor, scaleFactor, scaleFactor);
            // Adjust the robot's initial position for better viewing in the scene
            robot.position.set(0, -2.0 * scaleFactor, 0); // Adjust Y based on robot's height if needed

            // Call the callback if provided, to notify parent component about the loaded robot
            if (onRobotLoaded) {
                onRobotLoaded(robot);
            }
        }
    }, [robot, robotConfig.name, onRobotLoaded]); // Depend on robot, robotConfig.name, and onRobotLoaded

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
                return joint ? (joint.angle || 0) : 0;
            };

            // Process different control commands for Hexapod Robot
            if (jointStates.cmd === 'left') {
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

                allFemurJoints.forEach(jointName => {
                    const joint = robot.joints[jointName];
                    if (joint) {
                        joint.setJointValue(getJointValue(jointName) - liftAmount);
                    }
                });

                setTimeout(() => {
                    allFemurJoints.forEach(jointName => {
                        const joint = robot.joints[jointName];
                        if (joint) {
                            joint.setJointValue(getJointValue(jointName) + liftAmount);
                        }
                    });
                }, 300);

                console.log("Hexapod: Attempting 'jump'.");
            } else if (jointStates.cmd === 'forward') {
                robot.position.z -= moveAmount;
                console.log("Hexapod: Moving forward. New Z:", robot.position.z);
            } else if (jointStates.cmd === 'backward') {
                robot.position.z += moveAmount;
                console.log("Hexapod: Moving backward. New Z:", robot.position.z);
            } else if (jointStates.cmd === 'up') {
                robot.position.y += moveAmount;
                console.log("Hexapod: Moving up. New Y:", robot.position.y);
            } else if (jointStates.cmd === 'down') {
                robot.position.y -= moveAmount;
                console.log("Hexapod: Moving down. New Y:", robot.position.y);
            }
        } else if (selectedRobotName !== 'hexapod_robot' && jointStates.cmd) {
            console.log(`Command '${jointStates.cmd}' ignored for ${robotConfig.name}. Only Hexapod Robot supports movement.`);
        }
    }, [jointStates, robot, controlMode, selectedRobotName, robotConfig.name]);

    return <primitive object={robot} />;
};

// Export ROBOT_MODELS so other components can access it if needed
export { ROBOT_MODELS };
export default UrdfRobotModel;