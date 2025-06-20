// src/pages/UrdfUploader.jsx
import React, { useRef, useState, Suspense, useEffect, useCallback } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { OrbitControls, Environment, Text } from '@react-three/drei';
import URDFLoader from 'urdf-loader';
import * as THREE from 'three';

/**
 * CustomURDFModelLoader component handles loading the URDF model
 * using a custom file loader that can access in-memory uploaded files.
 * @param {Object} props
 * @param {File} props.urdfFile - The uploaded URDF file Blob.
 * @param {Map<string, ArrayBuffer>} props.meshFiles - A map of mesh file paths to their ArrayBuffer content.
 * @param {string} props.basePath - The base path for resolving relative URDF paths.
 */
const CustomURDFModelLoader = ({ urdfFile, meshFiles, basePath }) => {
    const robotRef = useRef();

    // Memoize the custom file loader to prevent unnecessary re-creations
    const customFileLoader = useCallback(() => {
        const loader = new THREE.FileLoader();
        loader.setResponseType('arraybuffer'); // Meshes are often binary

        // Override the load method to check our in-memory meshFiles map first
        const originalLoad = loader.load;
        loader.load = (url, onLoad, onProgress, onError) => {
            // Normalize URL to handle common path separators and ensure it matches map keys
            const normalizedUrl = url.replace(/\\/g, '/');
            const fileName = normalizedUrl.split('/').pop();

            // Attempt to find the file in our uploaded mesh files map
            // We'll try a few common patterns for finding the file,
            // as URDF paths can be tricky (e.g., "package://robot_description/meshes/mesh.stl")
            const possibleKeys = [
                normalizedUrl, // Exact match
                fileName,      // Just the file name
                normalizedUrl.replace(/^package:\/\/[^/]+\//, ''), // Remove 'package://...' prefix
                'meshes/' + fileName // Common "meshes/" prefix
            ];

            let foundMesh = null;
            for (const key of possibleKeys) {
                if (meshFiles.has(key)) {
                    foundMesh = meshFiles.get(key);
                    break;
                }
                // Also try decoding URI components for special characters
                try {
                    const decodedKey = decodeURIComponent(key);
                    if (meshFiles.has(decodedKey)) {
                        foundMesh = meshFiles.get(decodedKey);
                        break;
                    }
                } catch (e) {
                    // Ignore URIError if decoding fails
                }
            }


            if (foundMesh) {
                console.log(`CustomLoader: Found mesh in memory for URL: ${url} (Key: ${foundMesh.name || fileName})`);
                onLoad(foundMesh); // Provide the ArrayBuffer directly
            } else {
                console.warn(`CustomLoader: Mesh not found in uploaded files for URL: ${url}. Falling back to default loader.`);
                // If not found in uploaded files, use the original loader to fetch from a URL
                originalLoad.call(loader, url, onLoad, onProgress, onError);
            }
        };
        return loader;
    }, [meshFiles]); // Recreate customFileLoader if meshFiles changes

    // Use the useLoader hook from @react-three/fiber to load the URDF model
    // Pass the Blob directly to useLoader, and provide the custom file loader
    const robot = useLoader(
        URDFLoader,
        URL.createObjectURL(urdfFile), // Create an object URL for the URDF file
        (loader) => {
            // Set the custom fileLoader
            loader.fileLoader = customFileLoader();
            // Set the working path for the URDF loader to resolve relative mesh paths
            // If we're using in-memory blobs, the workingPath might not be strictly necessary
            // but it's good practice for how URDF paths are typically structured.
            // For uploaded files, the 'packagePath' concept is usually handled by
            // matching file names/relative paths in the meshFiles Map.
            loader.workingPath = basePath;
            loader.parseVisual = true;
            loader.parseCollision = false; // Usually not needed for visualization
        }
    );

    useEffect(() => {
        if (robot) {
            console.log("URDF Robot Loaded:", robot);
            // Center and scale the robot for better viewing
            const box = new THREE.Box3().setFromObject(robot);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());

            const maxDim = Math.max(size.x, size.y, size.z);
            const scaleFactor = 5 / maxDim; // Adjust so the robot fits nicely in a 5 unit space
            robot.scale.set(scaleFactor, scaleFactor, scaleFactor);

            // Recalculate box with new scale
            box.setFromObject(robot);
            box.getCenter(center); // Get new center
            robot.position.sub(center.set(center.x, box.min.y, center.z)); // Move robot to sit on the origin

            robotRef.current = robot; // Store ref for potential later manipulation
        }
    }, [robot]);

    return <primitive object={robot} />;
};


