// src/components/UrdfRobotModel.jsx
import React, { useRef, useState, Suspense, useEffect, useCallback, useMemo } from 'react';
import { Canvas, useLoader, useThree } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import URDFLoader from 'urdf-loader';
import * as THREE from 'three';
import { Text } from '@react-three/drei';
import { LoadingManager, FileLoader } from 'three';

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
            cameraDistance *= 2.2; // Adjusted for better viewing

            // Set camera position to view robot from front-right at an angle
            camera.position.set(
                center.x + cameraDistance * 0.7, // More to the right
                center.y + size.y * 0.8,         // Higher up for better view
                center.z + cameraDistance * 0.8  // Closer to front
            );
            camera.lookAt(center);

            // Set OrbitControls target to the robot's center
            orbitControlsRef.current.target.copy(center);
            orbitControlsRef.current.update();

            // Adjust camera frustum
            camera.far = cameraDistance * 4;
            camera.near = 0.01;
            camera.updateProjectionMatrix();

            console.log("[CameraUpdater] Camera adjusted. Position:", camera.position, "Target:", orbitControlsRef.current.target);
        }
    }, [loadedRobotInstanceRef, triggerUpdate, camera]);

    return (
        <OrbitControls
            ref={orbitControlsRef}
            enableDamping={true}
            dampingFactor={0.05}
            minDistance={0.5}
            maxDistance={20}
        />
    );
};

// Enhanced material fixing function
const fixMaterialIssues = (object) => {
    object.traverse((child) => {
        if (child.isMesh) {
            // Fix geometry issues
            if (child.geometry) {
                // Ensure proper geometry attributes
                if (!child.geometry.attributes.normal) {
                    child.geometry.computeVertexNormals();
                }
                
                // Ensure proper bounding volumes
                child.geometry.computeBoundingBox();
                child.geometry.computeBoundingSphere();
                
                // Fix degenerate triangles and vertices
                if (child.geometry.index) {
                    // Remove degenerate triangles
                    const positions = child.geometry.attributes.position;
                    const indices = child.geometry.index;
                    
                    for (let i = 0; i < indices.count; i += 3) {
                        const a = indices.getX(i);
                        const b = indices.getX(i + 1);
                        const c = indices.getX(i + 2);
                        
                        // Check for degenerate triangles
                        if (a === b || b === c || a === c) {
                            console.log(`[UrdfRobotModel] Found degenerate triangle at ${i}, fixing...`);
                            // Replace with valid indices (could be improved)
                            indices.setX(i, 0);
                            indices.setX(i + 1, 1);
                            indices.setX(i + 2, 2);
                        }
                    }
                }
            }
            
            // Fix material issues
            if (child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                
                materials.forEach((material) => {
                    // Ensure material is properly configured
                    material.transparent = material.opacity < 1.0;
                    material.depthTest = true;
                    material.depthWrite = !material.transparent;
                    
                    // Fix opacity issues
                    if (material.opacity === undefined || material.opacity === null || material.opacity === 0) {
                        material.opacity = 1.0;
                        material.transparent = false;
                    }
                    
                    // Proper side rendering
                    if (material.side === undefined) {
                        material.side = THREE.FrontSide;
                    }
                    
                    // Alpha testing for transparent materials
                    material.alphaTest = material.transparent ? 0.1 : 0;
                    
                    // Ensure proper color space
                    if (material.map) {
                        material.map.colorSpace = THREE.SRGBColorSpace;
                    }
                    
                    // Force update
                    material.needsUpdate = true;
                });
            }
            
            // Ensure proper frustum culling
            child.frustumCulled = true;
            child.matrixAutoUpdate = true;
        }
    });
};

