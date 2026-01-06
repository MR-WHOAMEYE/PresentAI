"""
Google Slides Service
Handles reading presentations and writing feedback to speaker notes
"""
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError


class SlidesService:
    """Google Slides API wrapper"""
    
    def __init__(self, credentials):
        self.credentials = credentials
        self.service = build('slides', 'v1', credentials=credentials)
    
    def get_presentation(self, presentation_id):
        """Get full presentation data with thumbnails"""
        try:
            presentation = self.service.presentations().get(
                presentationId=presentation_id
            ).execute()
            
            slides = []
            for i, slide in enumerate(presentation.get('slides', [])):
                slide_id = slide.get('objectId')
                
                # Get thumbnail for this slide
                thumbnail_url = None
                try:
                    thumbnail = self.service.presentations().pages().getThumbnail(
                        presentationId=presentation_id,
                        pageObjectId=slide_id,
                        thumbnailProperties_thumbnailSize='LARGE'
                    ).execute()
                    thumbnail_url = thumbnail.get('contentUrl')
                except Exception as e:
                    print(f"Error getting thumbnail for slide {i+1}: {e}")
                
                slide_data = {
                    'slideNumber': i + 1,
                    'objectId': slide_id,
                    'textContent': self._extract_text_from_slide(slide),
                    'speakerNotes': self._extract_speaker_notes(slide),
                    'thumbnailUrl': thumbnail_url
                }
                slides.append(slide_data)
            
            return {
                'id': presentation.get('presentationId'),
                'title': presentation.get('title'),
                'slides': slides,
                'slideCount': len(slides)
            }
        except HttpError as e:
            print(f"Error fetching presentation: {e}")
            raise
    
    def _extract_text_from_slide(self, slide):
        """Extract all text content from a slide"""
        texts = []
        
        for element in slide.get('pageElements', []):
            shape = element.get('shape')
            if shape and shape.get('text'):
                for text_element in shape['text'].get('textElements', []):
                    text_run = text_element.get('textRun')
                    if text_run:
                        texts.append(text_run.get('content', ''))
        
        return ''.join(texts).strip()
    
    def _extract_speaker_notes(self, slide):
        """Extract speaker notes from a slide"""
        notes_page = slide.get('slideProperties', {}).get('notesPage')
        if not notes_page:
            return ''
        
        texts = []
        for element in notes_page.get('pageElements', []):
            shape = element.get('shape')
            if shape and shape.get('shapeType') == 'TEXT_BOX':
                text = shape.get('text')
                if text:
                    for text_element in text.get('textElements', []):
                        text_run = text_element.get('textRun')
                        if text_run:
                            texts.append(text_run.get('content', ''))
        
        return ''.join(texts).strip()
    
    def get_slide_thumbnails(self, presentation_id):
        """Get thumbnail URLs for all slides"""
        try:
            presentation = self.service.presentations().get(
                presentationId=presentation_id
            ).execute()
            
            thumbnails = []
            for slide in presentation.get('slides', []):
                slide_id = slide.get('objectId')
                # Generate thumbnail URL
                thumbnail = self.service.presentations().pages().getThumbnail(
                    presentationId=presentation_id,
                    pageObjectId=slide_id,
                    thumbnailProperties_thumbnailSize='MEDIUM'
                ).execute()
                
                thumbnails.append({
                    'slideId': slide_id,
                    'thumbnailUrl': thumbnail.get('contentUrl')
                })
            
            return thumbnails
        except HttpError as e:
            print(f"Error fetching thumbnails: {e}")
            raise
    
    def update_speaker_notes(self, presentation_id, slide_object_id, notes_text):
        """Update speaker notes for a specific slide"""
        try:
            # First, get the notes page shape ID
            presentation = self.service.presentations().get(
                presentationId=presentation_id
            ).execute()
            
            notes_shape_id = None
            for slide in presentation.get('slides', []):
                if slide.get('objectId') == slide_object_id:
                    notes_page = slide.get('slideProperties', {}).get('notesPage')
                    if notes_page:
                        for element in notes_page.get('pageElements', []):
                            shape = element.get('shape')
                            if shape and shape.get('shapeType') == 'TEXT_BOX':
                                notes_shape_id = element.get('objectId')
                                break
                    break
            
            if not notes_shape_id:
                print("Could not find notes shape")
                return False
            
            # Delete existing text and insert new text
            requests = [
                {
                    'deleteText': {
                        'objectId': notes_shape_id,
                        'textRange': {
                            'type': 'ALL'
                        }
                    }
                },
                {
                    'insertText': {
                        'objectId': notes_shape_id,
                        'insertionIndex': 0,
                        'text': notes_text
                    }
                }
            ]
            
            self.service.presentations().batchUpdate(
                presentationId=presentation_id,
                body={'requests': requests}
            ).execute()
            
            return True
        except HttpError as e:
            print(f"Error updating speaker notes: {e}")
            raise


def get_slides_service(credentials):
    """Factory function to create SlidesService"""
    return SlidesService(credentials)
