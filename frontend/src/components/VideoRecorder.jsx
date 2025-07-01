// src/components/VideoRecorder.jsx
import React, { useRef, useState, useCallback, useEffect } from 'react';

const VideoRecorder = ({
    recordingSourceRef, // This will be drawingCanvasRef from UrdfUploader
    onRecordingStatusChange,
    onVideoAvailable,
    isRobotLoaded,
    isPlayingRecordedVideo,
    setIsPlayingRecordedVideo,
    recordedJointStatesData,
    onPlayRecordedData,
    recordedVideoPlayerRef // Ref to the playback video element in UrdfUploader
}) => {
    const mediaRecorderRef = useRef(null);
    const recordedChunksRef = useRef([]);

    const [isRecording, setIsRecording] = useState(false);
    const [localRecordedVideoBlob, setLocalRecordedVideoBlob] = useState(null);

    const startRecording = useCallback(() => {
        console.log("[VideoRecorder] startRecording called.");
        if (!recordingSourceRef.current) {
            console.warn("[VideoRecorder] Recording source ref is not available for recording.");
            onRecordingStatusChange("Error: Recording source (camera feed) not ready.", false);
            return;
        }

        recordedChunksRef.current = [];
        setLocalRecordedVideoBlob(null); // Clear any previous blob
        if (recordedVideoPlayerRef.current) {
            recordedVideoPlayerRef.current.src = ''; // Clear previous video src
            recordedVideoPlayerRef.current.load(); // Ensure video element updates
        }
        setIsPlayingRecordedVideo(false); // Ensure playback state is off when starting new recording

        let stream;
        try {
            // Get stream from the canvas
            stream = recordingSourceRef.current.captureStream(30); // 30 FPS
            if (!stream) {
                throw new Error("Failed to capture stream from recording source.");
            }
        } catch (error) {
            console.error("[VideoRecorder] Error capturing stream:", error);
            onRecordingStatusChange("Error capturing video stream from camera feed. Check browser permissions.", false);
            return;
        }

        try {
            const mimeType = MediaRecorder.isTypeSupported('video/webm; codecs=vp8') 
                             ? 'video/webm; codecs=vp8' 
                             : (MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : '');
            
            if (!mimeType) {
                console.error("[VideoRecorder] No supported video mimeType found for MediaRecorder.");
                onRecordingStatusChange("Error: No supported video format for recording in your browser.", false);
                return;
            }

            mediaRecorderRef.current = new MediaRecorder(stream, {
                mimeType: mimeType
            });

            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    recordedChunksRef.current.push(event.data);
                    // console.log(`[VideoRecorder] Data available: ${event.data.size} bytes. Total chunks: ${recordedChunksRef.current.length}`);
                }
            };

            mediaRecorderRef.current.onstop = () => {
                console.log("[VideoRecorder] MediaRecorder onstop event fired. Final chunks count:", recordedChunksRef.current.length);
                const currentBlob = new Blob(recordedChunksRef.current, { type: mediaRecorderRef.current.mimeType });
                
                if (localRecordedVideoBlob) {
                    URL.revokeObjectURL(localRecordedVideoBlob);
                    console.log("[VideoRecorder] Revoked previous local recorded video Blob URL.");
                }
                
                setLocalRecordedVideoBlob(currentBlob);
                onVideoAvailable(currentBlob);
                onRecordingStatusChange("Recording stopped. Video is ready to play.", false);
                setIsRecording(false);
                console.log("[VideoRecorder] Blob created with size:", currentBlob.size, "bytes. Type:", currentBlob.type);
            };

            mediaRecorderRef.current.onerror = (event) => {
                console.error("[VideoRecorder] MediaRecorder error:", event.error);
                onRecordingStatusChange(`Recording error: ${event.error.name} - ${event.error.message}`, false);
                setIsRecording(false);
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
            onRecordingStatusChange("Recording started...", true);
            console.log("[VideoRecorder] Recording started with mimeType:", mimeType);
        } catch (error) {
            console.error("[VideoRecorder] Error initializing MediaRecorder:", error);
            onRecordingStatusChange(`Error starting recording: ${error.message}`, false);
            setIsRecording(false);
        }
    }, [recordingSourceRef, onRecordingStatusChange, onVideoAvailable, localRecordedVideoBlob, recordedVideoPlayerRef, setIsPlayingRecordedVideo]);

    const stopRecording = useCallback(() => {
        console.log("[VideoRecorder] stopRecording called. Current isRecording:", isRecording);
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') { // Check actual state of MediaRecorder
            mediaRecorderRef.current.stop();
        } else {
            console.warn("[VideoRecorder] MediaRecorder is not in 'recording' state. State:", mediaRecorderRef.current?.state);
            setIsRecording(false);
            onRecordingStatusChange("Recording not active.", false);
        }
    }, [isRecording]);

    const playRecordedVideo = useCallback(() => {
        const playerElement = recordedVideoPlayerRef.current;
        console.log("[VideoRecorder] Attempting to play recorded video.");
        console.log("  localRecordedVideoBlob:", localRecordedVideoBlob);
        console.log("  playerElement:", playerElement);
        console.log("  recordedJointStatesData length:", recordedJointStatesData.length);
        console.log("  isPlayingRecordedVideo:", isPlayingRecordedVideo, "isRecording:", isRecording);


        if (!localRecordedVideoBlob || localRecordedVideoBlob.size === 0 || !playerElement) { 
            console.warn("[VideoRecorder] Playback conditions not met (video or player missing).");
            console.warn(`  Blob available: ${!!localRecordedVideoBlob} (size: ${localRecordedVideoBlob?.size}), Player element available: ${!!playerElement}`);
            onRecordingStatusChange("Cannot play: Video not recorded or player unavailable.", false);
            return;
        }

        const videoUrl = URL.createObjectURL(localRecordedVideoBlob);
        playerElement.src = videoUrl;
        playerElement.loop = false;
        playerElement.controls = true; 
        
        setIsPlayingRecordedVideo(true);

        // Only trigger joint data playback if there is joint data
        if (onPlayRecordedData && recordedJointStatesData.length > 0) {
            onPlayRecordedData(recordedJointStatesData);
            console.log("[VideoRecorder] Triggered onPlayRecordedData with", recordedJointStatesData.length, "frames.");
        } else {
            console.warn("[VideoRecorder] No joint data available for robot animation during playback.");
            onPlayRecordedData([]); // Explicitly send empty array to reset robot if necessary
        }

        playerElement.onended = () => {
            console.log("[VideoRecorder] Recorded video playback ended.");
            // Important: setIsPlayingRecordedVideo(false) should be handled by UrdfUploader's handlePlayRecordedData
            // as it's responsible for coordinating the robot animation loop and resuming live camera.
            URL.revokeObjectURL(videoUrl);
            playerElement.src = '';
            playerElement.controls = false;
        };

        playerElement.play().then(() => {
            console.log("[VideoRecorder] Playback successfully initiated.");
        }).catch(e => {
            console.error("[VideoRecorder] Error playing recorded video (possible autoplay block or codec issue):", e);
            onRecordingStatusChange(`Error playing video: ${e.name} - ${e.message}. Check browser console for details.`, false);
            setIsPlayingRecordedVideo(false); // Reset on error
            try { URL.revokeObjectURL(videoUrl); } catch (revokeErr) { console.warn("Error revoking URL after playback error:", revokeErr); }
        });
        console.log("[VideoRecorder] Attempted to play video from blob URL:", videoUrl);
    }, [localRecordedVideoBlob, setIsPlayingRecordedVideo, onPlayRecordedData, recordedJointStatesData, recordedVideoPlayerRef, onRecordingStatusChange, isRecording]);

    useEffect(() => {
        // console.log("--- Current Button States ---");
        // console.log("Start Recording disabled:", isRecording || !isRobotLoaded || isPlayingRecordedVideo);
        // console.log("Stop Recording disabled:", !isRecording);
        // console.log("Play Recorded Video disabled:", !localRecordedVideoBlob || localRecordedVideoBlob.size === 0 || isPlayingRecordedVideo || isRecording || recordedJointStatesData.length === 0);
        // console.log("----------------------------");
    }, [isRecording, isRobotLoaded, isPlayingRecordedVideo, localRecordedVideoBlob, recordedJointStatesData]);


    useEffect(() => {
        return () => {
            if (localRecordedVideoBlob) {
                try {
                    URL.revokeObjectURL(localRecordedVideoBlob);
                    console.log("[VideoRecorder] Revoked recorded video Blob URL on cleanup (component unmount).");
                } catch (e) {
                    console.warn("[VideoRecorder] Error revoking recorded video Blob URL on cleanup:", e);
                }
            }
            if (recordedVideoPlayerRef.current) {
                if (!recordedVideoPlayerRef.current.paused) {
                    recordedVideoPlayerRef.current.pause(); // Ensure video stops playing
                    console.log("[VideoRecorder] Paused playing video on component unmount.");
                }
                recordedVideoPlayerRef.current.currentTime = 0;
                recordedVideoPlayerRef.current.src = '';
                recordedVideoPlayerRef.current.controls = false;
            }
        };
    }, [localRecordedVideoBlob, recordedVideoPlayerRef]);

    return (
        <div className="bg-gradient-to-br from-purple-800/20 to-cyan-800/20 backdrop-blur-sm rounded-xl p-4 border border-purple-500/20 mb-6">
            <h3 className="text-lg font-semibold mb-3 text-purple-300">Video Recording</h3>
            <div className="flex flex-col space-y-3">
                <button
                    onClick={startRecording}
                    disabled={isRecording || !isRobotLoaded || isPlayingRecordedVideo}
                    className="w-full bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 disabled:hover:scale-100 shadow-lg hover:shadow-green-500/25"
                >
                    {isRecording ? 'Recording...' : 'Start Recording'}
                </button>
                <button
                    onClick={stopRecording}
                    disabled={!isRecording} 
                    className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 disabled:hover:scale-100 shadow-lg hover:shadow-orange-500/25"
                >
                    Stop Recording
                </button>
                <button
                    onClick={playRecordedVideo}
                    disabled={!localRecordedVideoBlob || localRecordedVideoBlob.size === 0 || isPlayingRecordedVideo || isRecording || recordedJointStatesData.length === 0}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 disabled:hover:scale-100 shadow-lg hover:shadow-blue-500/25"
                >
                    Play Recorded Video
                </button>
            </div>
            {localRecordedVideoBlob && (
                <p className="mt-3 text-sm text-emerald-400 bg-emerald-900/20 p-2 rounded-lg">
                    ✓ Recorded video available. Size: {(localRecordedVideoBlob.size / 1024).toFixed(2)} KB.
                    {recordedJointStatesData.length > 0 ? ` Joint frames: ${recordedJointStatesData.length}` : ' No joint data recorded.'}
                </p>
            )}
        </div>
    );
};

export default VideoRecorder;