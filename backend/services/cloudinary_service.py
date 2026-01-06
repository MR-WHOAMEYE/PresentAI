"""
Cloudinary Service
Video upload and management for practice session recordings
"""
import cloudinary
import cloudinary.uploader
import cloudinary.api
from config import Config
import os
import tempfile


class CloudinaryService:
    """Service for uploading and managing videos on Cloudinary"""
    
    def __init__(self):
        self.configured = False
        self._configure()
    
    def _configure(self):
        """Configure Cloudinary from environment"""
        cloudinary_url = Config.CLOUDINARY_URL
        if cloudinary_url:
            # Parse CLOUDINARY_URL format: cloudinary://api_key:api_secret@cloud_name
            try:
                cloudinary.config(cloudinary_url=cloudinary_url)
                self.configured = True
                print("✅ Cloudinary configured")
            except Exception as e:
                print(f"❌ Cloudinary configuration failed: {e}")
                self.configured = False
    
    def upload_video(self, video_file, session_id, user_id=None):
        """
        Upload a video to Cloudinary
        
        Args:
            video_file: File object or path to video
            session_id: Practice session ID for organizing
            user_id: Optional user ID for folder organization
        
        Returns:
            dict with video URL and metadata
        """
        if not self.configured:
            return {'error': 'Cloudinary not configured'}
        
        try:
            # Create a unique public ID
            folder = f"presentation_coach/{user_id}" if user_id else "presentation_coach"
            public_id = f"{folder}/session_{session_id}"
            
            # Upload options
            upload_options = {
                'resource_type': 'video',
                'public_id': public_id,
                'overwrite': True,
                'folder': folder,
                'eager': [
                    {'width': 640, 'height': 360, 'crop': 'limit', 'format': 'mp4'},
                    {'width': 1280, 'height': 720, 'crop': 'limit', 'format': 'mp4'}
                ],
                'eager_async': True
            }
            
            # Handle file upload
            if hasattr(video_file, 'read'):
                # It's a file object - save to temp file first
                with tempfile.NamedTemporaryFile(delete=False, suffix='.webm') as temp:
                    video_file.save(temp)
                    temp_path = temp.name
                
                result = cloudinary.uploader.upload(temp_path, **upload_options)
                os.unlink(temp_path)  # Clean up temp file
            else:
                # It's a file path
                result = cloudinary.uploader.upload(video_file, **upload_options)
            
            return {
                'success': True,
                'url': result['secure_url'],
                'public_id': result['public_id'],
                'duration': result.get('duration'),
                'format': result.get('format'),
                'width': result.get('width'),
                'height': result.get('height'),
                'bytes': result.get('bytes'),
                'thumbnail_url': result.get('secure_url', '').replace('/video/', '/video/').replace('.webm', '.jpg').replace('.mp4', '.jpg'),
                'player_url': self.get_player_url(result['public_id'])
            }
            
        except Exception as e:
            print(f"Cloudinary upload error: {e}")
            return {'error': str(e)}
    
    def get_player_url(self, public_id):
        """Get Cloudinary video player embed URL"""
        cloud_name = cloudinary.config().cloud_name
        return f"https://player.cloudinary.com/embed/?public_id={public_id}&cloud_name={cloud_name}&player[fluid]=true&player[controls]=true"
    
    def get_video_url(self, public_id, transformation=None):
        """Get optimized video URL with optional transformation"""
        if transformation:
            return cloudinary.CloudinaryVideo(public_id).build_url(**transformation)
        return cloudinary.CloudinaryVideo(public_id).build_url()
    
    def delete_video(self, public_id):
        """Delete a video from Cloudinary"""
        if not self.configured:
            return {'error': 'Cloudinary not configured'}
        
        try:
            result = cloudinary.uploader.destroy(public_id, resource_type='video')
            return {'success': True, 'result': result}
        except Exception as e:
            print(f"Cloudinary delete error: {e}")
            return {'error': str(e)}
    
    def get_video_details(self, public_id):
        """Get video details from Cloudinary"""
        if not self.configured:
            return {'error': 'Cloudinary not configured'}
        
        try:
            result = cloudinary.api.resource(public_id, resource_type='video')
            return {
                'success': True,
                'url': result['secure_url'],
                'duration': result.get('duration'),
                'format': result.get('format'),
                'width': result.get('width'),
                'height': result.get('height'),
                'bytes': result.get('bytes'),
                'created_at': result.get('created_at')
            }
        except Exception as e:
            print(f"Cloudinary details error: {e}")
            return {'error': str(e)}


# Singleton instance
cloudinary_service = CloudinaryService()
