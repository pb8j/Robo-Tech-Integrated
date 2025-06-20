// src/pages/UrdfUploader.jsx
import React, { useRef, useState, Suspense, useEffect, useCallback, useMemo } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import URDFLoader from 'urdf-loader';
import * as THREE from 'three';
import { Text } from '@react-three/drei';
import { LoadingManager, FileLoader } from 'three';

/**
 * UrdfRobotModel component handles loading and displaying a URDF robot model.
 * It uses a custom file loader with a URL modifier to resolve mesh paths from an in-memory file map.
 * @param {object} props
 * @param {string} props.urdfContent - The Blob URL of the URDF file content.
 * @param {object} props.fileMap - A plain object mapping filenames (keys) to Blob URLs (values) of mesh files.
 * @param {function} [props.onRobotLoaded] - Optional callback when the robot model is loaded.
 * @param {Array<number>} [props.initialPosition=[0,0,0]] - Initial position for the robot.
 * @param {number} [props.scale=1.0] - Initial scale for the robot.
 */
const UrdfRobotModel = ({ urdfContent, fileMap, onRobotLoaded, initialPosition = [0, 0, 0], scale = 1.0 }) => {
    const robotRef = useRef(null);

    const urdfContentUrl = useMemo(() => {
        if (urdfContent) { // urdfContent is already a Blob URL in this context
            return urdfContent;
        }
        return null;
    }, [urdfContent]);

    const robotLoadedInstance = useLoader(URDFLoader, urdfContentUrl, (loader) => {
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
            console.log(`[UrdfRobotModel][URLModifier Debug] Trying lookup keys: ${uniquePossibleKeys.join(', ')}`);


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
                console.log(`[UrdfRobotModel][URLModifier] ✅ SUCCESS! Provided data for "${url}" using key: "${usedKey}".`);
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
        return () => {
            // urdfContent is already a Blob URL coming from parent. Revoke it here.
            if (urdfContent) {
                try {
                    URL.revokeObjectURL(urdfContent);
                    console.log(`[UrdfRobotModel] Revoked URDF Blob URL: ${urdfContent}`);
                } catch (e) {
                    console.warn(`[UrdfRobotModel] Error revoking URDF blob URL: ${urdfContent}`, e);
                }
            }
        };
    }, [urdfContent]);

    if (!robotLoadedInstance) {
        return null;
    }

    return <primitive object={robotLoadedInstance} />;
};


