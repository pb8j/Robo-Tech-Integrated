// src/components/UrdfRobotModel.jsx (or embedded in controlPanel.jsx/PhoneCam.jsx)
import React, { useEffect, Suspense } from "react";
import { Canvas, useLoader } from "@react-three/fiber";
import URDFLoader from 'urdf-loader';
import { OrbitControls, Environment, Text } from "@react-three/drei";
import * as THREE from 'three';

// Define robot configurations for both models (kept here for context, or imported from a shared file)
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
            // Scale and position might need different adjustments for JAXON JVRC
            let scaleFactor;
            if (selectedRobotName === 'jaxon_jvrc') {
                scaleFactor = 0.001; // JAXON JVRC models are often very large
                robot.position.set(0, -1, 0); // Adjust Y for JAXON to stand on ground
            } else { // hexapod_robot
                scaleFactor = 10;
                robot.position.set(0, -2.0 * scaleFactor, 0);
            }
            robot.scale.set(scaleFactor, scaleFactor, scaleFactor);


            // Call the callback if provided, to notify parent component about the loaded robot
            if (onRobotLoaded) {
                onRobotLoaded(robot);
            }
        }
    }, [robot, robotConfig.name, onRobotLoaded, selectedRobotName]); // Depend on selectedRobotName too

    // Effect to update robot joint states and position based on received commands
    useEffect(() => {
        if (!robot || controlMode !== 'urdf' || !jointStates.cmd) {
            return; // Exit if no robot, not in URDF mode, or no command
        }

        const rotationAmount = 0.1; // Amount for joint rotation
        const liftAmount = 0.1;     // Amount for vertical lift (jump)
        const moveAmount = 0.5;     // Amount for translational movement

        // Helper function to safely get a joint's current value
        const getJointValue = (jointName) => {
            const joint = robot.joints[jointName];
            return joint ? (joint.angle || 0) : 0;
        };

        // --- Hexapod Robot Control Logic ---
        if (selectedRobotName === 'hexapod_robot') {
            if (jointStates.cmd === 'left') {
                ['coxa_joint_r1', 'coxa_joint_r2', 'coxa_joint_r3',
                 'coxa_joint_l1', 'coxa_joint_l2', 'coxa_joint_l3'].forEach(jointName => {
                    const joint = robot.joints[jointName];
                    if (joint) {
                        joint.setJointValue(getJointValue(jointName) + rotationAmount);
                    }
                });
                console.log("Hexapod: Attempting 'left' (all joints).");
            } else if (jointStates.cmd === 'right') {
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
        }
        // --- JAXON JVRC Control Logic ---
        else if (selectedRobotName === 'jaxon_jvrc') {
            // Based on your DAE file names, these are potential joint names.
            // Actual joint names need to be verified from the JAXON JVRC URDF.
            // These are speculative movements to demonstrate the concept.
            const armJoints = [
                'LARM_JOINT0', 'LARM_JOINT1', 'LARM_JOINT2', 'LARM_JOINT3',
                'LARM_JOINT4', 'LARM_JOINT5', 'LARM_JOINT6', 'LARM_JOINT7',
                'RARM_JOINT0', 'RARM_JOINT1', 'RARM_JOINT2', 'RARM_JOINT3',
                'RARM_JOINT4', 'RARM_JOINT5', 'RARM_JOINT6', 'RARM_JOINT7'
            ];
            const headJoints = ['CHEST_JOINT0', 'HEAD_JOINT0']; // Assuming head/neck joints

            if (jointStates.cmd === 'left') {
                // Rotate chest or arms to simulate left turn/lean
                const chestJoint = robot.joints['CHEST_JOINT0']; // Common chest yaw joint
                if (chestJoint) chestJoint.setJointValue(getJointValue('CHEST_JOINT0') + rotationAmount);
                // Also move left arm forward/up slightly
                const leftArmShoulderPitch = robot.joints['LARM_JOINT1']; // Common shoulder pitch
                if (leftArmShoulderPitch) leftArmShoulderPitch.setJointValue(getJointValue('LARM_JOINT1') - rotationAmount);
                console.log("JAXON JVRC: Attempting 'left' (chest/arm).");
            } else if (jointStates.cmd === 'right') {
                // Rotate chest or arms to simulate right turn/lean
                const chestJoint = robot.joints['CHEST_JOINT0'];
                if (chestJoint) chestJoint.setJointValue(getJointValue('CHEST_JOINT0') - rotationAmount);
                // Also move right arm forward/up slightly
                const rightArmShoulderPitch = robot.joints['RARM_JOINT1'];
                if (rightArmShoulderPitch) rightArmShoulderPitch.setJointValue(getJointValue('RARM_JOINT1') - rotationAmount);
                console.log("JAXON JVRC: Attempting 'right' (chest/arm).");
            } else if (jointStates.cmd === 'up') {
                // Lift both arms up or move head up
                headJoints.forEach(jointName => {
                    const joint = robot.joints[jointName];
                    if (joint) joint.setJointValue(getJointValue(jointName) + rotationAmount);
                });
                const leftArmShoulderRoll = robot.joints['LARM_JOINT2']; // Common shoulder roll (out/in)
                if (leftArmShoulderRoll) leftArmShoulderRoll.setJointValue(getJointValue('LARM_JOINT2') - rotationAmount);
                const rightArmShoulderRoll = robot.joints['RARM_JOINT2'];
                if (rightArmShoulderRoll) rightArmShoulderRoll.setJointValue(getJointValue('RARM_JOINT2') + rotationAmount);
                console.log("JAXON JVRC: Attempting 'up' (head/arms).");
            } else if (jointStates.cmd === 'down') {
                 // Lower both arms down or move head down
                    headJoints.forEach(jointName => {
                    const joint = robot.joints[jointName];
                    if (joint) joint.setJointValue(getJointValue(jointName) - rotationAmount);
                });
                const leftArmShoulderRoll = robot.joints['LARM_JOINT2'];
                if (leftArmShoulderRoll) leftArmShoulderRoll.setJointValue(getJointValue('LARM_JOINT2') + rotationAmount);
                const rightArmShoulderRoll = robot.joints['RARM_JOINT2'];
                if (rightArmShoulderRoll) rightArmShoulderRoll.setJointValue(getJointValue('RARM_JOINT2') - rotationAmount);
                console.log("JAXON JVRC: Attempting 'down' (head/arms).");
            }
            // Add more specific JAXON JVRC movements here if you have more commands or want more nuanced control
            // Example:
            // else if (jointStates.cmd === 'forward') { /* Move specific JAXON JVRC joints for walking */ }
        }
    }, [jointStates, robot, controlMode, selectedRobotName]); // Depend on relevant states for re-evaluation

    // Render the loaded robot model
    return <primitive object={robot} />;
};

// Export ROBOT_MODELS so other components can access it if needed
export { ROBOT_MODELS };
export default UrdfRobotModel;