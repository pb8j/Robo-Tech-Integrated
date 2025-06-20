// src/pages/UrdfUploader.jsx
import React, { useRef, useState, Suspense, useEffect, useCallback, useMemo } from 'react';
import { Canvas } from '@react-three/fiber'; // Canvas is only needed if this file directly renders a 3D scene
import { OrbitControls, Environment } from '@react-three/drei'; // Only if Canvas is here
import * as THREE from 'three';
import { Text } from '@react-three/drei';
import { LoadingManager, FileLoader } from 'three';

// Import the new RobotHandControl component
import RobotHandControl from './RobotHandControl';

/**
 * UrdfUploader component: Manages file uploads (URDF and meshes)
 * and passes them to the RobotHandControl component for display and interaction.
 */
const UrdfUploader = () => {
    // State to hold the main URDF file (as a File object)
    const [urdfFile, setUrdfFile] = useState(null);
    // State to hold the mapping of mesh filenames to their ArrayBuffer content
    const [meshFiles, setMeshFiles] = useState(new Map()); // Map: filename -> ArrayBuffer
    // State for display status messages
    const [status, setStatus] = useState("Upload your URDF and mesh files.");
    // State to control when the RobotHandControl should attempt to render the robot
    const [robotLoadRequested, setRobotLoadRequested] = useState(false); // Changed name to indicate "request"

    // Refs for file input elements
    const urdfInputRef = useRef(null);
    const meshesInputRef = useRef(null);

    // Handlers for file input changes
    const handleUrdfFileChange = (e) => {
        const file = e.target.files[0];
        if (file && (file.name.toLowerCase().endsWith('.urdf') || file.name.toLowerCase().endsWith('.xml'))) {
            setUrdfFile(file);
            setStatus(`URDF file selected: ${file.name}`);
            setRobotLoadRequested(false); // Reset loaded state on file change
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
                setRobotLoadRequested(false); // Reset state to trigger re-load on subsequent "Load Robot"
            })
            .catch(error => {
                setStatus(`Error reading some mesh files: ${error.message}`);
                setMeshFiles(new Map());
                setRobotLoadRequested(false);
                console.error("[UrdfUploader] Error during mesh file processing:", error);
            });
    };

    // Handlers for drag-and-drop functionality
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

    // Button handler to initiate robot loading
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
        setRobotLoadRequested(true); // This state change triggers RobotHandControl to try loading
    };

    // Button handler to clear all uploaded files and reset state
    const handleClearFiles = () => {
        setUrdfFile(null);
        setMeshFiles(new Map());
        setRobotLoadRequested(false);
        setStatus("Files cleared. Ready for new uploads.");
        // Clear file input elements
        if (urdfInputRef.current) urdfInputRef.current.value = '';
        if (meshesInputRef.current) meshesInputRef.current.value = '';
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

            {/* Robot Display and Control Area (handled by RobotHandControl) */}
            {robotLoadRequested && urdfFile && meshFiles.size > 0 ? (
                // Render the new RobotHandControl component
                <RobotHandControl
                    urdfFile={urdfFile} // Pass the File object directly
                    meshFiles={meshFiles} // Pass the Map of ArrayBuffers
                />
            ) : (
                <div className="w-full h-96 bg-gray-700 rounded-lg overflow-hidden shadow-inner border border-gray-600 flex items-center justify-center text-gray-400 text-xl">
                    {urdfFile && meshFiles.size > 0 ? "Click 'Load Robot' to view." : "Upload URDF and mesh files to begin."}
                </div>
            )}
        </div>
    );
};

export default UrdfUploader;
