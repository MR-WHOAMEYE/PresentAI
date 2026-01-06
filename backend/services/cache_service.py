"""
Cache Service using LangCache (Redis Semantic Caching)
Caches presentation data with semantic search capabilities
"""
import json
from flask import current_app


class CacheService:
    """LangCache-based semantic caching service"""
    
    def __init__(self):
        self._lang_cache = None
        self._initialized = False
    
    def _get_lang_cache(self):
        """Lazy initialization of LangCache client"""
        if not self._initialized:
            try:
                from langcache import LangCache
                
                api_key = current_app.config.get('LANGCACHE_API_KEY')
                server_url = current_app.config.get('LANGCACHE_SERVER_URL')
                cache_id = current_app.config.get('LANGCACHE_CACHE_ID')
                
                if not api_key:
                    print("⚠️ LANGCACHE_API_KEY not set, caching disabled")
                    self._initialized = True
                    return None
                
                self._lang_cache = LangCache(
                    server_url=server_url,
                    cache_id=cache_id,
                    api_key=api_key
                )
                print("✅ Connected to LangCache semantic cache")
                self._initialized = True
                
            except Exception as e:
                print(f"⚠️ LangCache not available: {e}")
                self._initialized = True
                self._lang_cache = None
        
        return self._lang_cache
    
    def get_presentation(self, presentation_id, user_id):
        """Get cached presentation using semantic search"""
        lang_cache = self._get_lang_cache()
        if not lang_cache:
            return None
        
        try:
            prompt = f"presentation:{user_id}:{presentation_id}"
            result = lang_cache.search(prompt=prompt)
            
            # Handle SearchResponse object
            if result and hasattr(result, 'hits') and result.hits:
                for hit in result.hits:
                    # Access hit attributes (may be object or dict)
                    hit_prompt = getattr(hit, 'prompt', None) or (hit.get('prompt') if isinstance(hit, dict) else None)
                    hit_response = getattr(hit, 'response', None) or (hit.get('response') if isinstance(hit, dict) else None)
                    
                    if hit_prompt == prompt and hit_response:
                        print(f"📦 Cache HIT: {presentation_id}")
                        return json.loads(hit_response)
            
            print(f"📭 Cache MISS: {presentation_id}")
            return None
            
        except Exception as e:
            print(f"Cache get error: {e}")
            return None
    
    def set_presentation(self, presentation_id, user_id, data):
        """Cache presentation data"""
        lang_cache = self._get_lang_cache()
        if not lang_cache:
            return False
        
        try:
            prompt = f"presentation:{user_id}:{presentation_id}"
            response = json.dumps(data)
            
            lang_cache.set(prompt=prompt, response=response)
            print(f"💾 Cached presentation: {presentation_id}")
            return True
            
        except Exception as e:
            print(f"Cache set error: {e}")
            return False
    
    def get_user_presentations_list(self, user_id):
        """Get cached list of user's presentations"""
        lang_cache = self._get_lang_cache()
        if not lang_cache:
            return None
        
        try:
            prompt = f"presentations_list:{user_id}"
            result = lang_cache.search(prompt=prompt)
            
            # Handle SearchResponse object
            if result and hasattr(result, 'hits') and result.hits:
                for hit in result.hits:
                    hit_prompt = getattr(hit, 'prompt', None) or (hit.get('prompt') if isinstance(hit, dict) else None)
                    hit_response = getattr(hit, 'response', None) or (hit.get('response') if isinstance(hit, dict) else None)
                    
                    if hit_prompt == prompt and hit_response:
                        print(f"📦 Cache HIT: presentations list")
                        return json.loads(hit_response)
            
            return None
            
        except Exception as e:
            print(f"Cache get error: {e}")
            return None
    
    def set_user_presentations_list(self, user_id, data, ttl=300):
        """Cache user's presentations list"""
        lang_cache = self._get_lang_cache()
        if not lang_cache:
            return False
        
        try:
            prompt = f"presentations_list:{user_id}"
            response = json.dumps(data)
            
            lang_cache.set(prompt=prompt, response=response)
            print(f"💾 Cached presentations list")
            return True
            
        except Exception as e:
            print(f"Cache set error: {e}")
            return False
    
    def invalidate_presentation(self, presentation_id, user_id):
        """Invalidate cached presentation (set empty)"""
        return self.set_presentation(presentation_id, user_id, {})
    
    def clear_user_cache(self, user_id):
        """Clear user's cache by setting empty values"""
        self.set_user_presentations_list(user_id, [])
        print(f"🧹 Cleared cache for user")
        return True


# Singleton instance
cache_service = CacheService()
