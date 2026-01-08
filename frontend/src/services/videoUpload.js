/**
 * Chunked Video Upload Service
 * Uploads large video files to backend in chunks for better reliability
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks

/**
 * Upload a video blob in chunks
 * @param {Blob} blob - The video blob to upload
 * @param {string} sessionId - The session ID
 * @param {Function} onProgress - Progress callback (0-100)
 * @returns {Promise<Object>} - Upload result
 */
export async function uploadVideoChunked(blob, sessionId, onProgress = () => { }) {
    const totalChunks = Math.ceil(blob.size / CHUNK_SIZE);
    const uploadId = `upload_${sessionId}_${Date.now()}`;

    console.log(`Starting chunked upload: ${blob.size} bytes, ${totalChunks} chunks`);

    // For small videos (< 10MB), use single upload
    if (blob.size < 10 * 1024 * 1024) {
        onProgress(50);
        const formData = new FormData();
        formData.append('recording', blob, 'recording.webm');

        const response = await fetch(`${API_URL}/sessions/${sessionId}/upload-recording`, {
            method: 'POST',
            credentials: 'include',
            body: formData
        });

        onProgress(100);

        if (!response.ok) {
            throw new Error('Upload failed');
        }

        return response.json();
    }

    // For larger videos, upload in chunks
    const chunks = [];
    for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, blob.size);
        chunks.push(blob.slice(start, end));
    }

    // Upload chunks
    for (let i = 0; i < chunks.length; i++) {
        const formData = new FormData();
        formData.append('chunk', chunks[i], `chunk_${i}.webm`);
        formData.append('chunkIndex', i.toString());
        formData.append('totalChunks', totalChunks.toString());
        formData.append('uploadId', uploadId);
        formData.append('isLastChunk', (i === chunks.length - 1).toString());

        const response = await fetch(`${API_URL}/sessions/${sessionId}/upload-chunk`, {
            method: 'POST',
            credentials: 'include',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`Chunk ${i + 1}/${totalChunks} upload failed`);
        }

        // Report progress
        const progress = Math.round(((i + 1) / totalChunks) * 100);
        onProgress(progress);
        console.log(`Uploaded chunk ${i + 1}/${totalChunks} (${progress}%)`);

        // If this was the last chunk, return the response
        if (i === chunks.length - 1) {
            return response.json();
        }
    }
}

/**
 * Simple upload for smaller videos
 */
export async function uploadVideo(blob, sessionId) {
    const formData = new FormData();
    formData.append('recording', blob, 'recording.webm');

    const response = await fetch(`${API_URL}/sessions/${sessionId}/upload-recording`, {
        method: 'POST',
        credentials: 'include',
        body: formData
    });

    if (!response.ok) {
        throw new Error('Upload failed');
    }

    return response.json();
}

export default { uploadVideoChunked, uploadVideo };