// Enhanced robot orientation function
const applyRobotOrientation = (robot, selectedRobotName, scale, initialPosition) => {
    console.log(`[UrdfRobotModel] Applying orientation for robot: ${selectedRobotName}`);
    
    // Reset transformations
    robot.rotation.set(0, 0, 0);
    robot.position.set(0, 0, 0);
    robot.scale.set(1, 1, 1);

    // Calculate bounding box before transformations
    const initialBox = new THREE.Box3().setFromObject(robot);
    const initialSize = initialBox.getSize(new THREE.Vector3());
    const initialCenter = initialBox.getCenter(new THREE.Vector3());
    
    console.log("[UrdfRobotModel] Initial robot analysis:", {
        size: { x: initialSize.x.toFixed(3), y: initialSize.y.toFixed(3), z: initialSize.z.toFixed(3) },
        center: { x: initialCenter.x.toFixed(3), y: initialCenter.y.toFixed(3), z: initialCenter.z.toFixed(3) },
        min: { x: initialBox.min.x.toFixed(3), y: initialBox.min.y.toFixed(3), z: initialBox.min.z.toFixed(3) },
        max: { x: initialBox.max.x.toFixed(3), y: initialBox.max.y.toFixed(3), z: initialBox.max.z.toFixed(3) }
    });

    // Apply robot-specific transformations
    if (selectedRobotName === 'jaxon_jvrc') {
        // JAXON is typically in meters but might need scaling
        robot.scale.set(scale * 0.001, scale * 0.001, scale * 0.001); // Convert mm to m if needed
        console.log("[UrdfRobotModel] JAXON JVRC: Applied scale for metric conversion");
        
    } else if (selectedRobotName === 'hexapod_robot' || selectedRobotName === 'trial') {
        robot.scale.set(scale, scale, scale);
        console.log(`[UrdfRobotModel] ${selectedRobotName}: Applied standard scale`);
        
    } else {
        // For uploaded robots, detect orientation and fix it
        console.log("[UrdfRobotModel] Analyzing uploaded robot orientation...");
        
        // Determine which axis is "up"
        const maxSize = Math.max(initialSize.x, initialSize.y, initialSize.z);
        let needsRotation = false;
        
        // Check if robot needs to be rotated to stand upright
        if (initialSize.z > initialSize.y && initialSize.z === maxSize) {
            // Robot is lying on its side (Z is tallest), rotate to make Y tallest
            robot.rotation.x = -Math.PI / 2;
            // robot.rotation.y = Math.PI;
            needsRotation = true;
            console.log("[UrdfRobotModel] Robot was lying on Z-axis, rotated to stand on Y-axis");
            
        } else if (initialSize.x > initialSize.y && initialSize.x === maxSize) {
            // Robot is lying on its back/front (X is tallest), rotate to make Y tallest
            robot.rotation.z = Math.PI / 1.2;
            needsRotation = true;
            console.log("[UrdfRobotModel] Robot was lying on X-axis, rotated to stand on Y-axis");
        }
        
        // Apply scale
        robot.scale.set(scale, scale, scale);
        console.log("[UrdfRobotModel] Applied scale:", scale);
    }

    // Recalculate bounding box after transformations
    const finalBox = new THREE.Box3().setFromObject(robot);
    const finalSize = finalBox.getSize(new THREE.Vector3());
    const finalCenter = finalBox.getCenter(new THREE.Vector3());
    
    // Position robot so it stands on the ground
    const groundOffset = -finalBox.min.y; // Distance from bottom to ground
    robot.position.set(
        initialPosition[0] - finalCenter.x,     // Center horizontally on X
        initialPosition[1] + groundOffset,      // Place bottom on ground
        initialPosition[2] - finalCenter.z      // Center horizontally on Z
    );
    
    console.log("[UrdfRobotModel] Final robot setup:", {
        position: { x: robot.position.x.toFixed(3), y: robot.position.y.toFixed(3), z: robot.position.z.toFixed(3) },
        rotation: { x: robot.rotation.x.toFixed(3), y: robot.rotation.y.toFixed(3), z: robot.rotation.z.toFixed(3) },
        scale: { x: robot.scale.x.toFixed(3), y: robot.scale.y.toFixed(3), z: robot.scale.z.toFixed(3) },
        finalSize: { x: finalSize.x.toFixed(3), y: finalSize.y.toFixed(3), z: finalSize.z.toFixed(3) },
        groundOffset: groundOffset.toFixed(3)
    });
};

