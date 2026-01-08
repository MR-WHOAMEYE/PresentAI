"""
Vercel Blob Service
Video upload and management using Vercel Blob Storage
"""
import requests
import os
from config import Config


class VercelBlobService:
    """Service for uploading and managing videos on Vercel Blob"""
    
    def __init__(self):
        self.token = os.environ.get('BLOB_READ_WRITE_TOKEN') or Config.BLOB_READ_WRITE_TOKEN if hasattr(Config, 'BLOB_READ_WRITE_TOKEN') else None
        self.configured = bool(self.token)
        if self.configured:
            print("✅ Vercel Blob configured")
        else:
            print("⚠️ Vercel Blob not configured (BLOB_READ_WRITE_TOKEN missing)")
    
    def upload_video(self, video_file, filename, content_type='video/webm'):
        """
        Upload a video to Vercel Blob
        
        Args:
            video_file: File object or bytes
            filename: Name for the file in Blob storage
            content_type: MIME type of the video
        
        Returns:
            dict with video URL and metadata
        """
        if not self.configured:
            return {'error': 'Vercel Blob not configured'}
        
        try:
            # Read file content
            if hasattr(video_file, 'read'):
                content = video_file.read()
            else:
                content = video_file
            
            # Upload to Vercel Blob using PUT
            # https://vercel.com/docs/storage/vercel-blob/using-blob-sdk#put
            url = f"https://blob.vercel-storage.com/{filename}"
            
            headers = {
                'Authorization': f'Bearer {self.token}',
                'Content-Type': content_type,
                'x-api-version': '7',
                'x-content-type': content_type
            }
            
            response = requests.put(
                url,
                data=content,
                headers=headers
            )
            
            if response.status_code in [200, 201]:
                result = response.json()
                print(f"✅ Video uploaded to Vercel Blob: {result.get('url')}")
                return {
                    'success': True,
                    'url': result.get('url'),
                    'downloadUrl': result.get('downloadUrl'),
                    'pathname': result.get('pathname'),
                    'contentType': result.get('contentType'),
                    'size': len(content)
                }
            else:
                print(f"❌ Vercel Blob upload failed: {response.status_code} - {response.text}")
                return {'error': f'Upload failed: {response.status_code}'}
                
        except Exception as e:
            print(f"Vercel Blob upload error: {e}")
            return {'error': str(e)}
    
    def upload_video_multipart(self, video_file, filename, session_id, user_id=None):
        """
        Upload a large video using multipart upload
        
        Args:
            video_file: File path or file object
            filename: Base filename
            session_id: Session ID for organization
            user_id: Optional user ID
        
        Returns:
            dict with video URL
        """
        if not self.configured:
            return {'error': 'Vercel Blob not configured'}
        
        try:
            import tempfile
            
            # Create unique filename
            safe_filename = f"recordings/{user_id or 'anonymous'}/session_{session_id}.webm"
            
            # Read content
            if hasattr(video_file, 'read'):
                content = video_file.read()
            elif isinstance(video_file, str) and os.path.exists(video_file):
                with open(video_file, 'rb') as f:
                    content = f.read()
            else:
                content = video_file
            
            return self.upload_video(content, safe_filename, 'video/webm')
            
        except Exception as e:
            print(f"Vercel Blob multipart upload error: {e}")
            return {'error': str(e)}
    
    def delete_video(self, url):
        """Delete a video from Vercel Blob"""
        if not self.configured:
            return {'error': 'Vercel Blob not configured'}
        
        try:
            headers = {
                'Authorization': f'Bearer {self.token}',
                'x-api-version': '7'
            }
            
            response = requests.post(
                'https://blob.vercel-storage.com/delete',
                headers=headers,
                json={'urls': [url]}
            )
            
            if response.status_code == 200:
                return {'success': True}
            else:
                return {'error': f'Delete failed: {response.status_code}'}
                
        except Exception as e:
            print(f"Vercel Blob delete error: {e}")
            return {'error': str(e)}
    
    def list_videos(self, prefix=None):
        """List videos in Vercel Blob"""
        if not self.configured:
            return {'error': 'Vercel Blob not configured'}
        
        try:
            headers = {
                'Authorization': f'Bearer {self.token}',
                'x-api-version': '7'
            }
            
            params = {}
            if prefix:
                params['prefix'] = prefix
            
            response = requests.get(
                'https://blob.vercel-storage.com',
                headers=headers,
                params=params
            )
            
            if response.status_code == 200:
                result = response.json()
                return {
                    'success': True,
                    'blobs': result.get('blobs', []),
                    'cursor': result.get('cursor')
                }
            else:
                return {'error': f'List failed: {response.status_code}'}
                
        except Exception as e:
            print(f"Vercel Blob list error: {e}")
            return {'error': str(e)}


# Singleton instance
vercel_blob_service = VercelBlobService()
