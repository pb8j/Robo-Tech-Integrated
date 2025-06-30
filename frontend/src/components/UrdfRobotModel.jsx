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

            const maxDim = Math.max(size.x, size.y, size.z);
            const fov = camera.fov * (Math.PI / 180);
            let cameraDistance = maxDim / (2 * Math.tan(fov / 2));
            cameraDistance *= 2.2; 

            camera.position.set(
                center.x + cameraDistance * 0.7,
                center.y + size.y * 0.8,
                center.z + cameraDistance * 0.8
            );
            camera.lookAt(center);

            orbitControlsRef.current.target.copy(center);
            orbitControlsRef.current.update();

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

const fixMaterialIssues = (object) => {
    object.traverse((child) => {
        if (child.isMesh) {
            if (child.geometry) {
                if (!child.geometry.attributes.normal) {
                    child.geometry.computeVertexNormals();
                }
                child.geometry.computeBoundingBox();
                child.geometry.computeBoundingSphere();
            }
            if (child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach((material) => {
                    material.transparent = material.opacity < 1.0;
                    material.depthTest = true;
                    material.depthWrite = !material.transparent;
                    if (material.opacity === undefined || material.opacity === null || material.opacity === 0) {
                        material.opacity = 1.0;
                        material.transparent = false;
                    }
                    if (material.side === undefined) {
                        material.side = THREE.FrontSide;
                    }
                    material.alphaTest = material.transparent ? 0.1 : 0;
                    if (material.map) {
                        material.map.colorSpace = THREE.SRGBColorSpace;
                    }
                    material.needsUpdate = true;
                });
            }
            child.frustumCulled = true;
            child.matrixAutoUpdate = true;
        }
    });
};

// ** FIX: Enhanced robot orientation function **
const applyRobotOrientation = (robot, selectedRobotName, scale, initialPosition) => {
    console.log(`[UrdfRobotModel] Applying orientation for robot: ${selectedRobotName}`);

    robot.rotation.set(0, 0, 0);
    robot.position.set(0, 0, 0);
    robot.scale.set(1, 1, 1);
    robot.updateMatrixWorld(true);

    const initialBox = new THREE.Box3().setFromObject(robot);
    const initialSize = initialBox.getSize(new THREE.Vector3());

    console.log("[UrdfRobotModel] Initial robot analysis:", {
        size: { x: initialSize.x.toFixed(3), y: initialSize.y.toFixed(3), z: initialSize.z.toFixed(2) },
    });

    // ** FIX: Rotate the robot to stand upright (Y-axis up) **
    // URDF models often use Z-up, while Three.js uses Y-up.
    // We rotate -90 degrees around the X-axis to correct this.
    robot.rotation.x = -Math.PI / 2;
    robot.rotation.z = -Math.PI / 3;
    robot.updateMatrixWorld(true);


    if (selectedRobotName === 'jaxon_jvrc') {
        robot.scale.set(scale * 0.001, scale * 0.001, scale * 0.001);
        console.log("[UrdfRobotModel] JAXON JVRC: Applied scale for metric conversion");
    } else {
        robot.scale.set(scale, scale, scale);
        console.log(`[UrdfRobotModel] ${selectedRobotName}: Applied standard scale`);
    }

    robot.updateMatrixWorld(true);
    
    // Recalculate bounding box after transformations to correctly place it on the ground
    const finalBox = new THREE.Box3().setFromObject(robot);
    const finalCenter = finalBox.getCenter(new THREE.Vector3());

    // Position robot so its new bottom is on the ground plane
    const groundOffset = -finalBox.min.y;
    robot.position.set(
        initialPosition[0] - finalCenter.x,
        initialPosition[1] + groundOffset,
        initialPosition[2] - finalCenter.z
    );

    console.log("[UrdfRobotModel] Final robot setup:", {
        position: { x: robot.position.x.toFixed(3), y: robot.position.y.toFixed(3), z: robot.position.z.toFixed(3) },
        rotation: { x: robot.rotation.x.toFixed(3), y: robot.rotation.y.toFixed(3), z: robot.rotation.z.toFixed(3) },
        scale: { x: robot.scale.x.toFixed(3), y: robot.scale.y.toFixed(3), z: robot.scale.z.toFixed(3) },
    });
};

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
            let lookupKey = url;
            if (url.startsWith('blob:http')) {
                try {
                    const parsedUrl = new URL(url);
                    lookupKey = parsedUrl.pathname.substring(1);
                } catch (e) {
                    console.warn(`[UrdfRobotModel][URLModifier] Could not parse blob URL: ${url}`);
                }
            }
            if (lookupKey.startsWith('package://')) {
                const parts = lookupKey.substring('package://'.length).split('/');
                lookupKey = parts.length > 1 ? parts.slice(1).join('/') : '';
            } else if (lookupKey.startsWith('model://')) {
                lookupKey = lookupKey.substring('model://'.length);
            }
            lookupKey = lookupKey.replace(/^\.?\/?/, '').replace(/\\/g, '/');
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
            }

            return foundBlobUrl || url;
        });

        loader.parseVisual = true;
        loader.parseCollision = false;
        loader.workingPath = "/";
    });

    useEffect(() => {
        if (robotLoadedInstance) {
            robotRef.current = robotLoadedInstance;
            fixMaterialIssues(robotLoadedInstance);
            applyRobotOrientation(robotLoadedInstance, selectedRobotName, scale, initialPosition);
            setTimeout(() => {
                fixMaterialIssues(robotLoadedInstance);
            }, 100);

            if (onRobotLoaded) {
                onRobotLoaded(robotLoadedInstance);
            }
        }
    }, [robotLoadedInstance, onRobotLoaded, scale, initialPosition, selectedRobotName]);

    useEffect(() => {
        const robot = robotRef.current;
        if (!robot || !jointStates || Object.keys(jointStates).length === 0) {
            return;
        }
        // console.log("[UrdfRobotModel] Updating robot joints with:", jointStates); // Add log to see incoming states
        for (const jointName in jointStates) {
            if (jointName !== 'cmd' && jointName !== 'timestamp') {
                const targetAngle = jointStates[jointName];
                const urdfJoint = robot.joints[jointName];
                if (urdfJoint && typeof targetAngle === 'number' && !isNaN(targetAngle)) {
                    // Re-introduced a very small threshold for stability, or remove entirely if needed.
                    // This prevents constant updates for tiny, imperceptible changes.
                    if (Math.abs(urdfJoint.angle - targetAngle) > 0.00001) { 
                        urdfJoint.setJointValue(targetAngle);
                    }
                }
            }
        }
    }, [jointStates]); // This dependency correctly triggers updates when jointStates object reference changes

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