/**
 * UrdfRobotModel component handles loading and displaying a URDF robot model.
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
            console.log(`[UrdfRobotModel][URLModifier] Processing URL: '${url}'`);

            let lookupKey = url;

            // Handle blob URLs
            if (url.startsWith('blob:http')) {
                try {
                    const parsedUrl = new URL(url);
                    lookupKey = parsedUrl.pathname.substring(1);
                } catch (e) {
                    console.warn(`[UrdfRobotModel][URLModifier] Could not parse blob URL: ${url}`);
                }
            }

            // Remove protocol prefixes
            if (lookupKey.startsWith('package://')) {
                const parts = lookupKey.substring('package://'.length).split('/');
                lookupKey = parts.length > 1 ? parts.slice(1).join('/') : '';
            } else if (lookupKey.startsWith('model://')) {
                lookupKey = lookupKey.substring('model://'.length);
            }

            // Clean path
            lookupKey = lookupKey.replace(/^\.?\/?/, '').replace(/\\/g, '/');

            // Try multiple lookup strategies
            const lookupAttempts = [
                lookupKey,
                lookupKey.toLowerCase(),
                lookupKey.split('/').pop(),
                lookupKey.split('/').pop()?.toLowerCase()
            ].filter(Boolean);

            let foundBlobUrl = null;
            for (const attempt of lookupAttempts) {
                if (fileMap && fileMap[attempt]) {
                    foundBlobUrl = fileMap[attempt];
                    console.log(`[UrdfRobotModel][URLModifier] ✅ Found asset: "${attempt}"`);
                    break;
                }
            }

            if (!foundBlobUrl) {
                console.warn(`[UrdfRobotModel][URLModifier] ❌ Asset not found for: '${url}'`);
                console.log("Available files:", Object.keys(fileMap || {}));
            }

            return foundBlobUrl || url;
        });

        loader.parseVisual = true;
        loader.parseCollision = false;
        loader.workingPath = "/";
    });

    useEffect(() => {
        if (robotLoadedInstance) {
            console.log("URDF Robot Loaded:", robotLoadedInstance);
            console.log("Available Joints:", Object.keys(robotLoadedInstance.joints));

            robotRef.current = robotLoadedInstance;

            // Fix geometry and material issues
            console.log("[UrdfRobotModel] Fixing geometry and material issues...");
            fixMaterialIssues(robotLoadedInstance);

            // Apply robot-specific orientation and positioning
            applyRobotOrientation(robotLoadedInstance, selectedRobotName, scale, initialPosition);

            // Final material fix after transformations
            setTimeout(() => {
                fixMaterialIssues(robotLoadedInstance);
                console.log("[UrdfRobotModel] Applied final fixes.");
            }, 100);

            if (onRobotLoaded) {
                onRobotLoaded(robotLoadedInstance);
            }
        }
    }, [robotLoadedInstance, onRobotLoaded, scale, initialPosition, selectedRobotName]);

    // Handle joint state updates
    useEffect(() => {
        const robot = robotRef.current;
        if (!robot || !jointStates || Object.keys(jointStates).length === 0) {
            return;
        }

        // Apply direct joint angle commands
        for (const jointName in jointStates) {
            if (jointName !== 'cmd' && jointName !== 'timestamp') {
                const targetAngle = jointStates[jointName];
                const urdfJoint = robot.joints[jointName];
                if (urdfJoint && typeof targetAngle === 'number' && !isNaN(targetAngle)) {
                    if (Math.abs(urdfJoint.angle - targetAngle) > 0.001) { // Only update if significantly different
                        urdfJoint.setJointValue(targetAngle);
                    }
                }
            }
        }
    }, [jointStates]);

    // Cleanup
    useEffect(() => {
        return () => {
            if (urdfContent && urdfContent.startsWith('blob:')) {
                try {
                    URL.revokeObjectURL(urdfContent);
                } catch (e) {
                    // Ignore cleanup errors
                }
            }
        };
    }, [urdfContent]);

    if (!robotLoadedInstance) {
        return null;
    }

    return <primitive object={robotLoadedInstance} />;
};

export { UrdfRobotModel, CameraUpdater };