const UrdfUploader = () => {
    const [urdfFile, setUrdfFile] = useState(null);
    const [meshFiles, setMeshFiles] = useState(new Map()); // Map: filename -> ArrayBuffer
    const [status, setStatus] = useState("Upload your URDF and mesh files.");
    const [robotLoaded, setRobotLoaded] = useState(false); // State to control robot display

    // Ref for the file input elements to reset them
    const urdfInputRef = useRef(null);
    const meshesInputRef = useRef(null);

    // --- File Handling Functions ---

    const handleUrdfFileChange = (e) => {
        const file = e.target.files[0];
        if (file && file.name.endsWith('.urdf')) {
            setUrdfFile(file);
            setStatus(`URDF file selected: ${file.name}`);
        } else {
            setUrdfFile(null);
            setStatus("Please select a .urdf file.");
        }
        setRobotLoaded(false); // Reset display if files change
    };

    const handleMeshFilesChange = (e) => {
        const files = Array.from(e.target.files);
        const newMeshMap = new Map();
        let valid = true;
        files.forEach(file => {
            // Store file content directly as ArrayBuffer
            const reader = new FileReader();
            reader.onload = (event) => {
                newMeshMap.set(file.name, event.target.result); // Use file.name as key
                // You might need more sophisticated keying if your URDF uses complex package paths
                // e.g., newMeshMap.set('package://my_robot/meshes/' + file.name, event.target.result);
            };
            reader.onerror = () => {
                valid = false;
                setStatus(`Error reading file: ${file.name}`);
            };
            reader.readAsArrayBuffer(file);
        });

        if (valid) {
            setMeshFiles(newMeshMap);
            setStatus(`Selected ${files.length} mesh files.`);
        } else {
            setMeshFiles(new Map());
            setRobotLoaded(false);
        }
    };

    const handleDrop = useCallback((e, type) => {
        e.preventDefault();
        e.stopPropagation();
        e.target.classList.remove('border-blue-500', 'bg-blue-900'); // Remove drag-over styles

        const files = Array.from(e.dataTransfer.files);

        if (type === 'urdf') {
            const urdf = files.find(f => f.name.endsWith('.urdf'));
            if (urdf) {
                setUrdfFile(urdf);
                setStatus(`URDF file dropped: ${urdf.name}`);
            } else {
                setStatus("Dropped file is not a .urdf file.");
                setUrdfFile(null);
            }
        } else if (type === 'meshes') {
            const newMeshMap = new Map(meshFiles); // Start with existing meshes if any
            let valid = true;
            files.forEach(file => {
                // Read as ArrayBuffer for URDFLoader
                const reader = new FileReader();
                reader.onload = (event) => {
                    newMeshMap.set(file.name, event.target.result);
                    // For more complex URDFs, you might need to infer relative paths
                    // Example: if file is in 'meshes/my_mesh.stl', key could be 'my_mesh.stl' or 'meshes/my_mesh.stl'
                };
                reader.onerror = () => {
                    valid = false;
                    setStatus(`Error reading file: ${file.name}`);
                };
                reader.readAsArrayBuffer(file);
            });

            if (valid) {
                setMeshFiles(newMeshMap);
                setStatus(`Dropped ${files.length} mesh files.`);
            } else {
                setMeshFiles(new Map());
                setRobotLoaded(false);
            }
        }
        setRobotLoaded(false); // Reset display if files change
    }, [meshFiles]); // Depend on meshFiles for combining existing with new

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.target.classList.add('border-blue-500', 'bg-blue-900'); // Add visual feedback
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.target.classList.remove('border-blue-500', 'bg-blue-900'); // Remove visual feedback
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
        setRobotLoaded(true); // Trigger robot display
    };

    const handleClearFiles = () => {
        setUrdfFile(null);
        setMeshFiles(new Map());
        setRobotLoaded(false);
        setStatus("Files cleared. Ready for new uploads.");
        if (urdfInputRef.current) urdfInputRef.current.value = ''; // Reset file input
        if (meshesInputRef.current) meshesInputRef.current.value = ''; // Reset file input
    };

    // Determine the base path for the URDF loader.
    // This is crucial for URDFs that reference meshes like "package://my_robot_name/meshes/my_mesh.stl"
    // For simplicity, we'll assume the URDF file is at the root of the "package"
    // and extract a potential package name if present in the URDF itself, or use a generic one.
    const getUrdfBasePath = useCallback(() => {
        // Here you would typically parse the URDF XML to find the package paths.
        // For local files, the best we can do is try to match paths
        // or ensure the mesh file names directly match the references in URDF.
        // As a fallback, we'll try to use the directory where the URDF might "logically" be.
        // For uploaded files, URDFLoader's fileLoader override is the most important part.
        // The basePath here might just be a placeholder.
        return '/'; // Default or a path that makes sense if files are flatly organized
    }, []);

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
                        <p className="text-sm">(or click to select)</p>
                        <input
                            type="file"
                            accept=".urdf"
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
                        <p className="text-sm">(e.g., .obj, .stl, .dae, .gltf - multiple files allowed)</p>
                        <input
                            type="file"
                            accept=".obj,.stl,.dae,.gltf"
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
            {robotLoaded && urdfFile && meshFiles.size > 0 && (
                <div className="w-full h-96 bg-gray-700 rounded-lg overflow-hidden shadow-inner border border-gray-600">
                    <Canvas camera={{ position: [1, 1, 1], fov: 75 }}>
                        <ambientLight intensity={0.8} />
                        <directionalLight position={[2, 5, 2]} intensity={1} />
                        <directionalLight position={[-2, -5, -2]} intensity={0.5} />
                        <Environment preset="studio" />
                        <Suspense fallback={<Text color="white" anchorX="center" anchorY="middle">Loading Robot Model...</Text>}>
                            <CustomURDFModelLoader
                                urdfFile={urdfFile}
                                meshFiles={meshFiles}
                                basePath={getUrdfBasePath()}
                            />
                        </Suspense>
                        <OrbitControls />
                    </Canvas>
                </div>
            )}
        </div>
    );
};

export default UrdfUploader;