// --- Main UrdfUploader Component ---
const UrdfUploader = () => {
    // State to hold the main URDF file (as a File object)
    const [urdfFile, setUrdfFile] = useState(null);
    // State to hold the mapping of mesh filenames to their ArrayBuffer content
    const [meshFiles, setMeshFiles] = useState(new Map()); // Map: filename -> ArrayBuffer
    // State for display status messages
    const [status, setStatus] = useState("Upload your URDF and mesh files.");
    // State to control when the robot Canvas should attempt to render
    const [robotLoaded, setRobotLoaded] = useState(false);

    // Refs for file input elements
    const urdfInputRef = useRef(null);
    const meshesInputRef = useRef(null);

    // Function to derive the Blob URL for the URDF content, memoized
    const urdfContentBlobUrl = useMemo(() => {
        if (urdfFile) {
            return URL.createObjectURL(urdfFile);
        }
        return null;
    }, [urdfFile]);

    // Function to convert Map of ArrayBuffers to a plain object of Blob URLs for the UrdfRobotModel
    const fileMapForModel = useMemo(() => {
        const obj = {};
        meshFiles.forEach((arrayBuffer, filename) => {
            // Create Blob URL for each mesh ArrayBuffer
            obj[filename] = URL.createObjectURL(new Blob([arrayBuffer]));
        });
        return obj;
    }, [meshFiles]);

    // Handle cleanup of Blob URLs created for mesh files when component unmounts or meshFiles change
    useEffect(() => {
        return () => {
            console.log("[UrdfUploader Cleanup] Revoking mesh Blob URLs...");
            if (fileMapForModel) {
                Object.values(fileMapForModel).forEach(blobUrl => {
                    try {
                        URL.revokeObjectURL(blobUrl);
                    } catch (e) {
                        console.warn(`[UrdfUploader Cleanup] Error revoking mesh blob URL: ${blobUrl}`, e);
                    }
                });
            }
        };
    }, [fileMapForModel]);


    const handleUrdfFileChange = (e) => {
        const file = e.target.files[0];
        if (file && (file.name.toLowerCase().endsWith('.urdf') || file.name.toLowerCase().endsWith('.xml'))) {
            setUrdfFile(file);
            setStatus(`URDF file selected: ${file.name}`);
            setRobotLoaded(false);
        } else {
            setUrdfFile(null);
            setStatus("Please select a .urdf or .xml file.");
            setRobotLoaded(false);
        }
    };

    const handleMeshFilesChange = (e) => {
        const files = Array.from(e.target.files);
        const newMeshMap = new Map();
        const readPromises = files.map(file => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (event) => {
                    newMeshMap.set(file.name, event.target.result); // Store original casing from file.name
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
                setRobotLoaded(false);
            })
            .catch(error => {
                setStatus(`Error reading some mesh files: ${error.message}`);
                setMeshFiles(new Map());
                setRobotLoaded(false);
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
                setRobotLoaded(false);
            } else {
                setStatus("Dropped file is not a .urdf or .xml file.");
                setUrdfFile(null);
                setRobotLoaded(false);
            }
        } else if (type === 'meshes') {
            const meshFilesDropped = files.filter(f => f.name.toLowerCase().match(/\.(stl|obj|dae|gltf|glb)$/));
            if (meshFilesDropped.length > 0) {
                 const newMeshMap = new Map();
                 const readPromises = meshFilesDropped.map(file => {
                    return new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                            newMeshMap.set(file.name, event.target.result); // Store original casing from file.name
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
                        setRobotLoaded(false);
                    })
                    .catch(error => {
                        setStatus(`Error reading some dropped mesh files: ${error.message}`);
                        setMeshFiles(new Map());
                        setRobotLoaded(false);
                        console.error("[UrdfUploader] Error during dropped mesh file processing:", error);
                    });

            } else {
                setStatus("No valid mesh files (.obj, .stl, .dae, .gltf, .glb) dropped.");
                setMeshFiles(new Map());
                setRobotLoaded(false);
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
        setRobotLoaded(true);
    };

    const handleClearFiles = () => {
        setUrdfFile(null);
        setMeshFiles(new Map());
        setRobotLoaded(false);
        setStatus("Files cleared. Ready for new uploads.");
        if (urdfInputRef.current) urdfInputRef.current.value = '';
        if (meshesInputRef.current) meshesInputRef.current.value = '';
    };

    // This is now a regular function, not memoized as a value.
    const getUrdfBasePath = () => {
        return '/';
    };


    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-700 flex flex-col items-center justify-center p-4 sm:p-6 font-inter text-white">
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <script src="https://cdn.tailwindcss.com"></script>

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
                        className="py-3 px-8 rounded-lg text-lg font-semibold bg-indigo-600 text-white shadow-lg transition duration-300 ease-in-out hover:bg-indigo-700 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
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

            {/* Robot Display Area */}
            {robotLoaded && urdfFile && meshFiles.size > 0 ? (
                <div className="w-full h-96 bg-gray-700 rounded-lg overflow-hidden shadow-inner border border-gray-600">
                    <Canvas camera={{ position: [1, 1, 1], fov: 75 }}>
                        <ambientLight intensity={0.8} />
                        <directionalLight position={[2, 5, 2]} intensity={1} />
                        <directionalLight position={[-2, -5, -2]} intensity={0.5} />
                        <Environment preset="studio" />
                        <Suspense fallback={<Text color="white" anchorX="center" anchorY="middle">Loading Robot Model...</Text>}>
                            <UrdfRobotModel
                                urdfContent={urdfContentBlobUrl} // Pass the Blob URL derived from urdfFile
                                fileMap={fileMapForModel} // Pass the plain object of Blob URLs for meshes
                                initialPosition={[0, 0, 0]} // Default position
                                scale={1.0} // Default scale
                            />
                        </Suspense>
                        <OrbitControls />
                    </Canvas>
                </div>
            ) : (
                <div className="w-full h-96 bg-gray-700 rounded-lg overflow-hidden shadow-inner border border-gray-600 flex items-center justify-center text-gray-400 text-xl">
                    {urdfFile && meshFiles.size > 0 ? "Click 'Load Robot' to view." : "Upload URDF and mesh files to begin."}
                </div>
            )}
        </div>
    );
};

export default UrdfUploader;