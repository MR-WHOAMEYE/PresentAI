"""
Google Drive Service
Handles listing user's presentations and uploading recordings
"""
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaIoBaseUpload
import io


class DriveService:
    """Google Drive API wrapper"""
    
    def __init__(self, credentials):
        self.credentials = credentials
        self.service = build('drive', 'v3', credentials=credentials)
    
    def list_presentations(self, max_results=50):
        """List user's Google Slides presentations"""
        try:
            # Query for Google Slides files only
            query = "mimeType='application/vnd.google-apps.presentation' and trashed=false"
            
            results = self.service.files().list(
                q=query,
                pageSize=max_results,
                fields="files(id, name, thumbnailLink, modifiedTime, createdTime)",
                orderBy="modifiedTime desc"
            ).execute()
            
            files = results.get('files', [])
            
            presentations = []
            for file in files:
                presentations.append({
                    'id': file.get('id'),
                    'title': file.get('name'),
                    'thumbnailUrl': file.get('thumbnailLink'),
                    'lastModified': file.get('modifiedTime'),
                    'createdAt': file.get('createdTime')
                })
            
            return presentations
        except HttpError as e:
            print(f"Error listing presentations: {e}")
            raise
    
    def get_file_metadata(self, file_id):
        """Get metadata for a specific file"""
        try:
            file = self.service.files().get(
                fileId=file_id,
                fields="id, name, thumbnailLink, modifiedTime, createdTime"
            ).execute()
            
            return {
                'id': file.get('id'),
                'title': file.get('name'),
                'thumbnailUrl': file.get('thumbnailLink'),
                'lastModified': file.get('modifiedTime'),
                'createdAt': file.get('createdTime')
            }
        except HttpError as e:
            print(f"Error getting file metadata: {e}")
            raise
    
    def get_or_create_folder(self, folder_name="Presentation Coach Recordings"):
        """Get or create a folder for storing recordings"""
        try:
            # Check if folder exists
            query = f"name='{folder_name}' and mimeType='application/vnd.google-apps.folder' and trashed=false"
            results = self.service.files().list(
                q=query,
                fields="files(id, name)"
            ).execute()
            
            files = results.get('files', [])
            
            if files:
                return files[0]['id']
            
            # Create folder if it doesn't exist
            folder_metadata = {
                'name': folder_name,
                'mimeType': 'application/vnd.google-apps.folder'
            }
            
            folder = self.service.files().create(
                body=folder_metadata,
                fields='id'
            ).execute()
            
            return folder.get('id')
            
        except HttpError as e:
            print(f"Error getting/creating folder: {e}")
            raise
    
    def upload_recording(self, file_data, filename, session_id=None, presentation_title=None):
        """Upload a recording to Google Drive"""
        try:
            # Get or create recordings folder
            folder_id = self.get_or_create_folder()
            
            # Create descriptive filename
            if presentation_title:
                safe_title = "".join(c for c in presentation_title if c.isalnum() or c in (' ', '-', '_')).strip()
                filename = f"Recording_{safe_title}_{session_id or 'session'}.webm"
            else:
                filename = f"Recording_{session_id or 'session'}.webm"
            
            file_metadata = {
                'name': filename,
                'parents': [folder_id],
                'description': f'Presentation Coach practice session recording'
            }
            
            # Upload file
            media = MediaIoBaseUpload(
                io.BytesIO(file_data),
                mimetype='video/webm',
                resumable=True
            )
            
            file = self.service.files().create(
                body=file_metadata,
                media_body=media,
                fields='id, name, webViewLink, webContentLink'
            ).execute()
            
            # Make file viewable with link
            self.service.permissions().create(
                fileId=file.get('id'),
                body={'type': 'anyone', 'role': 'reader'}
            ).execute()
            
            return {
                'fileId': file.get('id'),
                'fileName': file.get('name'),
                'viewUrl': file.get('webViewLink'),
                'downloadUrl': file.get('webContentLink')
            }
            
        except HttpError as e:
            print(f"Error uploading recording: {e}")
            raise


def get_drive_service(credentials):
    """Factory function to create DriveService"""
    return DriveService(credentials)
